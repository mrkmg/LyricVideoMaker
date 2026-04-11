import { join } from "node:path";
import { app, BrowserWindow, screen } from "electron";
import { createMainWindow } from "./app/create-window";
import { getAppRootDir } from "./app/app-paths";
import { previewProfilerEnabled } from "./app/preview-profiler";
import { registerIpcHandlers } from "./ipc/register-ipc-handlers";
import {
  createLayoutPreferencesStore,
  getRestorableWindowPreferences,
  type LayoutPreferencesStore
} from "./services/layout-preferences";
import { PreviewWorkerClient } from "./services/preview/worker-client";
import { createRenderHistory } from "./services/render-history";
import { createSceneCatalog } from "./services/scene-catalog";
import { loadUserScenes } from "./services/scene-library";
import { createSubtitleGenerationRunner } from "./services/subtitle-generator";

let mainWindow: BrowserWindow | null = null;
let isQuitting = false;
let layoutPreferencesStore: LayoutPreferencesStore | null = null;

const previewWorkerClient = new PreviewWorkerClient({
  workerPath: join(__dirname, "preview-worker-thread.js")
});
const subtitleGenerationRunner = createSubtitleGenerationRunner({
  rootDir: getAppRootDir()
});
const renderHistory = createRenderHistory();
const sceneCatalog = createSceneCatalog();

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
  sceneCatalog.replaceAll(await loadUserScenes(app.getPath("userData")));
  previewWorkerClient.start();

  registerIpcHandlers({
    getMainWindow: () => mainWindow,
    getUserDataPath: () => app.getPath("userData"),
    previewWorkerClient,
    subtitleGenerationRunner,
    renderHistory,
    sceneCatalog,
    layoutPreferencesStore,
    previewProfilerEnabled
  });

  openMainWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      openMainWindow();
    }
  });
});

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
