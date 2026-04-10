import type {
  SceneComponentDefinition,
  ScenePrepareCacheKeyContext
} from "@lyric-video-maker/core";

export function getComponentPrepareCacheKey(
  definition: SceneComponentDefinition<Record<string, unknown>>,
  context: ScenePrepareCacheKeyContext<Record<string, unknown>>
) {
  const key = definition.getPrepareCacheKey?.(context);
  return key ? `${definition.id}::${key}` : null;
}
