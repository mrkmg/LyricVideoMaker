import { join } from "node:path";
import { app, BrowserWindow, screen } from "electron";
import { createMainWindow } from "./app/create-window";
import { getAppRootDir } from "./app/app-paths";
import { previewProfilerEnabled } from "./app/preview-profiler";
import {
  registerIpcHandlers,
  type FfmpegAvailability
} from "./ipc/register-ipc-handlers";
import { discoverFfmpeg } from "./services/ffmpeg-discovery";
import { promptFfmpegSetup } from "./services/ffmpeg-install-prompt";
import {
  createLayoutPreferencesStore,
  getRestorableWindowPreferences,
  type LayoutPreferencesStore
} from "./services/layout-preferences";
import { PreviewWorkerClient } from "./services/preview/worker-client";
import { createPluginCatalog } from "./services/plugin-catalog";
import { loadInstalledPluginsWithStatus } from "./services/plugin-library";
import { createRenderHistory } from "./services/render-history";
import { createSceneCatalog } from "./services/scene-catalog";
import { loadUserScenes } from "./services/scene-library";
import { createSubtitleGenerationRunner } from "./services/subtitle-generator";

let mainWindow: BrowserWindow | null = null;
let isQuitting = false;
let layoutPreferencesStore: LayoutPreferencesStore | null = null;

const previewWorkerClient = new PreviewWorkerClient({
  workerPath: join(__dirname, "preview-worker-thread.js"),
  fontCacheDir: join(app.getPath("userData"), "google-font-cache"),
  userDataPath: app.getPath("userData")
});
const subtitleGenerationRunner = createSubtitleGenerationRunner({
  rootDir: getAppRootDir()
});
const renderHistory = createRenderHistory();
const sceneCatalog = createSceneCatalog();
const pluginCatalog = createPluginCatalog();

function openMainWindow() {
  const windowLayout = getRestorableWindowPreferences(
    layoutPreferencesStore?.get().window,
    screen.getAllDisplays().map((display) => display.workArea)
  );

  mainWindow = createMainWindow({
    windowLayout,
    onClosed: () => {
      mainWindow = null;
      if (!isQuitting) {
        void previewWorkerClient.disposePreview().catch((error) => {
          console.warn("Failed to dispose preview worker session.", error);
        });
      }
    }
  });
  registerWindowLayoutPersistence(mainWindow);
}

app.whenReady().then(async () => {
  layoutPreferencesStore = createLayoutPreferencesStore({
    userDataPath: app.getPath("userData")
  });
  await layoutPreferencesStore.load();
  const userScenes = await loadUserScenes(app.getPath("userData"));
  sceneCatalog.replaceAll(userScenes);
  const pluginLoadResult = await loadInstalledPluginsWithStatus(app.getPath("userData"), {
    existingSceneIds: userScenes.map((scene) => scene.id)
  });
  pluginCatalog.replaceAll(pluginLoadResult.loaded, pluginLoadResult.failed);

  const ffmpegAvailability = await initializeFfmpeg(layoutPreferencesStore);
  previewWorkerClient.start();

  registerIpcHandlers({
    getMainWindow: () => mainWindow,
    getUserDataPath: () => app.getPath("userData"),
    previewWorkerClient,
    subtitleGenerationRunner,
    renderHistory,
    sceneCatalog,
    pluginCatalog,
    layoutPreferencesStore,
    previewProfilerEnabled,
    ffmpegAvailability
  });

  openMainWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      openMainWindow();
    }
  });
});

async function initializeFfmpeg(
  store: LayoutPreferencesStore
): Promise<FfmpegAvailability> {
  const savedFfmpeg = store.get().ffmpeg;
  let discovery = await discoverFfmpeg({
    knownFfmpegPath: savedFfmpeg?.ffmpegPath,
    knownFfprobePath: savedFfmpeg?.ffprobePath
  });

  if (discovery.kind === "missing") {
    discovery = await promptFfmpegSetup({ initialReason: discovery.reason });
  }

  if (discovery.kind === "found") {
    process.env.LYRIC_VIDEO_FFMPEG_PATH = discovery.ffmpegPath;
    process.env.LYRIC_VIDEO_FFPROBE_PATH = discovery.ffprobePath;
    try {
      await store.updateFfmpeg({
        ffmpegPath: discovery.ffmpegPath,
        ffprobePath: discovery.ffprobePath
      });
    } catch (error) {
      console.warn("Failed to persist FFmpeg paths.", error);
    }
  }

  let available = discovery.kind === "found";
  return {
    isAvailable: () => available,
    setAvailable: (value) => {
      available = value;
    }
  };
}

function registerWindowLayoutPersistence(window: BrowserWindow) {
  let saveTimer: NodeJS.Timeout | null = null;

  function saveWindowLayout() {
    if (!layoutPreferencesStore || window.isDestroyed() || window.isMinimized()) {
      return;
    }

    const bounds = window.getNormalBounds();
    void layoutPreferencesStore
      .updateWindow({
        x: bounds.x,
        y: bounds.y,
        width: bounds.width,
        height: bounds.height,
        maximized: window.isMaximized()
      })
      .catch((error) => {
        console.warn("Failed to save window layout.", error);
      });
  }

  function scheduleSaveWindowLayout() {
    if (saveTimer) {
      clearTimeout(saveTimer);
    }
    saveTimer = setTimeout(() => {
      saveTimer = null;
      saveWindowLayout();
    }, 400);
  }

  window.on("resize", scheduleSaveWindowLayout);
  window.on("move", scheduleSaveWindowLayout);
  window.on("maximize", scheduleSaveWindowLayout);
  window.on("unmaximize", scheduleSaveWindowLayout);
  window.on("close", () => {
    if (saveTimer) {
      clearTimeout(saveTimer);
      saveTimer = null;
    }
    saveWindowLayout();
  });
}

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("before-quit", () => {
  isQuitting = true;
  void previewWorkerClient.close().catch((error) => {
    console.warn("Failed to close preview worker.", error);
  });
});
