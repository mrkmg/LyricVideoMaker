import { clamp01 } from "../../shared/math";
import { withAlpha } from "../../shared/color";
import { measureSingleLineWidth } from "./measurement";
import type { LyricsByLineOptions } from "./types";

export function getRenderedLyricText(lines: string[], fallbackText: string, forceSingleLine: boolean) {
  if (!forceSingleLine) {
    return fallbackText;
  }

  return lines
    .map((line) => line.trim())
    .filter(Boolean)
    .join(" ");
}

export function getRenderedLyricFontSize(
  text: string,
  options: Pick<LyricsByLineOptions, "lyricSize" | "forceSingleLine" | "lyricFont">,
  videoWidth: number,
  horizontalPadding: number,
  paintPadding: number
) {
  if (!options.forceSingleLine || !text.trim()) {
    return options.lyricSize;
  }

  const availableWidth = Math.max(160, videoWidth - horizontalPadding * 2 - paintPadding * 2);
  const measuredWidthAtBaseSize = measureSingleLineWidth(text, options.lyricFont, options.lyricSize);

  if (measuredWidthAtBaseSize <= availableWidth) {
    return options.lyricSize;
  }

  return Math.max(12, Math.floor(((options.lyricSize * availableWidth) / measuredWidthAtBaseSize) * 10) / 10);
}

export function createTextShadow(fontSize: number, color: string, intensity: number) {
  const blur = Math.max(2, Math.round((fontSize * 0.24 * intensity) / 100));
  const offsetY = Math.max(1, Math.round((fontSize * 0.08 * intensity) / 100));
  const sharpness = Math.max(1, Math.round((fontSize * 0.02 * intensity) / 100));
  const shadowAlpha = clamp01(intensity / 100);
  const ambientAlpha = clamp01(shadowAlpha * 0.45);

  return [
    `0 ${offsetY}px ${blur}px ${withAlpha(color, shadowAlpha)}`,
    `0 0 ${sharpness}px ${withAlpha(color, Math.min(1, shadowAlpha + 0.2))}`,
    `0 0 ${blur + sharpness * 2}px ${withAlpha(color, ambientAlpha)}`
  ].join(", ");
}

export function getLyricPaintPadding(
  fontSize: number,
  options: Pick<LyricsByLineOptions, "borderEnabled" | "borderThickness" | "shadowEnabled" | "shadowIntensity">
) {
  const shadowPadding =
    options.shadowEnabled && options.shadowIntensity > 0
      ? Math.ceil((fontSize * 0.24 * options.shadowIntensity) / 100) +
        Math.ceil((fontSize * 0.08 * options.shadowIntensity) / 100)
      : 0;
  const strokePadding = options.borderEnabled ? Math.ceil(options.borderThickness) : 0;
  return Math.max(2, shadowPadding + strokePadding);
}
