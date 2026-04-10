import React from "react";
import { measureNaturalWidth, prepareWithSegments } from "@chenglou/pretext";
import type { SceneComponentDefinition } from "@lyric-video-maker/core";
import {
  DEFAULT_VIDEO_HEIGHT,
  DEFAULT_VIDEO_WIDTH,
  SUPPORTED_FONT_FAMILIES
} from "@lyric-video-maker/core";

type LyricFadeEasing = "linear" | "ease-in" | "ease-out" | "ease-in-out";
type LyricVerticalPosition = "top" | "middle" | "bottom";

const LYRIC_FONT_WEIGHT = 700;
const LYRIC_LINE_HEIGHT = 1.15;
const LYRIC_LETTER_SPACING_EM = -0.03;
const LYRIC_VERTICAL_INSET = 110;
const LYRIC_LAYOUT_CACHE_LIMIT = 200;
const lyricScaledLayoutCache = new Map<string, ScaledLyricLayout>();
const lyricBlockStyleCache = new Map<string, ReturnType<typeof createLyricBlockStyles>>();
const lyricMeasurementCache = new Map<string, number>();

interface LyricScale {
  horizontal: number;
  vertical: number;
  uniform: number;
}

interface ScaledLyricLayout {
  lyricSize: number;
  horizontalPadding: number;
  verticalInset: number;
  borderThickness: number;
}

export interface LyricsByLineOptions {
  lyricSize: number;
  forceSingleLine: boolean;
  horizontalPadding: number;
  lyricFont: string;
  lyricColor: string;
  fadeInDurationMs: number;
  fadeInEasing: LyricFadeEasing;
  fadeOutDurationMs: number;
  fadeOutEasing: LyricFadeEasing;
  lyricPosition: LyricVerticalPosition;
  borderEnabled: boolean;
  borderColor: string;
  borderThickness: number;
  shadowEnabled: boolean;
  shadowColor: string;
  shadowIntensity: number;
}

