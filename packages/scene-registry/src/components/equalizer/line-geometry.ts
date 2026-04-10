import { clamp01 } from "../../shared/math";
import type { EqualizerLineBaseline } from "./types";

export function buildLineGeometry(values: number[], baseline: EqualizerLineBaseline) {
  const safeValues = values.length > 0 ? values : [0];
  const points = safeValues.map((value, index) => {
    const progress = safeValues.length <= 1 ? 0.5 : index / (safeValues.length - 1);
    const amplitude = clamp01(value);

    switch (baseline) {
      case "top":
        return { x: progress * 100, y: amplitude * 100 };
      case "left":
        return { x: amplitude * 100, y: progress * 100 };
      case "right":
        return { x: 100 - amplitude * 100, y: progress * 100 };
      case "center-horizontal":
        return { x: progress * 100, y: 50 - amplitude * 50 };
      case "center-vertical":
        return { x: 50 + amplitude * 50, y: progress * 100 };
      case "bottom":
      default:
        return { x: progress * 100, y: 100 - amplitude * 100 };
    }
  });

  const linePath = pointsToPath(points);
  const areaPath = buildAreaPath(points, baseline);

  return {
    points,
    linePath,
    areaPath,
    gradientAxis: getLineGradientAxis(baseline)
  };
}

export function pointsToPath(points: Array<{ x: number; y: number }>) {
  return points
    .map((point, index) => `${index === 0 ? "M" : "L"} ${point.x.toFixed(3)} ${point.y.toFixed(3)}`)
    .join(" ");
}

export function buildAreaPath(points: Array<{ x: number; y: number }>, baseline: EqualizerLineBaseline) {
  const linePath = pointsToPath(points);
  const firstPoint = points[0];
  const lastPoint = points[points.length - 1];

  switch (baseline) {
    case "top":
      return `${linePath} L ${lastPoint.x.toFixed(3)} 0 L ${firstPoint.x.toFixed(3)} 0 Z`;
    case "left":
      return `${linePath} L 0 ${lastPoint.y.toFixed(3)} L 0 ${firstPoint.y.toFixed(3)} Z`;
    case "right":
      return `${linePath} L 100 ${lastPoint.y.toFixed(3)} L 100 ${firstPoint.y.toFixed(3)} Z`;
    case "center-horizontal":
      return `${linePath} L ${lastPoint.x.toFixed(3)} 50 L ${firstPoint.x.toFixed(3)} 50 Z`;
    case "center-vertical":
      return `${linePath} L 50 ${lastPoint.y.toFixed(3)} L 50 ${firstPoint.y.toFixed(3)} Z`;
    case "bottom":
    default:
      return `${linePath} L ${lastPoint.x.toFixed(3)} 100 L ${firstPoint.x.toFixed(3)} 100 Z`;
  }
}

export function getLineGradientAxis(baseline: EqualizerLineBaseline) {
  if (baseline === "left" || baseline === "right" || baseline === "center-vertical") {
    return {
      x1: 0,
      y1: 0,
      x2: 0,
      y2: 100
    };
  }

  return {
    x1: 0,
    y1: 0,
    x2: 100,
    y2: 0
  };
}

export function buildGradientStops(colors: string[]) {
  if (colors.length <= 1) {
    return [{ offset: "0%", color: colors[0] ?? "#ffffff" }];
  }

  return colors.map((color, index) => ({
    offset: `${(index / (colors.length - 1)) * 100}%`,
    color
  }));
}
