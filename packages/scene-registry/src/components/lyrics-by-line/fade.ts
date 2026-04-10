import { clamp01 } from "../../shared/math";
import type { LyricFadeEasing, LyricsByLineOptions } from "./types";

export function getLyricOpacity(
  cueStartMs: number,
  cueEndMs: number,
  timeMs: number,
  options: Pick<
    LyricsByLineOptions,
    "fadeInDurationMs" | "fadeInEasing" | "fadeOutDurationMs" | "fadeOutEasing"
  >
) {
  const fadeInOpacity = getFadeInOpacity(cueStartMs, timeMs, options.fadeInDurationMs, options.fadeInEasing);
  const fadeOutOpacity = getFadeOutOpacity(cueEndMs, timeMs, options.fadeOutDurationMs, options.fadeOutEasing);
  return Math.max(0, Math.min(1, Math.min(fadeInOpacity, fadeOutOpacity)));
}

export function getFadeInOpacity(
  cueStartMs: number,
  timeMs: number,
  durationMs: number,
  easing: LyricFadeEasing
) {
  if (durationMs <= 0) {
    return 1;
  }

  const progress = clamp01((timeMs - cueStartMs) / durationMs);
  return easeProgress(progress, easing);
}

export function getFadeOutOpacity(
  cueEndMs: number,
  timeMs: number,
  durationMs: number,
  easing: LyricFadeEasing
) {
  if (durationMs <= 0) {
    return 1;
  }

  const remainingProgress = clamp01((cueEndMs - timeMs) / durationMs);
  return easeProgress(remainingProgress, easing);
}

export function easeProgress(progress: number, easing: LyricFadeEasing) {
  switch (easing) {
    case "ease-in":
      return progress * progress;
    case "ease-out":
      return 1 - (1 - progress) * (1 - progress);
    case "ease-in-out":
      return progress < 0.5
        ? 4 * progress * progress * progress
        : 1 - Math.pow(-2 * progress + 2, 3) / 2;
    case "linear":
    default:
      return progress;
  }
}
