import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { performance } from "node:perf_hooks";
import { app, BrowserWindow, dialog, ipcMain } from "electron";
import {
  SUPPORTED_FONT_FAMILIES,
  createRenderJob,
  msToFrame,
  parseSrt,
  serializeSceneComponentDefinition,
  serializeSceneDefinition,
  type LyricCue,
  type RenderHistoryEntry,
  type RenderProgressEvent,
  type SerializedSceneDefinition
} from "@lyric-video-maker/core";
import {
  createPreviewAssetCache,
  createFramePreviewSession,
  probeAudioDurationMs,
  renderLyricVideo,
  type FramePreviewSession
} from "@lyric-video-maker/renderer";
import { builtInSceneComponents, builtInScenes } from "@lyric-video-maker/scene-registry";
import type {
  FilePickKind,
  RenderPreviewRequest,
  RenderPreviewResponse,
  StartRenderRequest
} from "../src/electron-api";
import {
  deleteUserScene,
  exportSceneToFile,
  importUserScene,
  loadUserScenes,
  saveUserScene
} from "./scene-library";
import { createLatestOnlyPreviewRenderQueue } from "./preview-render-queue";

let mainWindow: BrowserWindow | null = null;
let userScenes: SerializedSceneDefinition[] = [];

const history = new Map<string, RenderHistoryEntry>();
const abortControllers = new Map<string, AbortController>();
const subtitleCueCache = new Map<string, LyricCue[]>();
const audioDurationCache = new Map<string, number>();

interface PreviewSessionState {
  key: string;
  session: FramePreviewSession;
  job: ReturnType<typeof createRenderJob>;
  cues: LyricCue[];
  durationMs: number;
}

let previewSessionState: PreviewSessionState | null = null;
const previewAssetCache = createPreviewAssetCache();
const PREVIEW_MAX_WIDTH = 960;
const PREVIEW_MAX_HEIGHT = 540;
const previewProfilerEnabled =
  !app.isPackaged && process.env.LYRIC_VIDEO_PREVIEW_PROFILE === "1";

const previewRenderQueue = createLatestOnlyPreviewRenderQueue<
  RenderPreviewRequest,
  FramePreviewSession,
  RenderPreviewResponse
>({
  getSessionKey: getPreviewSessionKey,
  createSession: async (request) => {
    const sessionInfo = await getOrCreatePreviewSession(request);
    return {
      key: sessionInfo.key,
      session: sessionInfo.session
    };
  },
  disposeSession: async (sessionState) => {
    if (previewSessionState?.key === sessionState.key) {
      await disposePreviewSession();
      return;
    }

    await sessionState.session.dispose();
  },
  render: async (sessionState, request) => {
    const timingStartMs = performance.now();
    const activeSessionState =
      previewSessionState?.key === sessionState.key
        ? previewSessionState
        : await getOrCreatePreviewSession(request);
    const requestedFrame = Math.max(
      0,
      Math.min(
        activeSessionState.job.video.durationInFrames - 1,
        msToFrame(clamp(request.timeMs, 0, activeSessionState.durationMs), activeSessionState.job.video.fps)
      )
    );

    const preview = await activeSessionState.session.renderFrame({ frame: requestedFrame });
    const cueSummary = getPreviewCueSummary(activeSessionState.cues, preview.timeMs);
    const imageBytes = new Uint8Array(preview.png);
    const response = {
      imageBytes,
      imageMimeType: "image/png",
      frame: preview.frame,
      timeMs: preview.timeMs,
      durationMs: activeSessionState.durationMs,
      currentCue: cueSummary.currentCue,
      previousCue: cueSummary.previousCue,
      nextCue: cueSummary.nextCue
    } satisfies RenderPreviewResponse;

    if (previewProfilerEnabled) {
      console.info(
        `[preview-profile:ipc] ${JSON.stringify({
          reusedSession: activeSessionState.key === sessionState.key,
          requestedFrame,
          payloadBytes: imageBytes.byteLength,
          totalResponseMs: roundPreviewMs(performance.now() - timingStartMs)
        })}`
      );
    }

    return {
      response,
      sessionKey: activeSessionState.key,
      reusedSession: activeSessionState.key === sessionState.key
    };
  }
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
    void previewRenderQueue.dispose();
  });
}