export const lyricsByLineComponent: SceneComponentDefinition<LyricsByLineOptions> = {
  id: "lyrics-by-line",
  name: "Lyrics by Line",
  description: "Shows the current subtitle line with timing-aware fades and typography.",
  staticWhenMarkupUnchanged: false,
  browserRuntime: {
    runtimeId: "lyrics-by-line",
    getInitialState({ options, video }) {
      const scaledLayout = getScaledLyricLayout(video, options);
      const lyricBlockStyles = getLyricBlockStyles(
        options.lyricPosition,
        scaledLayout.horizontalPadding,
        scaledLayout.verticalInset
      );

      return {
        alignItems: lyricBlockStyles.alignItems,
        padding: lyricBlockStyles.padding,
        horizontalPadding: lyricBlockStyles.horizontalPadding,
        color: options.lyricColor,
        fontFamily: `"${options.lyricFont}", sans-serif`,
        whiteSpace: options.forceSingleLine ? "nowrap" : "pre-wrap"
      };
    },
    getFrameState({ options, lyrics, timeMs, video }) {
      const activeCue = lyrics.current;
      const scaledLayout = getScaledLyricLayout(video, options);
      const activeText = getRenderedLyricText(
        activeCue?.lines ?? [],
        activeCue?.text ?? "",
        options.forceSingleLine
      );
      const lyricBlockStyles = getLyricBlockStyles(
        options.lyricPosition,
        scaledLayout.horizontalPadding,
        scaledLayout.verticalInset
      );
      const paintPadding = getLyricPaintPadding(scaledLayout.lyricSize, {
        borderEnabled: options.borderEnabled,
        borderThickness: scaledLayout.borderThickness,
        shadowEnabled: options.shadowEnabled,
        shadowIntensity: options.shadowIntensity
      });
      const lyricFontSize = getRenderedLyricFontSize(
        activeText,
        {
          lyricSize: scaledLayout.lyricSize,
          forceSingleLine: options.forceSingleLine,
          lyricFont: options.lyricFont
        },
        video.width,
        lyricBlockStyles.horizontalPadding,
        paintPadding
      );
      const lyricOpacity = activeCue ? getLyricOpacity(activeCue.startMs, activeCue.endMs, timeMs, options) : 0;
      const renderedPaintPadding = getLyricPaintPadding(lyricFontSize, {
        borderEnabled: options.borderEnabled,
        borderThickness: scaledLayout.borderThickness,
        shadowEnabled: options.shadowEnabled,
        shadowIntensity: options.shadowIntensity
      });
      const letterShadow =
        options.shadowEnabled && options.shadowIntensity > 0
          ? createTextShadow(lyricFontSize, options.shadowColor, options.shadowIntensity)
          : "none";
      const letterStroke =
        options.borderEnabled && scaledLayout.borderThickness > 0
          ? `${scaledLayout.borderThickness}px ${options.borderColor}`
          : "";

      return {
        text: activeText,
        opacity: lyricOpacity,
        fontSize: lyricFontSize,
        padding: `${renderedPaintPadding}px`,
        textShadow: letterShadow,
        webkitTextStroke: letterStroke
      };
    }
  },
  options: [
    {
      type: "category",
      id: "lyrics",
      label: "Lyrics",
      options: [
        { type: "number", id: "lyricSize", label: "Lyric Size", defaultValue: 72, min: 24, max: 180, step: 1 },
        { type: "boolean", id: "forceSingleLine", label: "Force Single Line", defaultValue: false },
        {
          type: "number",
          id: "horizontalPadding",
          label: "Horizontal Padding",
          defaultValue: 140,
          min: 0,
          max: 480,
          step: 1
        },
        { type: "font", id: "lyricFont", label: "Lyric Font", defaultValue: SUPPORTED_FONT_FAMILIES[0] },
        { type: "color", id: "lyricColor", label: "Lyric Color", defaultValue: "#FFFFFF" },
        {
          type: "select",
          id: "lyricPosition",
          label: "Lyric Position",
          defaultValue: "bottom",
          options: [
            { label: "Top", value: "top" },
            { label: "Middle", value: "middle" },
            { label: "Bottom", value: "bottom" }
          ]
        }
      ]
    },
    {
      type: "category",
      id: "fade-in",
      label: "Fade In",
      defaultExpanded: false,
      options: [
        {
          type: "number",
          id: "fadeInDurationMs",
          label: "Fade In Time (ms)",
          defaultValue: 180,
          min: 0,
          max: 5000,
          step: 10
        },
        {
          type: "select",
          id: "fadeInEasing",
          label: "Fade In Easing",
          defaultValue: "ease-out",
          options: [
            { label: "Linear", value: "linear" },
            { label: "Ease In", value: "ease-in" },
            { label: "Ease Out", value: "ease-out" },
            { label: "Ease In Out", value: "ease-in-out" }
          ]
        }
      ]
    },
    {
      type: "category",
      id: "fade-out",
      label: "Fade Out",
      defaultExpanded: false,
      options: [
        {
          type: "number",
          id: "fadeOutDurationMs",
          label: "Fade Out Time (ms)",
          defaultValue: 180,
          min: 0,
          max: 5000,
          step: 10
        },
        {
          type: "select",
          id: "fadeOutEasing",
          label: "Fade Out Easing",
          defaultValue: "ease-in",
          options: [
            { label: "Linear", value: "linear" },
            { label: "Ease In", value: "ease-in" },
            { label: "Ease Out", value: "ease-out" },
            { label: "Ease In Out", value: "ease-in-out" }
          ]
        }
      ]
    },
    {
      type: "category",
      id: "border",
      label: "Border",
      defaultExpanded: false,
      options: [
        { type: "boolean", id: "borderEnabled", label: "Enable Border", defaultValue: false },
        { type: "color", id: "borderColor", label: "Border Color", defaultValue: "#000000" },
        {
          type: "number",
          id: "borderThickness",
          label: "Border Thickness",
          defaultValue: 4,
          min: 0,
          max: 20,
          step: 1
        }
      ]
    },
    {
      type: "category",
      id: "shadow",
      label: "Shadow",
      defaultExpanded: false,
      options: [
        { type: "boolean", id: "shadowEnabled", label: "Enable Shadow", defaultValue: true },
        { type: "color", id: "shadowColor", label: "Shadow Color", defaultValue: "#000000" },
        {
          type: "number",
          id: "shadowIntensity",
          label: "Shadow Intensity",
          defaultValue: 55,
          min: 0,
          max: 100,
          step: 1
        }
      ]
    }
  ],
  defaultOptions: {
    lyricSize: 72,
    forceSingleLine: false,
    horizontalPadding: 140,
    lyricFont: SUPPORTED_FONT_FAMILIES[0],
    lyricColor: "#FFFFFF",
    fadeInDurationMs: 180,
    fadeInEasing: "ease-out",
    fadeOutDurationMs: 180,
    fadeOutEasing: "ease-in",
    lyricPosition: "bottom",
    borderEnabled: false,
    borderColor: "#000000",
    borderThickness: 4,
    shadowEnabled: true,
    shadowColor: "#000000",
    shadowIntensity: 55
  },
  Component: ({ options, lyrics, timeMs, video }) => {
    const activeCue = lyrics.current;
    const scaledLayout = getScaledLyricLayout(video, options);
    const activeText = getRenderedLyricText(activeCue?.lines ?? [], activeCue?.text ?? "", options.forceSingleLine);
    const lyricOpacity = activeCue ? getLyricOpacity(activeCue.startMs, activeCue.endMs, timeMs, options) : 0;
    const lyricBlockStyles = getLyricBlockStyles(
      options.lyricPosition,
      scaledLayout.horizontalPadding,
      scaledLayout.verticalInset
    );
    const estimatedPaintPadding = getLyricPaintPadding(scaledLayout.lyricSize, {
      borderEnabled: options.borderEnabled,
      borderThickness: scaledLayout.borderThickness,
      shadowEnabled: options.shadowEnabled,
      shadowIntensity: options.shadowIntensity
    });
    const lyricFontSize = getRenderedLyricFontSize(
      activeText,
      {
        lyricSize: scaledLayout.lyricSize,
        forceSingleLine: options.forceSingleLine,
        lyricFont: options.lyricFont
      },
      video.width,
      lyricBlockStyles.horizontalPadding,
      estimatedPaintPadding
    );
    const paintPadding = getLyricPaintPadding(lyricFontSize, {
      borderEnabled: options.borderEnabled,
      borderThickness: scaledLayout.borderThickness,
      shadowEnabled: options.shadowEnabled,
      shadowIntensity: options.shadowIntensity
    });
    const letterShadow =
      options.shadowEnabled && options.shadowIntensity > 0
        ? createTextShadow(lyricFontSize, options.shadowColor, options.shadowIntensity)
        : "none";
    const letterStroke =
      options.borderEnabled && scaledLayout.borderThickness > 0
        ? `${scaledLayout.borderThickness}px ${options.borderColor}`
        : undefined;

    return (
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          alignItems: lyricBlockStyles.alignItems,
          justifyContent: "center",
          padding: lyricBlockStyles.padding,
          boxSizing: "border-box",
          color: options.lyricColor,
          fontFamily: `"${options.lyricFont}", sans-serif`
        }}
      >
        <div
          style={{
            display: "inline-block",
            maxWidth: "100%",
            textAlign: "center",
            fontSize: lyricFontSize,
            fontWeight: LYRIC_FONT_WEIGHT,
            lineHeight: LYRIC_LINE_HEIGHT,
            letterSpacing: `${LYRIC_LETTER_SPACING_EM}em`,
            padding: `${paintPadding}px`,
            textShadow: letterShadow,
            whiteSpace: options.forceSingleLine ? "nowrap" : "pre-wrap",
            opacity: lyricOpacity,
            WebkitTextStroke: letterStroke
          }}
        >
          {activeText}
        </div>
      </div>
    );
  }
};

