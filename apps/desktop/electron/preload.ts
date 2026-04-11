import { contextBridge, ipcRenderer } from "electron";
import type { ElectronApi } from "../src/electron-api";

const api: ElectronApi = {
  getBootstrapData: () => ipcRenderer.invoke("app:get-bootstrap-data"),
  pickPath: (kind, suggestedName, outputEncoding) =>
    ipcRenderer.invoke("dialog:pick-path", { kind, suggestedName, outputEncoding }),
  startRender: (request) => ipcRenderer.invoke("render:start", request),
  renderPreviewFrame: (request) => ipcRenderer.invoke("preview:render-frame", request),
  startSubtitleGeneration: (request) => ipcRenderer.invoke("subtitle:start-generation", request),
  cancelSubtitleGeneration: () => ipcRenderer.invoke("subtitle:cancel-generation"),
  saveScene: (scene) => ipcRenderer.invoke("scene:save", scene),
  deleteScene: (sceneId) => ipcRenderer.invoke("scene:delete", sceneId),
  importScene: () => ipcRenderer.invoke("scene:import"),
  exportScene: (scene) => ipcRenderer.invoke("scene:export", scene),
  savePaneLayout: (panes) => ipcRenderer.invoke("layout:save-pane-layout", panes),
  disposePreview: () => ipcRenderer.invoke("preview:dispose"),
  cancelRender: (jobId) => ipcRenderer.invoke("render:cancel", jobId),
  onRenderProgress: (callback) => {
    const listener = (_event: Electron.IpcRendererEvent, payload: Parameters<typeof callback>[0]) => {
      callback(payload);
    };

    ipcRenderer.on("render:progress", listener);

    return () => {
      ipcRenderer.removeListener("render:progress", listener);
    };
  },
  onSubtitleGenerationProgress: (callback) => {
    const listener = (_event: Electron.IpcRendererEvent, payload: Parameters<typeof callback>[0]) => {
      callback(payload);
    };

    ipcRenderer.on("subtitle:progress", listener);

    return () => {
      ipcRenderer.removeListener("subtitle:progress", listener);
    };
  }
};

contextBridge.exposeInMainWorld("lyricVideoApp", api);
