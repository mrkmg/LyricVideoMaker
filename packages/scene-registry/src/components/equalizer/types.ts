import type React from "react";
import type { TransformOptions } from "../../shared";

export type EqualizerPlacement =
  | "bottom-center"
  | "top-center"
  | "left-center"
  | "right-center"
  | "bottom-full"
  | "top-full"
  | "center-horizontal"
  | "center-vertical";
export type EqualizerAlignment = "start" | "center" | "end";
export type EqualizerLayoutMode = "single" | "mirrored" | "split";
export type EqualizerGrowthDirection = "up" | "down" | "left" | "right" | "outward";
export type EqualizerBandDistribution = "linear" | "log";
export type EqualizerColorMode = "solid" | "gradient" | "intensity";
export type EqualizerCapStyle = "square" | "rounded";
export type EqualizerGraphMode = "bars" | "line";
export type EqualizerLineStyle = "stroke" | "area";
export type EqualizerLineBaseline =
  | "top"
  | "bottom"
  | "left"
  | "right"
  | "center-horizontal"
  | "center-vertical";

export interface EqualizerOptions extends TransformOptions {
  placement: EqualizerPlacement;
  innerPadding: number;
  alignment: EqualizerAlignment;
  graphMode: EqualizerGraphMode;
  lineStyle: EqualizerLineStyle;
  barCount: number;
  barGap: number;
  cornerRadius: number;
  minBarScale: number;
  maxBarScale: number;
  layoutMode: EqualizerLayoutMode;
  growthDirection: EqualizerGrowthDirection;
  minFrequency: number;
  maxFrequency: number;
  analysisFps: number;
  sensitivity: number;
  smoothing: number;
  attackMs: number;
  releaseMs: number;
  silenceFloor: number;
  bandDistribution: EqualizerBandDistribution;
  colorMode: EqualizerColorMode;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  opacity: number;
  backgroundPlateEnabled: boolean;
  backgroundPlateColor: string;
  backgroundPlateOpacity: number;
  glowEnabled: boolean;
  glowColor: string;
  glowStrength: number;
  shadowEnabled: boolean;
  shadowColor: string;
  shadowStrength: number;
  capStyle: EqualizerCapStyle;
}

export interface PreparedEqualizerData {
  frames: number[][];
}

export type BarPlanEntry =
  | { type: "bar"; value: number; colorIndex: number }
  | { type: "gap" };

export interface EqualizerBarStaticStyle {
  borderRadius: string;
  boxShadow: string;
  opacity: number;
}

export interface EqualizerLineStaticStyle {
  svgStyle: React.CSSProperties;
  gradientId: string;
  strokeWidth: number;
  strokeLinecap: "butt" | "round";
  filter: string;
  areaFillOpacity: number;
}

export interface EqualizerLayout {
  isHorizontal: boolean;
  lineBaseline: EqualizerLineBaseline;
  wrapperStyle: React.CSSProperties;
  plateStyle: React.CSSProperties;
  trackStyle: React.CSSProperties;
}

export interface EqualizerStaticValues {
  layout: EqualizerLayout;
  barStyle: EqualizerBarStaticStyle;
  lineStyle: EqualizerLineStaticStyle;
}
