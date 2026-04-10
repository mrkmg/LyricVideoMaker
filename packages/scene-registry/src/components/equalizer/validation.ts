import { validateSceneOptions, type SceneComponentDefinition } from "@lyric-video-maker/core";
import { equalizerDefaultOptions, equalizerOptionsSchema } from "./options-schema";
import type { EqualizerOptions } from "./types";

const equalizerValidationDefinition: SceneComponentDefinition<EqualizerOptions> = {
  id: "equalizer",
  name: "Equalizer",
  description: "Audio-reactive bar or line visualizer for overlay use.",
  staticWhenMarkupUnchanged: false,
  options: equalizerOptionsSchema,
  defaultOptions: equalizerDefaultOptions,
  Component: () => null
};

export function validateEqualizerOptions(raw: unknown): EqualizerOptions {
  const options = validateSceneOptions(equalizerValidationDefinition, raw);

  if (options.maxFrequency <= options.minFrequency) {
    throw new Error('"Max Frequency" must be greater than "Min Frequency".');
  }

  if (options.maxBarScale < options.minBarScale) {
    throw new Error('"Max Bar Scale" must be greater than or equal to "Min Bar Scale".');
  }

  return options;
}
