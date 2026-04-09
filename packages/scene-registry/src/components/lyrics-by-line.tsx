import React from "react";
import type { SceneComponentDefinition } from "@lyric-video-maker/core";
import { SUPPORTED_FONT_FAMILIES } from "@lyric-video-maker/core";

type LyricFadeEasing = "linear" | "ease-in" | "ease-out" | "ease-in-out";
type LyricVerticalPosition = "top" | "middle" | "bottom";

export interface LyricsByLineOptions {
  lyricSize: number;
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
  options: [
    {
      type: "category",
      id: "lyrics",
      label: "Lyrics",
      options: [
        { type: "number", id: "lyricSize", label: "Lyric Size", defaultValue: 72, min: 24, max: 180, step: 1 },
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
  Component: ({ options, lyrics, timeMs }) => {
    const activeCue = lyrics.current;
    const activeText = activeCue?.text ?? "";
    const lyricOpacity = activeCue
      ? getLyricOpacity(activeCue.startMs, activeCue.endMs, timeMs, options)
      : 0;
    const lyricBlockStyles = getLyricBlockStyles(options.lyricPosition);
    const letterShadow =
      options.shadowEnabled && options.shadowIntensity > 0
        ? createTextShadow(options.lyricSize, options.shadowColor, options.shadowIntensity)
        : "none";
    const letterStroke =
      options.borderEnabled && options.borderThickness > 0
        ? `${options.borderThickness}px ${options.borderColor}`
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
            maxWidth: "100%",
            textAlign: "center",
            fontSize: options.lyricSize,
            fontWeight: 700,
            lineHeight: 1.15,
            letterSpacing: "-0.03em",
            textShadow: letterShadow,
            whiteSpace: "pre-wrap",
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

function getLyricBlockStyles(position: LyricVerticalPosition) {
  switch (position) {
    case "top":
      return {
        alignItems: "flex-start" as const,
        padding: "110px 140px 0"
      };
    case "middle":
      return {
        alignItems: "center" as const,
        padding: "0 140px"
      };
    case "bottom":
    default:
      return {
        alignItems: "flex-end" as const,
        padding: "0 140px 110px"
      };
  }
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
