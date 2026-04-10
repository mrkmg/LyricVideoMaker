import { clamp01 } from "../../shared/math";
import { getEqualizerLayout } from "./layout";
import { buildEqualizerShadowParts, buildSvgFilter } from "./shadow";
import type { EqualizerOptions, EqualizerStaticValues } from "./types";

const equalizerStaticValueCache = new Map<string, EqualizerStaticValues>();

export function getEqualizerStaticValues(
  instanceId: string,
  options: EqualizerOptions,
  barCount: number
): EqualizerStaticValues {
  const cacheKey = JSON.stringify({
    instanceId,
    placement: options.placement,
    spanPercent: options.spanPercent,
    depthPercent: options.depthPercent,
    offsetX: options.offsetX,
    offsetY: options.offsetY,
    innerPadding: options.innerPadding,
    alignment: options.alignment,
    graphMode: options.graphMode,
    lineStyle: options.lineStyle,
    barGap: options.barGap,
    layoutMode: options.layoutMode,
    growthDirection: options.growthDirection,
    colorMode: options.colorMode,
    primaryColor: options.primaryColor,
    secondaryColor: options.secondaryColor,
    accentColor: options.accentColor,
    opacity: options.opacity,
    backgroundPlateColor: options.backgroundPlateColor,
    backgroundPlateOpacity: options.backgroundPlateOpacity,
    glowEnabled: options.glowEnabled,
    glowColor: options.glowColor,
    glowStrength: options.glowStrength,
    shadowEnabled: options.shadowEnabled,
    shadowColor: options.shadowColor,
    shadowStrength: options.shadowStrength,
    capStyle: options.capStyle,
    cornerRadius: options.cornerRadius,
    barCount
  });
  const cached = equalizerStaticValueCache.get(cacheKey);
  if (cached) {
    return cached;
  }

  const layout = getEqualizerLayout(options);
  const nextValue = {
    layout,
    barStyle: {
      borderRadius: options.capStyle === "rounded" ? `${options.cornerRadius}px` : "0",
      boxShadow: buildEqualizerShadowParts(options, layout.isHorizontal).join(", ") || "none",
      opacity: clamp01(options.opacity / 100)
    },
    lineStyle: {
      svgStyle: {
        width: "100%",
        height: "100%",
        overflow: "visible"
      },
      gradientId: `equalizer-gradient-${instanceId.replace(/[^a-zA-Z0-9_-]/g, "-")}`,
      strokeWidth: options.capStyle === "rounded" ? 3 : 2.5,
      strokeLinecap: options.capStyle === "rounded" ? "round" : "butt",
      filter: buildSvgFilter(buildEqualizerShadowParts(options, layout.isHorizontal)),
      areaFillOpacity: clamp01(options.opacity / 100) * 0.35
    }
  } satisfies EqualizerStaticValues;
  equalizerStaticValueCache.set(cacheKey, nextValue);
  return nextValue;
}
