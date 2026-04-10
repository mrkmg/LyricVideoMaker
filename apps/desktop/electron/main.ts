import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { app, BrowserWindow, dialog, ipcMain } from "electron";
import {
  SUPPORTED_FONT_FAMILIES,
  createRenderJob,
  parseSrt,
  serializeSceneComponentDefinition,
  serializeSceneDefinition,
  type LyricCue,
  type RenderHistoryEntry,
  type RenderProgressEvent,
  type SerializedSceneDefinition
} from "@lyric-video-maker/core";
import {
  probeAudioDurationMs,
  renderLyricVideo
} from "@lyric-video-maker/renderer";
import { builtInSceneComponents, builtInScenes } from "@lyric-video-maker/scene-registry";
import type {
  FilePickKind,
  RenderPreviewRequest,
  StartRenderRequest
} from "../src/electron-api";
import {
  deleteUserScene,
  exportSceneToFile,
  importUserScene,
  loadUserScenes,
  saveUserScene
} from "./scene-library";
import { PreviewWorkerClient } from "./preview-worker-client";

let mainWindow: BrowserWindow | null = null;
let userScenes: SerializedSceneDefinition[] = [];

const history = new Map<string, RenderHistoryEntry>();
const abortControllers = new Map<string, AbortController>();
const subtitleCueCache = new Map<string, LyricCue[]>();
const audioDurationCache = new Map<string, number>();
const previewProfilerEnabled =
  !app.isPackaged && process.env.LYRIC_VIDEO_PREVIEW_PROFILE === "1";
const previewWorkerClient = new PreviewWorkerClient({
  workerPath: join(__dirname, "preview-worker-thread.js")
});

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 960,
    minWidth: 1200,
    minHeight: 760,
    backgroundColor: "#0d1021",
    show: false,
    webPreferences: {
      preload: join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  const devServerUrl = process.env.VITE_DEV_SERVER_URL;
  if (devServerUrl) {
    void mainWindow.loadURL(devServerUrl);
    mainWindow.webContents.openDevTools({ mode: "detach" });
  } else {
    void mainWindow.loadFile(join(__dirname, "../dist/index.html"));
  }

  mainWindow.once("ready-to-show", () => {
    // mainWindow?.maximize();
    mainWindow?.show();
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
    void previewWorkerClient.disposePreview();
  });
}

