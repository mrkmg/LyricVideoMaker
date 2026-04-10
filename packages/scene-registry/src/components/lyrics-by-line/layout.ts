import { DEFAULT_VIDEO_HEIGHT, DEFAULT_VIDEO_WIDTH } from "@lyric-video-maker/core";
import { safeScale } from "../../shared/math";
import { lyricBlockStyleCache, lyricScaledLayoutCache, setCachedValue } from "./caches";
import {
  LYRIC_VERTICAL_INSET,
  type LyricScale,
  type LyricVerticalPosition,
  type LyricsByLineOptions,
  type ScaledLyricLayout
} from "./types";

export function getLyricBlockStyles(
  position: LyricVerticalPosition,
  horizontalPadding: number,
  verticalInset: number
) {
  const cacheKey = `${position}:${horizontalPadding}:${verticalInset}`;
  const cached = lyricBlockStyleCache.get(cacheKey);
  if (cached) {
    return cached;
  }

  const nextValue = createLyricBlockStyles(position, horizontalPadding, verticalInset);
  setCachedValue(lyricBlockStyleCache, cacheKey, nextValue);
  return nextValue;
}

export function createLyricBlockStyles(
  position: LyricVerticalPosition,
  horizontalPadding: number,
  verticalInset: number
) {
  switch (position) {
    case "top":
      return {
        alignItems: "flex-start" as const,
        padding: `${verticalInset}px ${horizontalPadding}px 0`,
        horizontalPadding
      };
    case "middle":
      return {
        alignItems: "center" as const,
        padding: `0 ${horizontalPadding}px`,
        horizontalPadding
      };
    case "bottom":
    default:
      return {
        alignItems: "flex-end" as const,
        padding: `0 ${horizontalPadding}px ${verticalInset}px`,
        horizontalPadding
      };
  }
}

export function getScaledLyricLayout(
  video: { width: number; height: number },
  options: Pick<LyricsByLineOptions, "lyricSize" | "horizontalPadding" | "borderThickness">
): ScaledLyricLayout {
  const cacheKey = JSON.stringify({
    width: video.width,
    height: video.height,
    lyricSize: options.lyricSize,
    horizontalPadding: options.horizontalPadding,
    borderThickness: options.borderThickness
  });
  const cached = lyricScaledLayoutCache.get(cacheKey);
  if (cached) {
    return cached;
  }

  const scale = getLyricScale(video);

  const nextValue = {
    lyricSize: scaleMeasurement(options.lyricSize, scale.uniform),
    horizontalPadding: scaleMeasurement(options.horizontalPadding, scale.horizontal),
    verticalInset: scaleMeasurement(LYRIC_VERTICAL_INSET, scale.vertical),
    borderThickness: scaleMeasurement(options.borderThickness, scale.uniform)
  };
  setCachedValue(lyricScaledLayoutCache, cacheKey, nextValue);
  return nextValue;
}

export function getLyricScale(video: { width: number; height: number }): LyricScale {
  const horizontal = safeScale(video.width, DEFAULT_VIDEO_WIDTH);
  const vertical = safeScale(video.height, DEFAULT_VIDEO_HEIGHT);

  return {
    horizontal,
    vertical,
    uniform: Math.min(horizontal, vertical)
  };
}

export function scaleMeasurement(value: number, scale: number) {
  return Math.round(value * scale * 10) / 10;
}