app.whenReady().then(async () => {
  userScenes = await loadUserScenes(app.getPath("userData"));
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
    await previewRenderQueue.dispose();

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
    try {
      return await previewRenderQueue.render(request);
    } catch (error) {
      await disposePreviewSession();
      throw error;
    }
  });

  ipcMain.handle("preview:dispose", async () => {
    await previewRenderQueue.dispose();
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

async function getOrCreatePreviewSession(request: RenderPreviewRequest) {
  const timingStartMs = performance.now();
  const cues = await getSubtitleCues(request.subtitlePath);
  const durationMs = await getAudioDuration(request.audioPath);
  const job = createRenderJob({
    audioPath: request.audioPath,
    subtitlePath: request.subtitlePath,
    outputPath: join(app.getPath("temp"), "lyric-video-preview.mp4"),
    scene: request.scene,
    componentDefinitions: builtInSceneComponents,
    cues,
    durationMs,
    video: getPreviewVideoSettings(request),
    validationContext: {
      isFileAccessible: existsSync
    }
  });
  const key = getPreviewSessionKey(request, job.video.width, job.video.height);
  const reusedExistingSession = Boolean(previewSessionState && previewSessionState.key === key);

  if (!reusedExistingSession) {
    await disposePreviewSession();
    previewSessionState = {
      key,
      session: await createFramePreviewSession({
        job,
        componentDefinitions: builtInSceneComponents,
        assetCache: previewAssetCache
      }),
      job,
      cues,
      durationMs
    };
  }

  if (previewProfilerEnabled) {
    console.info(
      `[preview-profile:session] ${JSON.stringify({
        reusedExistingSession,
        key,
        width: job.video.width,
        height: job.video.height,
        getOrCreatePreviewSessionMs: roundPreviewMs(performance.now() - timingStartMs)
      })}`
    );
  }

  if (!previewSessionState) {
    throw new Error("Preview session was not created.");
  }

  return previewSessionState;
}

async function disposePreviewSession() {
  const activeSession = previewSessionState;
  previewSessionState = null;
  await activeSession?.session.dispose();
}

function getPreviewCueSummary(cues: LyricCue[], timeMs: number) {
  let currentCue: LyricCue | null = null;
  let previousCue: LyricCue | null = null;
  let nextCue: LyricCue | null = null;

  for (const cue of cues) {
    if (timeMs >= cue.startMs && timeMs < cue.endMs) {
      currentCue = cue;
      continue;
    }

    if (cue.endMs <= timeMs) {
      previousCue = cue;
      continue;
    }

    if (cue.startMs > timeMs) {
      nextCue = cue;
      break;
    }
  }

  if (currentCue) {
    const currentIndex = cues.findIndex((cue) => cue.index === currentCue?.index);
    previousCue = currentIndex > 0 ? cues[currentIndex - 1] ?? null : null;
    nextCue = currentIndex >= 0 ? cues[currentIndex + 1] ?? null : nextCue;
  }

  return {
    currentCue,
    previousCue,
    nextCue
  };
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function getPreviewSessionKey(
  request: RenderPreviewRequest,
  width = getPreviewSize(request.video?.width, request.video?.height).width,
  height = getPreviewSize(request.video?.width, request.video?.height).height
) {
  return JSON.stringify({
    audioPath: request.audioPath,
    subtitlePath: request.subtitlePath,
    scene: request.scene,
    video: {
      width,
      height,
      fps: request.video?.fps
    }
  });
}

function getPreviewVideoSettings(request: RenderPreviewRequest) {
  const previewSize = getPreviewSize(request.video?.width, request.video?.height);
  return {
    ...request.video,
    width: previewSize.width,
    height: previewSize.height
  };
}

function getPreviewSize(width = PREVIEW_MAX_WIDTH * 2, height = PREVIEW_MAX_HEIGHT * 2) {
  const safeWidth = Math.max(1, width);
  const safeHeight = Math.max(1, height);
  const scale = Math.min(1, PREVIEW_MAX_WIDTH / safeWidth, PREVIEW_MAX_HEIGHT / safeHeight);
  return {
    width: Math.max(2, Math.round((safeWidth * scale) / 2) * 2),
    height: Math.max(2, Math.round((safeHeight * scale) / 2) * 2)
  };
}

function roundPreviewMs(value: number) {
  return Number(value.toFixed(2));
}
