import type { BrowserWindow } from "electron";
import type { PreviewWorkerClient } from "../services/preview/worker-client";
import type { LayoutPreferencesStore } from "../services/layout-preferences";
import type { PluginCatalog } from "../services/plugin-catalog";
import type { RenderHistory } from "../services/render-history";
import type { SceneCatalog } from "../services/scene-catalog";
import type { SubtitleGenerationRunner } from "../services/subtitle-generator";
import { registerAppSettingsHandlers } from "./app-settings-handlers";
import { registerBootstrapHandlers } from "./bootstrap-handlers";
import { registerDialogHandlers } from "./dialog-handlers";
import { registerFileHandlers } from "./file-handlers";
import { registerSceneHandlers } from "./scene-handlers";
import { registerRenderHandlers } from "./render-handlers";
import { registerSubtitleHandlers } from "./subtitle-handlers";
import { registerPreviewHandlers } from "./preview-handlers";
import { registerLayoutHandlers } from "./layout-handlers";
import { registerPluginHandlers } from "./plugin-handlers";

export interface FfmpegAvailability {
  isAvailable(): boolean;
  setAvailable(value: boolean): void;
}

export interface IpcDeps {
  getMainWindow(): BrowserWindow | null;
  getUserDataPath(): string;
  previewWorkerClient: PreviewWorkerClient;
  subtitleGenerationRunner: SubtitleGenerationRunner;
  renderHistory: RenderHistory;
  sceneCatalog: SceneCatalog;
  pluginCatalog: PluginCatalog;
  layoutPreferencesStore: LayoutPreferencesStore;
  previewProfilerEnabled: boolean;
  ffmpegAvailability: FfmpegAvailability;
}

export function registerIpcHandlers(deps: IpcDeps) {
  registerAppSettingsHandlers(deps);
  registerBootstrapHandlers(deps);
  registerDialogHandlers(deps);
  registerFileHandlers();
  registerSceneHandlers(deps);
  registerRenderHandlers(deps);
  registerSubtitleHandlers(deps);
  registerPreviewHandlers(deps);
  registerPluginHandlers(deps);
  registerLayoutHandlers(deps);
}
