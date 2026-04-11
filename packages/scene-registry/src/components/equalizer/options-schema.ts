import type { SceneOptionEntry } from "@lyric-video-maker/core";
import { transformCategory } from "../../shared";
import type { EqualizerOptions } from "./types";

export const equalizerOptionsSchema: SceneOptionEntry[] = [
  {
    type: "category",
    id: "layout",
    label: "Layout",
    options: [
      {
        type: "select",
        id: "placement",
        label: "Orientation",
        defaultValue: "bottom-center",
        options: [
          { label: "Bottom Center", value: "bottom-center" },
          { label: "Top Center", value: "top-center" },
          { label: "Left Center", value: "left-center" },
          { label: "Right Center", value: "right-center" },
          { label: "Bottom Full", value: "bottom-full" },
          { label: "Top Full", value: "top-full" },
          { label: "Center Horizontal", value: "center-horizontal" },
          { label: "Center Vertical", value: "center-vertical" }
        ]
      },
      { type: "number", id: "innerPadding", label: "Inner Padding", defaultValue: 24, min: 0, max: 160, step: 1 },
      {
        type: "select",
        id: "alignment",
        label: "Alignment",
        defaultValue: "center",
        options: [
          { label: "Start", value: "start" },
          { label: "Center", value: "center" },
          { label: "End", value: "end" }
        ]
      }
    ]
  },
  transformCategory,
  {
    type: "category",
    id: "graph",
    label: "Graph",
    options: [
      {
        type: "select",
        id: "graphMode",
        label: "Graph Mode",
        defaultValue: "bars",
        options: [
          { label: "Bars", value: "bars" },
          { label: "Line", value: "line" }
        ]
      },
      {
        type: "select",
        id: "lineStyle",
        label: "Line Style",
        defaultValue: "stroke",
        options: [
          { label: "Stroke", value: "stroke" },
          { label: "Area", value: "area" }
        ]
      }
    ]
  },
  {
    type: "category",
    id: "bars",
    label: "Bars",
    options: [
      { type: "number", id: "barCount", label: "Bar Count", defaultValue: 28, min: 4, max: 128, step: 1 },
      { type: "number", id: "barGap", label: "Bar Gap", defaultValue: 6, min: 0, max: 36, step: 1 },
      { type: "number", id: "cornerRadius", label: "Corner Radius", defaultValue: 999, min: 0, max: 999, step: 1 },
      { type: "number", id: "minBarScale", label: "Min Bar Scale", defaultValue: 12, min: 0, max: 100, step: 1 },
      { type: "number", id: "maxBarScale", label: "Max Bar Scale", defaultValue: 100, min: 1, max: 100, step: 1 },
      {
        type: "select",
        id: "layoutMode",
        label: "Layout Mode",
        defaultValue: "mirrored",
        options: [
          { label: "Single", value: "single" },
          { label: "Mirrored", value: "mirrored" },
          { label: "Split", value: "split" }
        ]
      },
      {
        type: "select",
        id: "growthDirection",
        label: "Growth Direction",
        defaultValue: "outward",
        options: [
          { label: "Up", value: "up" },
          { label: "Down", value: "down" },
          { label: "Left", value: "left" },
          { label: "Right", value: "right" },
          { label: "Outward", value: "outward" }
        ]
      }
    ]
  },
  {
    type: "category",
    id: "audio-response",
    label: "Audio Response",
    defaultExpanded: false,
    options: [
      { type: "number", id: "minFrequency", label: "Min Frequency", defaultValue: 40, min: 20, max: 8000, step: 1 },
      { type: "number", id: "maxFrequency", label: "Max Frequency", defaultValue: 3200, min: 40, max: 10000, step: 1 },
      { type: "number", id: "analysisFps", label: "Analysis FPS", defaultValue: 48, min: 10, max: 120, step: 1 },
      { type: "number", id: "sensitivity", label: "Sensitivity", defaultValue: 1.4, min: 0.1, max: 4, step: 0.1 },
      { type: "number", id: "smoothing", label: "Smoothing", defaultValue: 35, min: 0, max: 95, step: 1 },
      { type: "number", id: "attackMs", label: "Attack (ms)", defaultValue: 35, min: 0, max: 1000, step: 1 },
      { type: "number", id: "releaseMs", label: "Release (ms)", defaultValue: 240, min: 0, max: 2500, step: 1 },
      { type: "number", id: "silenceFloor", label: "Silence Floor", defaultValue: 8, min: 0, max: 95, step: 1 },
      {
        type: "select",
        id: "bandDistribution",
        label: "Band Distribution",
        defaultValue: "log",
        options: [
          { label: "Linear", value: "linear" },
          { label: "Log", value: "log" }
        ]
      }
    ]
  },
  {
    type: "category",
    id: "colors",
    label: "Colors",
    defaultExpanded: false,
    options: [
      {
        type: "select",
        id: "colorMode",
        label: "Color Mode",
        defaultValue: "gradient",
        options: [
          { label: "Solid", value: "solid" },
          { label: "Gradient", value: "gradient" },
          { label: "Intensity", value: "intensity" }
        ]
      },
      { type: "color", id: "primaryColor", label: "Primary Color", defaultValue: "#7DE2FF" },
      { type: "color", id: "secondaryColor", label: "Secondary Color", defaultValue: "#00A8E8" },
      { type: "color", id: "accentColor", label: "Accent Color", defaultValue: "#FDE74C" },
      { type: "number", id: "opacity", label: "Opacity", defaultValue: 85, min: 0, max: 100, step: 1 },
      { type: "boolean", id: "backgroundPlateEnabled", label: "Enable Background Plate", defaultValue: false },
      { type: "color", id: "backgroundPlateColor", label: "Background Plate Color", defaultValue: "#050816" },
      { type: "number", id: "backgroundPlateOpacity", label: "Background Plate Opacity", defaultValue: 55, min: 0, max: 100, step: 1 }
    ]
  },
  {
    type: "category",
    id: "effects",
    label: "Effects",
    defaultExpanded: false,
    options: [
      { type: "boolean", id: "glowEnabled", label: "Enable Glow", defaultValue: true },
      { type: "color", id: "glowColor", label: "Glow Color", defaultValue: "#7DE2FF" },
      { type: "number", id: "glowStrength", label: "Glow Strength", defaultValue: 60, min: 0, max: 100, step: 1 },
      { type: "boolean", id: "shadowEnabled", label: "Enable Shadow", defaultValue: false },
      { type: "color", id: "shadowColor", label: "Shadow Color", defaultValue: "#020611" },
      { type: "number", id: "shadowStrength", label: "Shadow Strength", defaultValue: 35, min: 0, max: 100, step: 1 },
      {
        type: "select",
        id: "capStyle",
        label: "Cap Style",
        defaultValue: "rounded",
        options: [
          { label: "Square", value: "square" },
          { label: "Rounded", value: "rounded" }
        ]
      }
    ]
  }
];

