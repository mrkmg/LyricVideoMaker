import type { SceneComponentDefinition, SceneDefinition } from "@lyric-video-maker/core";
import {
  backgroundColorComponent,
  backgroundImageComponent,
  builtInSceneComponents,
  lyricsByLineComponent,
  singleImageLyricsScene
} from "./single-image-lyrics";
import { equalizerComponent } from "./equalizer";

export {
  backgroundColorComponent,
  backgroundImageComponent,
  equalizerComponent,
  builtInSceneComponents,
  lyricsByLineComponent,
  singleImageLyricsScene
};

export const builtInScenes: SceneDefinition[] = [singleImageLyricsScene];

export function getSceneDefinition(sceneId: string): SceneDefinition | undefined {
  return builtInScenes.find((scene) => scene.id === sceneId);
}

export function getSceneComponentDefinition(
  componentId: string
): SceneComponentDefinition<Record<string, unknown>> | undefined {
  return builtInSceneComponents.find((component) => component.id === componentId);
}
