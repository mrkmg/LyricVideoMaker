import { mixHex } from "../../shared/color";
import { clamp01 } from "../../shared/math";
import type { EqualizerOptions } from "./types";

export function buildEqualizerColorPlan(values: number[], options: EqualizerOptions) {
  return values.map((value, index) => getBarColor(index, values.length, options, value));
}

export function getBarColor(index: number, total: number, options: EqualizerOptions, amplitude: number) {
  switch (options.colorMode) {
    case "solid":
      return options.primaryColor;
    case "intensity":
      return getIntensityColor(amplitude, options);
    case "gradient":
    default: {
      const blend = total <= 1 ? 0 : index / (total - 1);
      return index < total / 2
        ? mixHex(options.primaryColor, options.secondaryColor, blend * 2)
        : mixHex(options.secondaryColor, options.accentColor, (blend - 0.5) * 2);
    }
  }
}

export function getIntensityColor(amplitude: number, options: EqualizerOptions) {
  const safeAmplitude = clamp01(amplitude);
  return safeAmplitude <= 0.5
    ? mixHex(options.primaryColor, options.secondaryColor, safeAmplitude * 2)
    : mixHex(options.secondaryColor, options.accentColor, (safeAmplitude - 0.5) * 2);
}
