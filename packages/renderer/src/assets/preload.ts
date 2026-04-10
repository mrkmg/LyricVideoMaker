import type {
  RenderJob,
  SceneAssetAccessor,
  SceneComponentDefinition,
  ValidatedSceneComponentInstance
} from "@lyric-video-maker/core";
import { ASSET_URL_PREFIX } from "../constants";
import type { PreloadedAsset, PreviewAssetCache, RenderLogger } from "../types";
import { loadCachedAssetBody } from "./cache-body";
import { getExtensionSuffix } from "./mime";

export async function preloadSceneAssets(
  components: ValidatedSceneComponentInstance[],
  componentLookup: Map<string, SceneComponentDefinition<Record<string, unknown>>>,
  video: RenderJob["video"],
  logger: RenderLogger,
  signal?: AbortSignal,
  assetCache?: PreviewAssetCache
): Promise<Map<string, PreloadedAsset>> {
  const assets = new Map<string, PreloadedAsset>();

  for (const instance of components) {
    const definition = componentLookup.get(instance.componentId);
    if (!definition) {
      throw new Error(`Scene component definition "${instance.componentId}" is not registered.`);
    }

    for (const field of definition.options) {
      if (field.type !== "image") {
        continue;
      }

      const optionValue = instance.options[field.id];
      if (typeof optionValue !== "string" || !optionValue) {
        continue;
      }

      const cachedBody = await loadCachedAssetBody(optionValue, video, signal, logger, assetCache);
      const asset = {
        instanceId: instance.id,
        optionId: field.id,
        path: optionValue,
        url: `${ASSET_URL_PREFIX}${encodeURIComponent(instance.id)}-${encodeURIComponent(field.id)}${getExtensionSuffix(optionValue)}`,
        contentType: cachedBody.contentType,
        body: cachedBody.body
      } satisfies PreloadedAsset;

      assets.set(getAssetKey(instance.id, field.id), asset);
      logger.info(
        `Preloaded image asset "${instance.id}/${field.id}" from ${optionValue}${cachedBody.normalized ? " (normalized)" : ""}`
      );
    }
  }

  return assets;
}

export function createAssetAccessor(
  components: ValidatedSceneComponentInstance[],
  preloadedAssets: Map<string, PreloadedAsset>
): SceneAssetAccessor {
  const componentLookup = new Map(components.map((component) => [component.id, component]));

  return {
    getPath(instanceId, optionId) {
      const instance = componentLookup.get(instanceId);
      if (!instance) {
        return null;
      }

      const value = instance.options[optionId];
      return typeof value === "string" ? value : null;
    },
    getUrl(instanceId, optionId) {
      return preloadedAssets.get(getAssetKey(instanceId, optionId))?.url ?? null;
    }
  };
}

export function getAssetKey(instanceId: string, optionId: string) {
  return `${instanceId}:${optionId}`;
}
