import type {
  SceneComponentDefinition,
  ValidatedSceneComponentInstance
} from "@lyric-video-maker/core";

export function areAllComponentsStaticWhenMarkupUnchanged(
  components: ValidatedSceneComponentInstance[],
  componentLookup: Map<string, SceneComponentDefinition<Record<string, unknown>>>
) {
  return components.every(
    (instance) => componentLookup.get(instance.componentId)?.staticWhenMarkupUnchanged === true
  );
}
