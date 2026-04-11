import type {
  SceneComponentInstance,
  SerializedSceneComponentDefinition,
  SerializedSceneDefinition
} from "@lyric-video-maker/core";
import {
  DEFAULT_RENDER_ENCODING,
  DEFAULT_RENDER_QUALITY,
  DEFAULT_RENDER_THREADS,
  DEFAULT_VIDEO_FPS,
  DEFAULT_VIDEO_HEIGHT,
  DEFAULT_VIDEO_WIDTH
} from "@lyric-video-maker/core";
import type { ComposerState } from "../state/composer-types";

export const emptyComposerState: ComposerState = {
  audioPath: "",
  subtitlePath: "",
  outputPath: "",
  scene: null,
  video: {
    width: DEFAULT_VIDEO_WIDTH,
    height: DEFAULT_VIDEO_HEIGHT,
    fps: DEFAULT_VIDEO_FPS
  },
  render: {
    threads: DEFAULT_RENDER_THREADS,
    encoding: DEFAULT_RENDER_ENCODING,
    quality: DEFAULT_RENDER_QUALITY
  }
};

export function upsertScene(
  scenes: SerializedSceneDefinition[],
  nextScene: SerializedSceneDefinition
) {
  const withoutScene = scenes.filter((scene) => scene.id !== nextScene.id);
  return [...withoutScene, nextScene].sort((left, right) => left.name.localeCompare(right.name));
}

export function cloneScene(scene: SerializedSceneDefinition): SerializedSceneDefinition {
  return structuredClone(scene);
}

export function cloneComponent(component: SceneComponentInstance): SceneComponentInstance {
  return structuredClone(component);
}

export function createSceneComponentInstance(
  component: SerializedSceneComponentDefinition
): SceneComponentInstance {
  return {
    id: createInstanceId(component.id),
    componentId: component.id,
    enabled: true,
    options: structuredClone(component.defaultOptions)
  };
}

export function createInstanceId(componentId: string) {
  return `${componentId}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}