export const equalizerDefaultOptions: EqualizerOptions = {
  x: 50,
  y: 98,
  width: 56,
  height: 14,
  anchor: "bottom-center",
  rotation: 0,
  flipHorizontal: false,
  flipVertical: false,
  placement: "bottom-center",
  innerPadding: 24,
  alignment: "center",
  graphMode: "bars",
  lineStyle: "stroke",
  barCount: 28,
  barGap: 6,
  cornerRadius: 999,
  minBarScale: 12,
  maxBarScale: 100,
  layoutMode: "mirrored",
  growthDirection: "outward",
  minFrequency: 40,
  maxFrequency: 3200,
  analysisFps: 48,
  sensitivity: 1.4,
  smoothing: 35,
  attackMs: 35,
  releaseMs: 240,
  silenceFloor: 8,
  bandDistribution: "log",
  colorMode: "gradient",
  primaryColor: "#7DE2FF",
  secondaryColor: "#00A8E8",
  accentColor: "#FDE74C",
  opacity: 85,
  backgroundPlateEnabled: false,
  backgroundPlateColor: "#050816",
  backgroundPlateOpacity: 55,
  glowEnabled: true,
  glowColor: "#7DE2FF",
  glowStrength: 60,
  shadowEnabled: false,
  shadowColor: "#020611",
  shadowStrength: 35,
  capStyle: "rounded"
};
