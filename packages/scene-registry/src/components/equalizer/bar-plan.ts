import type React from "react";
import { clamp01 } from "../../shared/math";
import type {
  BarPlanEntry,
  EqualizerGrowthDirection,
  EqualizerLayoutMode,
  EqualizerOptions
} from "./types";

export function buildBarRenderPlan(
  values: number[],
  layoutMode: EqualizerLayoutMode
): BarPlanEntry[] {
  const bars = values;
  if (layoutMode !== "split" || bars.length < 2) {
    return bars.map((value, index) => ({ type: "bar", value, colorIndex: index }));
  }

  const midpoint = Math.ceil(bars.length / 2);
  return [
    ...bars.slice(0, midpoint).map((value, index) => ({ type: "bar" as const, value, colorIndex: index })),
    { type: "gap" as const },
    ...bars.slice(midpoint).map((value, index) => ({
      type: "bar" as const,
      value,
      colorIndex: midpoint + index
    }))
  ];
}

export function buildRenderableBars(values: number[], options: EqualizerOptions) {
  const fallback = new Array<number>(options.barCount).fill(options.minBarScale / 100);
  const bars = values.length === options.barCount ? values : fallback;
  return bars.map((value) => clamp01(value));
}

export function buildRenderableBarAmplitudes(values: number[], options: EqualizerOptions) {
  return buildRenderableBars(values, options).map((value) => getBarAmplitude(value, options));
}

export function getBarAmplitude(value: number, options: EqualizerOptions) {
  const minScale = clamp01(options.minBarScale / 100);
  const maxScale = clamp01(options.maxBarScale / 100);
  return minScale + (maxScale - minScale) * clamp01(value);
}

export function getSingleBarFillStyle({
  isHorizontal,
  amplitude,
  color,
  opacity,
  borderRadius,
  boxShadow,
  growthDirection
}: {
  isHorizontal: boolean;
  amplitude: number;
  color: string;
  opacity: number;
  borderRadius: string;
  boxShadow: string;
  growthDirection: EqualizerGrowthDirection;
}) {
  const style: React.CSSProperties = {
    position: "absolute",
    background: color,
    borderRadius,
    opacity,
    boxShadow
  };

  if (isHorizontal) {
    style.left = 0;
    style.right = 0;
    style.height = `${amplitude * 100}%`;

    if (growthDirection === "down") {
      style.top = 0;
    } else if (growthDirection === "outward") {
      style.top = `${50 - amplitude * 50}%`;
    } else {
      style.bottom = 0;
    }
  } else {
    style.top = 0;
    style.bottom = 0;
    style.width = `${amplitude * 100}%`;

    if (growthDirection === "left") {
      style.right = 0;
    } else if (growthDirection === "outward") {
      style.left = `${50 - amplitude * 50}%`;
    } else {
      style.left = 0;
    }
  }

  return style;
}