export const lyricsByLineTestUtils = {
  clearCaches() {
    lyricScaledLayoutCache.clear();
    lyricBlockStyleCache.clear();
    lyricMeasurementCache.clear();
  },
  getMeasurementCacheSize() {
    return lyricMeasurementCache.size;
  }
};

function getLyricBlockStyles(
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

function createLyricBlockStyles(
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

function getScaledLyricLayout(
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

function getLyricScale(video: { width: number; height: number }): LyricScale {
  const horizontal = safeScale(video.width, DEFAULT_VIDEO_WIDTH);
  const vertical = safeScale(video.height, DEFAULT_VIDEO_HEIGHT);

  return {
    horizontal,
    vertical,
    uniform: Math.min(horizontal, vertical)
  };
}

function safeScale(value: number, baseline: number) {
  return value > 0 && baseline > 0 ? value / baseline : 1;
}

function scaleMeasurement(value: number, scale: number) {
  return Math.round(value * scale * 10) / 10;
}

function getRenderedLyricText(lines: string[], fallbackText: string, forceSingleLine: boolean) {
  if (!forceSingleLine) {
    return fallbackText;
  }

  return lines
    .map((line) => line.trim())
    .filter(Boolean)
    .join(" ");
}

function getRenderedLyricFontSize(
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

function getLyricOpacity(
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

function getFadeInOpacity(
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

function getFadeOutOpacity(
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

function easeProgress(progress: number, easing: LyricFadeEasing) {
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

function clamp01(value: number) {
  return Math.max(0, Math.min(1, value));
}

function createTextShadow(fontSize: number, color: string, intensity: number) {
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

function measureSingleLineWidth(text: string, fontFamily: string, fontSize: number) {
  const cacheKey = `${fontFamily}:${fontSize}:${text}`;
  const cached = lyricMeasurementCache.get(cacheKey);
  if (cached !== undefined) {
    return cached;
  }

  const measuredWidth = measureSingleLineWidthUncached(text, fontFamily, fontSize);
  setCachedValue(lyricMeasurementCache, cacheKey, measuredWidth);
  return measuredWidth;
}

function measureSingleLineWidthUncached(text: string, fontFamily: string, fontSize: number) {
  if (!canUsePretextMeasurement()) {
    return estimateSingleLineWidth(text, fontSize);
  }

  try {
    const prepared = prepareWithSegments(text, getMeasurementFont(fontFamily, fontSize));
    const naturalWidth = measureNaturalWidth(prepared);
    return naturalWidth + getLetterSpacingWidth(text, fontSize);
  } catch {
    return estimateSingleLineWidth(text, fontSize);
  }
}

function getMeasurementFont(fontFamily: string, fontSize: number) {
  return `${LYRIC_FONT_WEIGHT} ${fontSize}px "${fontFamily}"`;
}

function getLetterSpacingWidth(text: string, fontSize: number) {
  const graphemeCount = Array.from(text).length;
  if (graphemeCount <= 1) {
    return 0;
  }

  return (graphemeCount - 1) * fontSize * LYRIC_LETTER_SPACING_EM;
}

function estimateSingleLineWidth(text: string, fontSize: number) {
  return Array.from(text).length * fontSize * 0.58;
}

function canUsePretextMeasurement() {
  if (typeof document === "undefined") {
    return false;
  }

  return !/\bjsdom\b/i.test(globalThis.navigator?.userAgent ?? "");
}

function getLyricPaintPadding(
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

function setCachedValue<T>(cache: Map<string, T>, key: string, value: T) {
  cache.set(key, value);
  if (cache.size <= LYRIC_LAYOUT_CACHE_LIMIT) {
    return;
  }

  const firstKey = cache.keys().next().value;
  if (firstKey) {
    cache.delete(firstKey);
  }
}

function withAlpha(hexColor: string, alpha: number) {
  const normalized = hexColor.replace("#", "");
  const expanded =
    normalized.length === 3
      ? normalized
          .split("")
          .map((char) => char + char)
          .join("")
      : normalized;

  if (!/^[\da-fA-F]{6}$/.test(expanded)) {
    return hexColor;
  }

  const red = Number.parseInt(expanded.slice(0, 2), 16);
  const green = Number.parseInt(expanded.slice(2, 4), 16);
  const blue = Number.parseInt(expanded.slice(4, 6), 16);
  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
}
