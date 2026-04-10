import {
  createLyricRuntime,
  type PreparedSceneStackData,
  type RenderJob,
  type SceneAssetAccessor,
  type SceneComponentDefinition,
  type ValidatedSceneComponentInstance
} from "@lyric-video-maker/core";
import type { createAudioAnalysisAccessor } from "../audio-analysis";
import type { PreviewPrepareCache, RenderLogger } from "../types";
import { getComponentPrepareCacheKey } from "./cache-keys";

export async function prepareSceneComponents(
  components: ValidatedSceneComponentInstance[],
  componentLookup: Map<string, SceneComponentDefinition<Record<string, unknown>>>,
  context: {
    video: RenderJob["video"];
    lyrics: ReturnType<typeof createLyricRuntime>;
    assets: SceneAssetAccessor;
    audio: ReturnType<typeof createAudioAnalysisAccessor>;
    signal?: AbortSignal;
    logger: RenderLogger;
    prepareCache?: PreviewPrepareCache;
  }
): Promise<PreparedSceneStackData> {
  const prepared: PreparedSceneStackData = {};

  for (const instance of components) {
    const definition = componentLookup.get(instance.componentId);
    if (!definition) {
      throw new Error(`Scene component definition "${instance.componentId}" is not registered.`);
    }

    const prepareContext = {
      instance,
      options: instance.options,
      video: context.video,
      lyrics: context.lyrics,
      assets: context.assets,
      audio: context.audio,
      signal: context.signal
    };
    const prepareCacheKey = getComponentPrepareCacheKey(definition, {
      instance,
      options: instance.options,
      video: context.video,
      audioPath: context.audio.path
    });
    const cachedPrepared = prepareCacheKey
      ? await loadPreparedComponentData(
          definition,
          prepareContext,
          prepareCacheKey,
          context.prepareCache
        )
      : await definition.prepare?.(prepareContext);

    prepared[instance.id] = cachedPrepared ?? {};

    context.logger.info(`Prepared component "${instance.componentName}" (${instance.id}).`);
  }

  return prepared;
}

export async function loadPreparedComponentData(
  definition: SceneComponentDefinition<Record<string, unknown>>,
  context: {
    instance: ValidatedSceneComponentInstance;
    options: Record<string, unknown>;
    video: RenderJob["video"];
    lyrics: ReturnType<typeof createLyricRuntime>;
    assets: SceneAssetAccessor;
    audio: ReturnType<typeof createAudioAnalysisAccessor>;
    signal?: AbortSignal;
  },
  cacheKey: string,
  prepareCache?: PreviewPrepareCache
) {
  if (!prepareCache) {
    return await definition.prepare?.(context);
  }

  const cached = prepareCache.get(cacheKey);
  if (cached) {
    return await cached;
  }

  const pending =
    definition
      .prepare?.(context)
      .then((value) => value ?? {}) ?? Promise.resolve<Record<string, unknown>>({});
  prepareCache.set(cacheKey, pending);

  try {
    return await pending;
  } catch (error) {
    prepareCache.delete(cacheKey);
    throw error;
  }
}
