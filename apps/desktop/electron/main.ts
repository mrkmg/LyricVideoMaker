import { join } from "node:path";
import { app, BrowserWindow } from "electron";
import { createMainWindow } from "./app/create-window";
import { getAppRootDir } from "./app/app-paths";
import { previewProfilerEnabled } from "./app/preview-profiler";
import { registerIpcHandlers } from "./ipc/register-ipc-handlers";
import { PreviewWorkerClient } from "./services/preview/worker-client";
import { createRenderHistory } from "./services/render-history";
import { createSceneCatalog } from "./services/scene-catalog";
import { loadUserScenes } from "./services/scene-library";
import { createSubtitleGenerationRunner } from "./services/subtitle-generator";

let mainWindow: BrowserWindow | null = null;

const previewWorkerClient = new PreviewWorkerClient({
  workerPath: join(__dirname, "preview-worker-thread.js")
});
const subtitleGenerationRunner = createSubtitleGenerationRunner({
  rootDir: getAppRootDir()
});
const renderHistory = createRenderHistory();
const sceneCatalog = createSceneCatalog();

function openMainWindow() {
  mainWindow = createMainWindow({
    onClosed: () => {
      mainWindow = null;
      void previewWorkerClient.disposePreview();
    }
  });
}

app.whenReady().then(async () => {
  sceneCatalog.replaceAll(await loadUserScenes(app.getPath("userData")));
  previewWorkerClient.start();

  registerIpcHandlers({
    getMainWindow: () => mainWindow,
    getUserDataPath: () => app.getPath("userData"),
    previewWorkerClient,
    subtitleGenerationRunner,
    renderHistory,
    sceneCatalog,
    previewProfilerEnabled
  });

  openMainWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      openMainWindow();
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
