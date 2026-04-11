import { ipcMain } from "electron";
import {
  SUPPORTED_FONT_FAMILIES,
  serializeSceneComponentDefinition,
  serializeSceneDefinition
} from "@lyric-video-maker/core";
import { builtInSceneComponents, builtInScenes } from "@lyric-video-maker/scene-registry";
import type { IpcDeps } from "./register-ipc-handlers";

export function registerBootstrapHandlers({
  renderHistory,
  sceneCatalog,
  layoutPreferencesStore,
  previewProfilerEnabled
}: IpcDeps) {
  ipcMain.handle("app:get-bootstrap-data", () => ({
    scenes: [
      ...builtInScenes.map((scene) => serializeSceneDefinition(scene)),
      ...sceneCatalog.list().map((scene) => serializeSceneDefinition(scene))
    ],
    components: builtInSceneComponents.map((component) =>
      serializeSceneComponentDefinition(component)
    ),
    fonts: [...SUPPORTED_FONT_FAMILIES],
    history: renderHistory.list(),
    layoutPreferences: {
      panes: layoutPreferencesStore.get().panes
    },
    previewProfilerEnabled
  }));
}
