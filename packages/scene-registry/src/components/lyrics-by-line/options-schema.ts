import type { SceneOptionEntry } from "@lyric-video-maker/core";
import { SUPPORTED_FONT_FAMILIES } from "@lyric-video-maker/core";
import { transformCategory } from "../../shared";
import type { LyricsByLineOptions } from "./types";

export const lyricsByLineOptionsSchema: SceneOptionEntry[] = [
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
  transformCategory,
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
];

export const lyricsByLineDefaultOptions: LyricsByLineOptions = {
  x: 50,
  y: 50,
  width: 100,
  height: 100,
  anchor: "middle-center",
  rotation: 0,
  flipHorizontal: false,
  flipVertical: false,
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
};
