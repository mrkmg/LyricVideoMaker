import {
  createLyricRuntime,
  type RenderJob,
  type SceneComponentDefinition
} from "@lyric-video-maker/core";
import { throwIfAborted } from "../abort";
import { createAudioAnalysisAccessor } from "../audio-analysis";
import { createAssetAccessor, preloadSceneAssets } from "../assets/preload";
import { createLiveDomRenderSession } from "../browser/live-dom-session";
import { shouldUseBeginFrame } from "../browser/chromium-loader";
import { canRenderWithLiveDom, createLiveDomScenePayload } from "../live-dom";
import { createRenderLogger } from "../logging";
import { createPreviewProfiler, measurePreviewStage } from "../profiling";
import { prepareSceneComponents } from "../scene-prep/prepare-components";
import {
  NOOP_PROGRESS_EMITTER,
  type FramePreviewSession,
  type PreviewAssetCache,
  type PreviewComputationCache
} from "../types";

export interface CreateFramePreviewSessionInput {
  job: RenderJob;
  componentDefinitions: SceneComponentDefinition<Record<string, unknown>>[];
  signal?: AbortSignal;
  assetCache?: PreviewAssetCache;
  previewCache?: PreviewComputationCache;
}

export async function createFramePreviewSession({
  job,
  componentDefinitions,
  signal,
  assetCache,
  previewCache
}: CreateFramePreviewSessionInput): Promise<FramePreviewSession> {
  const logger = createRenderLogger(job.id, NOOP_PROGRESS_EMITTER);
  const previewProfiler = createPreviewProfiler(job.id);
  const componentLookup = new Map(componentDefinitions.map((component) => [component.id, component]));
  const enabledComponents = job.components.filter((component) => component.enabled);
  const effectiveAssetCache = previewCache?.assetBodies ?? assetCache;
  const preloadedAssets = await measurePreviewStage(previewProfiler, "preloadSceneAssets", async () =>
    await preloadSceneAssets(
      enabledComponents,
      componentLookup,
      job.video,
      logger,
      signal,
      effectiveAssetCache
    )
  );
  const assets = createAssetAccessor(enabledComponents, preloadedAssets);
  const audio = createAudioAnalysisAccessor({
    audioPath: job.audioPath,
    video: job.video,
    signal,
    logger,
    sharedCache: previewCache?.audioAnalysis
  });

  throwIfAborted(signal);

  if (!canRenderWithLiveDom(enabledComponents, componentLookup)) {
    throw new Error("One or more enabled scene components do not support the live DOM renderer.");
  }

  const initialLyricsRuntime = createLyricRuntime(job.lyrics, 0);
  const prepared = await measurePreviewStage(previewProfiler, "prepareSceneComponents", async () =>
    await prepareSceneComponents(enabledComponents, componentLookup, {
      video: job.video,
      lyrics: initialLyricsRuntime,
      assets,
      audio,
      signal,
      logger,
      prepareCache: previewCache?.prepareResults
    })
  );
  return await createLiveDomRenderSession({
    sessionLabel: "preview",
    preferBeginFrame: shouldUseBeginFrame(),
    job,
    componentLookup,
    components: enabledComponents,
    assets,
    preloadedAssets,
    prepared,
    scenePayload: createLiveDomScenePayload({
      job,
      components: enabledComponents,
      componentLookup,
      assets,
      prepared
    }),
    signal,
    logger,
    previewProfiler
  });
}
