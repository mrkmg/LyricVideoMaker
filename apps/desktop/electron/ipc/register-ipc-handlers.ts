import type { BrowserWindow } from "electron";
import type { PreviewWorkerClient } from "../services/preview/worker-client";
import type { RenderHistory } from "../services/render-history";
import type { SceneCatalog } from "../services/scene-catalog";
import type { SubtitleGenerationRunner } from "../services/subtitle-generator";
import { registerBootstrapHandlers } from "./bootstrap-handlers";
import { registerDialogHandlers } from "./dialog-handlers";
import { registerSceneHandlers } from "./scene-handlers";
import { registerRenderHandlers } from "./render-handlers";
import { registerSubtitleHandlers } from "./subtitle-handlers";
import { registerPreviewHandlers } from "./preview-handlers";

export interface IpcDeps {
  getMainWindow(): BrowserWindow | null;
  getUserDataPath(): string;
  previewWorkerClient: PreviewWorkerClient;
  subtitleGenerationRunner: SubtitleGenerationRunner;
  renderHistory: RenderHistory;
  sceneCatalog: SceneCatalog;
  previewProfilerEnabled: boolean;
}

export function registerIpcHandlers(deps: IpcDeps) {
  registerBootstrapHandlers(deps);
  registerDialogHandlers(deps);
  registerSceneHandlers(deps);
  registerRenderHandlers(deps);
  registerSubtitleHandlers(deps);
  registerPreviewHandlers(deps);
}
