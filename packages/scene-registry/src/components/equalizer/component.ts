import type { SceneComponentDefinition } from "@lyric-video-maker/core";
import {
  getEqualizerFrameBrowserState,
  getEqualizerInitialBrowserState
} from "./browser-state";
import { equalizerDefaultOptions, equalizerOptionsSchema } from "./options-schema";
import { getEqualizerPrepareCacheKey, prepareEqualizer } from "./prepare";
import { EqualizerRenderComponent } from "./react/component";
import type { EqualizerOptions } from "./types";
import { validateEqualizerOptions } from "./validation";

export const equalizerComponent: SceneComponentDefinition<EqualizerOptions> = {
  id: "equalizer",
  name: "Equalizer",
  description: "Audio-reactive bar or line visualizer for overlay use.",
  staticWhenMarkupUnchanged: false,
  options: equalizerOptionsSchema,
  defaultOptions: equalizerDefaultOptions,
  validate: validateEqualizerOptions,
  getPrepareCacheKey: getEqualizerPrepareCacheKey,
  prepare: prepareEqualizer,
  browserRuntime: {
    runtimeId: "equalizer",
    getInitialState: getEqualizerInitialBrowserState,
    getFrameState: getEqualizerFrameBrowserState
  },
  Component: EqualizerRenderComponent
};
