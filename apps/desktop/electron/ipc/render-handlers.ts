import { dirname, join } from "node:path";
import { ipcMain } from "electron";
import { createPluginAssetUri } from "@lyric-video-maker/core";
import { builtInSceneComponents } from "@lyric-video-maker/scene-registry";
import type { StartRenderRequest } from "../../src/electron-api";
import { createPluginAssetResolver } from "../services/plugin-asset-resolver";
import {
  buildInitialRenderHistoryEntry,
  buildRenderJob,
  createAbortRegistry,
  runRenderJob
} from "../services/render-job-runner";
import {
  createAudioDurationLoader,
  createSubtitleCueLoader
} from "../shared/media-cache";
import type { IpcDeps } from "./register-ipc-handlers";

const abortRegistry = createAbortRegistry();
const getSubtitleCues = createSubtitleCueLoader();
const getAudioDuration = createAudioDurationLoader();

export function registerRenderHandlers({
  getMainWindow,
  getUserDataPath,
  previewWorkerClient,
  renderHistory,
  pluginCatalog
}: IpcDeps) {
  ipcMain.handle("render:start", async (_event, request: StartRenderRequest) => {
    await previewWorkerClient.disposePreview();

    const cues = await getSubtitleCues(request.subtitlePath);
    const durationMs = await getAudioDuration(request.audioPath);
    const componentDefinitions = [...builtInSceneComponents, ...pluginCatalog.components()];
    const pluginBundleSources = pluginCatalog.pluginBundleSources();
    const resolver = createPluginAssetResolver(() => {
      const dirs = pluginCatalog.getRepoDirs();
      dirs.set(
        "scene-registry",
        join(dirname(require.resolve("@lyric-video-maker/scene-registry")), "..")
      );
      return dirs;
    });
    const job = buildRenderJob({
      request,
      componentDefinitions,
      cues,
      durationMs,
      isPluginAssetAccessible: (pluginId, relativePath) =>
        resolver.exists(createPluginAssetUri(pluginId, relativePath))
    });

    const controller = new AbortController();
    abortRegistry.set(job.id, controller);

    const entry = buildInitialRenderHistoryEntry(job);
    renderHistory.upsert(entry);

    void runRenderJob({
      job,
      componentDefinitions,
      pluginBundleSources,
      controller,
      renderHistory,
      abortRegistry,
      getMainWindow,
      fontCacheDir: join(getUserDataPath(), "google-font-cache"),
      resolvePluginAsset: (uri) => resolver.resolve(uri)
    });

    return entry;
  });

  ipcMain.handle("render:cancel", async (_event, jobId: string) => {
    abortRegistry.get(jobId)?.abort();
  });
}
