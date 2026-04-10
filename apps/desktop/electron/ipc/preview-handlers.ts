import { ipcMain } from "electron";
import type { RenderPreviewRequest } from "../../src/electron-api";
import type { IpcDeps } from "./register-ipc-handlers";

export function registerPreviewHandlers({ previewWorkerClient }: IpcDeps) {
  ipcMain.handle("preview:render-frame", async (_event, request: RenderPreviewRequest) => {
    return await previewWorkerClient.renderFrame(request);
  });

  ipcMain.handle("preview:dispose", async () => {
    await previewWorkerClient.disposePreview();
  });
}
