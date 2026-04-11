import type { SceneOptionCategory } from "@lyric-video-maker/core";
import {
  DEFAULT_TIMING_OPTIONS,
  DEFAULT_TRANSFORM_OPTIONS,
  timingCategory,
  transformCategory,
  type TimingOptions,
  type TransformOptions
} from "../../shared";

/** Four supported playback modes (cavekit-video-component R2). */
export type VideoPlaybackMode =
  | "sync-with-song"
  | "loop"
  | "play-once-clamp"
  | "play-once-hide";

export const VIDEO_PLAYBACK_MODE_VALUES: readonly VideoPlaybackMode[] = [
  "sync-with-song",
  "loop",
  "play-once-clamp",
  "play-once-hide"
] as const;

export type VideoFitMode = "contain" | "cover" | "fill";

/** Video component options (cavekit-video-component R2). */
export interface VideoComponentOptions extends TransformOptions, TimingOptions {
  // Source
  source: string;
  muted: boolean;

  // Playback
  playbackMode: VideoPlaybackMode;
  videoStartOffsetMs: number;
  playbackSpeed: number;

  // Fit
  fitMode: VideoFitMode;
  cornerRadius: number;

  // Appearance
  opacity: number;
  tintEnabled: boolean;
  tintColor: string;
  tintStrength: number;
  grayscale: number;
  blur: number;
  brightness: number;
  contrast: number;
  saturation: number;

  // Effects
  borderEnabled: boolean;
  borderColor: string;
  borderThickness: number;
  shadowEnabled: boolean;
  shadowColor: string;
  shadowBlur: number;
  shadowOffsetX: number;
  shadowOffsetY: number;
  glowEnabled: boolean;
  glowColor: string;
  glowStrength: number;
}

export const DEFAULT_VIDEO_OPTIONS: VideoComponentOptions = {
  ...DEFAULT_TRANSFORM_OPTIONS,
  ...DEFAULT_TIMING_OPTIONS,
  source: "",
  muted: true, // R4: muted defaults to true
  playbackMode: "sync-with-song",
  videoStartOffsetMs: 0,
  playbackSpeed: 1,
  fitMode: "contain",
  cornerRadius: 0,
  opacity: 100,
  tintEnabled: false,
  tintColor: "#4da3ff",
  tintStrength: 50,
  grayscale: 0,
  blur: 0,
  brightness: 100,
  contrast: 100,
  saturation: 100,
  borderEnabled: false,
  borderColor: "#ffffff",
  borderThickness: 2,
  shadowEnabled: false,
  shadowColor: "#000000",
  shadowBlur: 16,
  shadowOffsetX: 0,
  shadowOffsetY: 8,
  glowEnabled: false,
  glowColor: "#ffffff",
  glowStrength: 40
};

const sourceCategory: SceneOptionCategory = {
  type: "category",
  id: "video-source",
  label: "Source",
  defaultExpanded: true,
  options: [
    { type: "video", id: "source", label: "Video Source", required: true },
    { type: "boolean", id: "muted", label: "Muted (video audio is never mixed)", defaultValue: true }
  ]
};

const playbackCategory: SceneOptionCategory = {
  type: "category",
  id: "video-playback",
  label: "Playback",
  defaultExpanded: true,
  options: [
    {
      type: "select",
      id: "playbackMode",
      label: "Playback Mode",
      defaultValue: "sync-with-song",
      options: [
        { label: "Sync with Song", value: "sync-with-song" },
        { label: "Loop", value: "loop" },
        { label: "Play Once (Clamp)", value: "play-once-clamp" },
        { label: "Play Once (Hide)", value: "play-once-hide" }
      ]
    },
    { type: "number", id: "videoStartOffsetMs", label: "Video Start Offset (ms)", defaultValue: 0, min: 0, max: 600_000, step: 10 },
    { type: "number", id: "playbackSpeed", label: "Playback Speed", defaultValue: 1, min: 0.1, max: 8, step: 0.05 }
  ]
};

const fitCategory: SceneOptionCategory = {
  type: "category",
  id: "video-fit",
  label: "Fit",
  defaultExpanded: false,
  options: [
    {
      type: "select",
      id: "fitMode",
      label: "Fit Mode",
      defaultValue: "contain",
      options: [
        { label: "Contain", value: "contain" },
        { label: "Cover", value: "cover" },
        { label: "Fill", value: "fill" }
      ]
    },
    { type: "number", id: "cornerRadius", label: "Corner Radius", defaultValue: 0, min: 0, max: 200, step: 1 }
  ]
};

const appearanceCategory: SceneOptionCategory = {
  type: "category",
  id: "video-appearance",
  label: "Appearance",
  defaultExpanded: false,
  options: [
    { type: "number", id: "opacity", label: "Opacity", defaultValue: 100, min: 0, max: 100, step: 1 },
    { type: "boolean", id: "tintEnabled", label: "Tint Enabled", defaultValue: false },
    { type: "color", id: "tintColor", label: "Tint Color", defaultValue: "#4da3ff" },
    { type: "number", id: "tintStrength", label: "Tint Strength", defaultValue: 50, min: 0, max: 100, step: 1 },
    { type: "number", id: "grayscale", label: "Grayscale", defaultValue: 0, min: 0, max: 100, step: 1 },
    { type: "number", id: "blur", label: "Blur", defaultValue: 0, min: 0, max: 100, step: 1 },
    { type: "number", id: "brightness", label: "Brightness", defaultValue: 100, min: 0, max: 300, step: 1 },
    { type: "number", id: "contrast", label: "Contrast", defaultValue: 100, min: 0, max: 300, step: 1 },
    { type: "number", id: "saturation", label: "Saturation", defaultValue: 100, min: 0, max: 300, step: 1 }
  ]
};

const effectsCategory: SceneOptionCategory = {
  type: "category",
  id: "video-effects",
  label: "Effects",
  defaultExpanded: false,
  options: [
    { type: "boolean", id: "borderEnabled", label: "Border Enabled", defaultValue: false },
    { type: "color", id: "borderColor", label: "Border Color", defaultValue: "#ffffff" },
    { type: "number", id: "borderThickness", label: "Border Thickness", defaultValue: 2, min: 0, max: 30, step: 1 },
    { type: "boolean", id: "shadowEnabled", label: "Shadow Enabled", defaultValue: false },
    { type: "color", id: "shadowColor", label: "Shadow Color", defaultValue: "#000000" },
    { type: "number", id: "shadowBlur", label: "Shadow Blur", defaultValue: 16, min: 0, max: 200, step: 1 },
    { type: "number", id: "shadowOffsetX", label: "Shadow Offset X", defaultValue: 0, min: -200, max: 200, step: 1 },
    { type: "number", id: "shadowOffsetY", label: "Shadow Offset Y", defaultValue: 8, min: -200, max: 200, step: 1 },
    { type: "boolean", id: "glowEnabled", label: "Glow Enabled", defaultValue: false },
    { type: "color", id: "glowColor", label: "Glow Color", defaultValue: "#ffffff" },
    { type: "number", id: "glowStrength", label: "Glow Strength", defaultValue: 40, min: 0, max: 200, step: 1 }
  ]
};

/**
 * Video options schema (cavekit-video-component R3).
 *
 * Category order: Source → Playback → Transform → Fit → Appearance → Effects → Timing.
 */
export const videoOptionsSchema = [
  sourceCategory,
  playbackCategory,
  transformCategory,
  fitCategory,
  appearanceCategory,
  effectsCategory,
  timingCategory
];
