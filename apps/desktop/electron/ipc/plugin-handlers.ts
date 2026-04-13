import { ipcMain } from "electron";
import { builtInSceneComponents, builtInScenes } from "@lyric-video-maker/scene-registry";
import { createBootstrapData } from "../services/bootstrap-data";
import {
  importPluginFromSource,
  loadInstalledPlugins,
  removePlugin,
  updatePlugin
} from "../services/plugin-library";
import type { IpcDeps } from "./register-ipc-handlers";

export function registerPluginHandlers({
  getUserDataPath,
  previewWorkerClient,
  renderHistory,
  sceneCatalog,
  pluginCatalog,
  layoutPreferencesStore,
  previewProfilerEnabled,
  ffmpegAvailability
}: IpcDeps) {
  ipcMain.handle("plugin:list", () => pluginCatalog.list());

  ipcMain.handle("plugin:import", async (_event, url: string) => {
    const plugin = await importPluginFromSource(getUserDataPath(), url, {
      existingComponentIds: [
        ...builtInSceneComponents.map((component) => component.id),
        ...pluginCatalog.components().map((component) => component.id)
      ],
      existingSceneIds: [
        ...builtInScenes.map((scene) => scene.id),
        ...pluginCatalog.scenes().map((scene) => scene.id),
        ...sceneCatalog.list().map((scene) => scene.id)
      ]
    });
    pluginCatalog.upsert(plugin);
    await previewWorkerClient.disposePreview();
    return createBootstrapData({
      renderHistory,
      sceneCatalog,
      pluginCatalog,
      layoutPreferencesStore,
      previewProfilerEnabled,
      ffmpegAvailability
    });
  });

  ipcMain.handle("plugin:update", async (_event, pluginId: string) => {
    // Temporarily remove from catalog so the updating plugin's IDs
    // are excluded from the conflict check.
    pluginCatalog.remove(pluginId);
    try {
      const plugin = await updatePlugin(getUserDataPath(), pluginId, {
        existingComponentIds: [
          ...builtInSceneComponents.map((component) => component.id),
          ...pluginCatalog.components().map((component) => component.id)
        ],
        existingSceneIds: [
          ...builtInScenes.map((scene) => scene.id),
          ...pluginCatalog.scenes().map((scene) => scene.id),
          ...sceneCatalog.list().map((scene) => scene.id)
        ]
      });
      pluginCatalog.upsert(plugin);
    } catch (error) {
      // Restore catalog from disk since we removed the plugin entry.
      pluginCatalog.replaceAll(
        await loadInstalledPlugins(getUserDataPath(), {
          existingSceneIds: sceneCatalog.list().map((scene) => scene.id)
        })
      );
      throw error;
    }
    await previewWorkerClient.disposePreview();
    return createBootstrapData({
      renderHistory,
      sceneCatalog,
      pluginCatalog,
      layoutPreferencesStore,
      previewProfilerEnabled,
      ffmpegAvailability
    });
  });

  ipcMain.handle("plugin:remove", async (_event, pluginId: string) => {
    await removePlugin(getUserDataPath(), pluginId);
    pluginCatalog.remove(pluginId);
    await previewWorkerClient.disposePreview();
    return createBootstrapData({
      renderHistory,
      sceneCatalog,
      pluginCatalog,
      layoutPreferencesStore,
      previewProfilerEnabled,
      ffmpegAvailability
    });
  });
}
