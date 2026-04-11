import type {
  SceneBrowserFrameStateContext,
  SceneBrowserInitialStateContext
} from "@lyric-video-maker/core";
import {
  buildBarRenderPlan,
  buildRenderableBarAmplitudes,
  buildRenderableBars,
  getBarAmplitude
} from "./bar-plan";
import { buildEqualizerColorPlan } from "./color-plan";
import { buildLineGeometry } from "./line-geometry";
import { getEqualizerStaticValues } from "./static-values";
import type { EqualizerOptions, PreparedEqualizerData } from "./types";

export function getEqualizerInitialBrowserState({
  instance,
  options,
  prepared,
  video
}: SceneBrowserInitialStateContext<EqualizerOptions>) {
  const preparedData = prepared as unknown as PreparedEqualizerData;
  return createEqualizerBrowserInitialState(
    instance.id,
    options,
    preparedData.frames?.[0] ?? [],
    video
  );
}

export function getEqualizerFrameBrowserState({
  options,
  prepared,
  frame
}: SceneBrowserFrameStateContext<EqualizerOptions>) {
  const preparedData = prepared as unknown as PreparedEqualizerData;
  return createEqualizerBrowserFrameState(options, preparedData.frames?.[frame] ?? []);
}

export function createEqualizerBrowserInitialState(
  instanceId: string,
  options: EqualizerOptions,
  initialValues: number[],
  video: { width: number; height: number } = { width: 1920, height: 1080 }
) {
  const staticValues = getEqualizerStaticValues(instanceId, options, initialValues.length, video);
  const values = buildRenderableBars(initialValues, options);
  const colors = buildEqualizerColorPlan(values, options);

  if (options.graphMode === "line") {
    const geometry = buildLineGeometry(values, staticValues.layout.lineBaseline);
    return {
      wrapperStyle: staticValues.layout.wrapperStyle,
      trackStyle: staticValues.layout.trackStyle,
      plateStyle: options.backgroundPlateEnabled ? staticValues.layout.plateStyle : null,
      graphMode: options.graphMode,
      baseline: staticValues.layout.lineBaseline,
      lineStyle: options.lineStyle,
      svgStyle: staticValues.lineStyle.svgStyle,
      strokeWidth: staticValues.lineStyle.strokeWidth,
      strokeLinecap: staticValues.lineStyle.strokeLinecap,
      filter: staticValues.lineStyle.filter,
      gradientId: staticValues.lineStyle.gradientId,
      gradientAxis: geometry.gradientAxis,
      areaFillOpacity: staticValues.lineStyle.areaFillOpacity,
      opacity: staticValues.barStyle.opacity,
      values,
      colors
    };
  }

  const frameValues = buildRenderableBarAmplitudes(initialValues, options);
  const barPlan = buildBarRenderPlan(frameValues, options.layoutMode);

  return {
    wrapperStyle: staticValues.layout.wrapperStyle,
    trackStyle: staticValues.layout.trackStyle,
    plateStyle: options.backgroundPlateEnabled ? staticValues.layout.plateStyle : null,
    graphMode: options.graphMode,
    isHorizontal: staticValues.layout.isHorizontal,
    layoutMode: options.layoutMode,
    growthDirection: options.growthDirection,
    borderRadius: staticValues.barStyle.borderRadius,
    opacity: staticValues.barStyle.opacity,
    boxShadow: staticValues.barStyle.boxShadow,
    gapSize: Math.max(12, options.barGap * 4),
    entries: barPlan.map((entry) =>
      entry.type === "gap"
        ? { type: "gap" as const }
        : {
            type: "bar" as const,
            color: colors[entry.colorIndex] ?? options.primaryColor,
            value: entry.value
          }
    )
  };
}

export function createEqualizerBrowserFrameState(options: EqualizerOptions, values: number[]) {
  const renderableValues = buildRenderableBars(values, options);

  return options.graphMode === "line"
    ? {
        values: renderableValues,
        colors: buildEqualizerColorPlan(renderableValues, options)
      }
    : {
        values: renderableValues.map((value) => getBarAmplitude(value, options)),
        colors: buildEqualizerColorPlan(renderableValues, options)
      };
}
