import { withAlpha } from "../../shared/color";
import type { EqualizerOptions } from "./types";

export function buildEqualizerShadowParts(
  options: EqualizerOptions,
  isHorizontal: boolean
) {
  const shadowParts: string[] = [];

  if (options.shadowEnabled && options.shadowStrength > 0) {
    shadowParts.push(
      isHorizontal
        ? `0 ${Math.max(2, options.shadowStrength / 8)}px ${Math.max(4, options.shadowStrength / 2)}px ${withAlpha(options.shadowColor, 0.45)}`
        : `${Math.max(2, options.shadowStrength / 8)}px 0 ${Math.max(4, options.shadowStrength / 2)}px ${withAlpha(options.shadowColor, 0.45)}`
    );
  }

  if (options.glowEnabled && options.glowStrength > 0) {
    shadowParts.push(
      `0 0 ${Math.max(6, options.glowStrength / 1.5)}px ${withAlpha(options.glowColor, 0.75)}`
    );
  }

  return shadowParts;
}

export function buildSvgFilter(shadowParts: string[]) {
  return shadowParts.length > 0 ? `drop-shadow(${shadowParts.join(") drop-shadow(")})` : "none";
}