app.whenReady().then(async () => {
  userScenes = await loadUserScenes(app.getPath("userData"));
  previewWorkerClient.start();
  registerIpcHandlers();
  createMainWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("before-quit", () => {
  void previewWorkerClient.close();
});

function registerIpcHandlers() {
  ipcMain.handle("app:get-bootstrap-data", () => ({
    scenes: [
      ...builtInScenes.map((scene) => serializeSceneDefinition(scene)),
      ...userScenes.map((scene) => serializeSceneDefinition(scene))
    ],
    components: builtInSceneComponents.map((component) => serializeSceneComponentDefinition(component)),
    fonts: [...SUPPORTED_FONT_FAMILIES],
    history: getHistory(),
    previewProfilerEnabled
  }));

  ipcMain.handle(
    "dialog:pick-path",
    async (_event, args: { kind: FilePickKind; suggestedName?: string }) => {
      if (args.kind === "output") {
        const result = await dialog.showSaveDialog(mainWindow!, {
          defaultPath: args.suggestedName ?? "lyric-video.mp4",
          filters: [{ name: "MP4 Video", extensions: ["mp4"] }]
        });

        return result.canceled ? null : result.filePath;
      }

      const filters = getFileFilters(args.kind);
      const result = await dialog.showOpenDialog(mainWindow!, {
        properties: ["openFile"],
        filters
      });

      return result.canceled ? null : result.filePaths[0] ?? null;
    }
  );

  ipcMain.handle("scene:save", async (_event, scene: SerializedSceneDefinition) => {
    const saved = await saveUserScene(app.getPath("userData"), scene);
    userScenes = upsertUserScene(userScenes, saved);
    return saved;
  });

  ipcMain.handle("scene:delete", async (_event, sceneId: string) => {
    await deleteUserScene(app.getPath("userData"), sceneId);
    userScenes = userScenes.filter((scene) => scene.id !== sceneId);
  });

  ipcMain.handle("scene:import", async () => {
    const result = await dialog.showOpenDialog(mainWindow!, {
      properties: ["openFile"],
      filters: [{ name: "Scene JSON", extensions: ["json"] }]
    });

    if (result.canceled || !result.filePaths[0]) {
      return null;
    }

    const imported = await importUserScene(app.getPath("userData"), result.filePaths[0]);
    userScenes = upsertUserScene(userScenes, imported);
    return imported;
  });

  ipcMain.handle("scene:export", async (_event, scene: SerializedSceneDefinition) => {
    const result = await dialog.showSaveDialog(mainWindow!, {
      defaultPath: `${scene.name || "scene"}.json`,
      filters: [{ name: "Scene JSON", extensions: ["json"] }]
    });

    if (result.canceled || !result.filePath) {
      return null;
    }

    await exportSceneToFile(scene, result.filePath);
    return result.filePath;
  });

  ipcMain.handle("render:start", async (_event, request: StartRenderRequest) => {
    await previewWorkerClient.disposePreview();

    const cues = await getSubtitleCues(request.subtitlePath);
    const durationMs = await getAudioDuration(request.audioPath);
    const job = createRenderJob({
      audioPath: request.audioPath,
      subtitlePath: request.subtitlePath,
      outputPath: request.outputPath,
      scene: request.scene,
      componentDefinitions: builtInSceneComponents,
      cues,
      durationMs,
      video: request.video,
      validationContext: {
        isFileAccessible: existsSync
      }
    });

    const controller = new AbortController();
    abortControllers.set(job.id, controller);

    const entry: RenderHistoryEntry = {
      id: job.id,
      sceneId: job.sceneId,
      sceneName: job.sceneName,
      outputPath: job.outputPath,
      createdAt: job.createdAt,
      status: "queued",
      progress: 0,
      message: "Queued",
      logs: []
    };
    upsertHistory(entry);

    void runRenderJob(job, controller);

    return entry;
  });

  ipcMain.handle("render:cancel", async (_event, jobId: string) => {
    abortControllers.get(jobId)?.abort();
  });

  ipcMain.handle("preview:render-frame", async (_event, request: RenderPreviewRequest) => {
    return await previewWorkerClient.renderFrame(request);
  });

  ipcMain.handle("preview:dispose", async () => {
    await previewWorkerClient.disposePreview();
  });
}

async function runRenderJob(
  job: ReturnType<typeof createRenderJob>,
  controller: AbortController
) {
  try {
    await renderLyricVideo({
      job,
      componentDefinitions: builtInSceneComponents,
      signal: controller.signal,
      onProgress: (event) => handleProgress(job, event)
    });
  } catch (error) {
    if (controller.signal.aborted) {
      return;
    }

    handleProgress(job, {
      jobId: job.id,
      status: "failed",
      progress: 0,
      message: "Render failed",
      error: error instanceof Error ? error.message : String(error)
    });
  } finally {
    abortControllers.delete(job.id);
  }
}

function handleProgress(
  job: ReturnType<typeof createRenderJob>,
  event: RenderProgressEvent
) {
  const current = history.get(job.id);
  const nextLogs = event.logEntry ? [...(current?.logs ?? []), event.logEntry] : current?.logs;
  const hasFiniteProgress = Number.isFinite(event.progress);
  const entry: RenderHistoryEntry = {
    id: job.id,
    sceneId: job.sceneId,
    sceneName: job.sceneName,
    outputPath: job.outputPath,
    createdAt: job.createdAt,
    status: hasFiniteProgress ? event.status : current?.status ?? event.status,
    progress: hasFiniteProgress ? event.progress : current?.progress ?? 0,
    message: event.logEntry && !hasFiniteProgress ? current?.message ?? event.message : event.message,
    etaMs: hasFiniteProgress ? event.etaMs : current?.etaMs,
    renderFps: hasFiniteProgress ? event.renderFps : current?.renderFps,
    error: event.error ?? current?.error,
    logs: nextLogs
  };

  upsertHistory({
    ...current,
    ...entry
  });

  mainWindow?.webContents.send("render:progress", event);
}

function upsertHistory(entry: RenderHistoryEntry) {
  history.set(entry.id, entry);
}

function getHistory() {
  return [...history.values()].sort((left, right) => right.createdAt.localeCompare(left.createdAt));
}

function getFileFilters(kind: FilePickKind) {
  switch (kind) {
    case "audio":
      return [{ name: "Audio Files", extensions: ["mp3"] }];
    case "subtitle":
      return [{ name: "Subtitle Files", extensions: ["srt"] }];
    case "image":
      return [{ name: "Image Files", extensions: ["png", "jpg", "jpeg", "webp"] }];
    default:
      return [];
  }
}

function upsertUserScene(
  scenes: SerializedSceneDefinition[],
  nextScene: SerializedSceneDefinition
) {
  const remaining = scenes.filter((scene) => scene.id !== nextScene.id);
  return [...remaining, nextScene].sort((left, right) => left.name.localeCompare(right.name));
}

async function getSubtitleCues(subtitlePath: string) {
  const cached = subtitleCueCache.get(subtitlePath);
  if (cached) {
    return cached;
  }

  const subtitleSource = await readFile(subtitlePath, "utf8");
  const cues = parseSrt(subtitleSource);
  subtitleCueCache.set(subtitlePath, cues);
  return cues;
}

async function getAudioDuration(audioPath: string) {
  const cached = audioDurationCache.get(audioPath);
  if (cached !== undefined) {
    return cached;
  }

  const durationMs = await probeAudioDurationMs(audioPath);
  audioDurationCache.set(audioPath, durationMs);
  return durationMs;
}
