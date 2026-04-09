import type { SceneComponentDefinition } from "@lyric-video-maker/core";
import { backgroundColorComponent } from "./background-color";
import { backgroundImageComponent } from "./background-image";
import { equalizerComponent } from "./equalizer";
import { lyricsByLineComponent } from "./lyrics-by-line";

export {
  backgroundColorComponent,
  backgroundImageComponent,
  equalizerComponent,
  lyricsByLineComponent
};

export const builtInSceneComponents: SceneComponentDefinition<Record<string, unknown>>[] = [
  backgroundImageComponent as unknown as SceneComponentDefinition<Record<string, unknown>>,
  backgroundColorComponent as unknown as SceneComponentDefinition<Record<string, unknown>>,
  lyricsByLineComponent as unknown as SceneComponentDefinition<Record<string, unknown>>,
  equalizerComponent as unknown as SceneComponentDefinition<Record<string, unknown>>
];
