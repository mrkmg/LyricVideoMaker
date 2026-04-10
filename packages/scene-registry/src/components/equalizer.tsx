import React from "react";
import {
  validateSceneOptions,
  type SceneComponentDefinition,
  type SceneOptionEntry
} from "@lyric-video-maker/core";

type EqualizerPlacement =
  | "bottom-center"
  | "top-center"
  | "left-center"
  | "right-center"
  | "bottom-full"
  | "top-full"
  | "center-horizontal"
  | "center-vertical";
type EqualizerAlignment = "start" | "center" | "end";
type EqualizerLayoutMode = "single" | "mirrored" | "split";
type EqualizerGrowthDirection = "up" | "down" | "left" | "right" | "outward";
type EqualizerBandDistribution = "linear" | "log";
type EqualizerColorMode = "solid" | "gradient" | "intensity";
type EqualizerCapStyle = "square" | "rounded";
type EqualizerGraphMode = "bars" | "line";
type EqualizerLineStyle = "stroke" | "area";
type EqualizerLineBaseline =
  | "top"
  | "bottom"
  | "left"
  | "right"
  | "center-horizontal"
  | "center-vertical";

export interface EqualizerOptions {
  placement: EqualizerPlacement;
  spanPercent: number;
  depthPercent: number;
  offsetX: number;
  offsetY: number;
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

interface PreparedEqualizerData {
  frames: number[][];
}

const equalizerOptionsSchema: SceneOptionEntry[] = [
  {
    type: "category",
    id: "placement",
    label: "Placement",
    options: [
      {
        type: "select",
        id: "placement",
        label: "Placement",
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
      { type: "number", id: "spanPercent", label: "Span Percent", defaultValue: 56, min: 10, max: 100, step: 1 },
      { type: "number", id: "depthPercent", label: "Depth Percent", defaultValue: 14, min: 4, max: 40, step: 1 },
      { type: "number", id: "offsetX", label: "Offset X", defaultValue: 0, min: -960, max: 960, step: 1 },
      { type: "number", id: "offsetY", label: "Offset Y", defaultValue: 0, min: -540, max: 540, step: 1 },
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
      { type: "number", id: "barCount", label: "Bar Count", defaultValue: 28, min: 4, max: 64, step: 1 },
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

const equalizerDefaultOptions: EqualizerOptions = {
  placement: "bottom-center",
  spanPercent: 56,
  depthPercent: 14,
  offsetX: 0,
  offsetY: 0,
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

const equalizerValidationDefinition: SceneComponentDefinition<EqualizerOptions> = {
  id: "equalizer",
  name: "Equalizer",
  description: "Audio-reactive bar or line visualizer for overlay use.",
  staticWhenMarkupUnchanged: false,
  options: equalizerOptionsSchema,
  defaultOptions: equalizerDefaultOptions,
  Component: () => null
};

export const equalizerComponent: SceneComponentDefinition<EqualizerOptions> = {
  ...equalizerValidationDefinition,
  validate(raw) {
    const options = validateSceneOptions(equalizerValidationDefinition, raw);

    if (options.maxFrequency <= options.minFrequency) {
      throw new Error('"Max Frequency" must be greater than "Min Frequency".');
    }

    if (options.maxBarScale < options.minBarScale) {
      throw new Error('"Max Bar Scale" must be greater than or equal to "Min Bar Scale".');
    }

    return options;
  },
  getPrepareCacheKey({ options, video, audioPath }) {
    return JSON.stringify({
      audioPath,
      video: {
        fps: video.fps,
        durationMs: video.durationMs,
        durationInFrames: video.durationInFrames
      },
      spectrum: {
        barCount: options.barCount,
        minFrequency: options.minFrequency,
        maxFrequency: options.maxFrequency,
        analysisFps: options.analysisFps,
        sensitivity: options.sensitivity,
        smoothing: options.smoothing,
        attackMs: options.attackMs,
        releaseMs: options.releaseMs,
        silenceFloor: options.silenceFloor,
        bandDistribution: options.bandDistribution
      }
    });
  },
  browserRuntime: {
    runtimeId: "equalizer",
    getInitialState({ instance, options, prepared }) {
      const preparedData = prepared as unknown as PreparedEqualizerData;
      return createEqualizerBrowserInitialState(
        instance.id,
        options,
        preparedData.frames?.[0] ?? []
      );
    },
    getFrameState({ options, prepared, frame }) {
      const preparedData = prepared as unknown as PreparedEqualizerData;
      return createEqualizerBrowserFrameState(options, preparedData.frames?.[frame] ?? []);
    }
  },
  async prepare({ audio, options }) {
    const spectrum = await audio.getSpectrum({
      bandCount: options.barCount,
      minFrequency: options.minFrequency,
      maxFrequency: options.maxFrequency,
      analysisFps: options.analysisFps,
      sensitivity: options.sensitivity,
      smoothing: options.smoothing,
      attackMs: options.attackMs,
      releaseMs: options.releaseMs,
      silenceFloor: options.silenceFloor,
      bandDistribution: options.bandDistribution
    });

    return {
      frames: spectrum.values
    } satisfies PreparedEqualizerData;
  },
  Component: ({ instance, frame, options, prepared }) => {
    const preparedData = prepared as unknown as PreparedEqualizerData;
    const frameValues = buildRenderableBars(preparedData.frames?.[frame] ?? [], options);
    const staticValues = getEqualizerStaticValues(instance.id, options, frameValues.length);
    const colors = buildEqualizerColorPlan(frameValues, options);

    return (
      <div style={staticValues.layout.wrapperStyle}>
        {options.backgroundPlateEnabled ? (
          <div data-equalizer-plate="" style={staticValues.layout.plateStyle} />
        ) : null}
        <div data-equalizer-track="" style={staticValues.layout.trackStyle}>
          {options.graphMode === "line" ? (
            <EqualizerLineGraph
              values={frameValues}
              colors={colors}
              options={options}
              staticValues={staticValues}
            />
          ) : (
            renderBarPlan(frameValues, colors, options, staticValues)
          )}
        </div>
      </div>
    );
  }
};

function renderBarPlan(
  frameValues: number[],
  colors: string[],
  options: EqualizerOptions,
  staticValues: EqualizerStaticValues
) {
  const barPlan = buildBarRenderPlan(frameValues, options.layoutMode);

  return barPlan.map((entry, index) =>
    entry.type === "gap" ? (
      <div
        key={`gap-${index}`}
        style={
          staticValues.layout.isHorizontal
            ? { flex: `0 0 ${Math.max(12, options.barGap * 4)}px` }
            : { flex: `0 0 ${Math.max(12, options.barGap * 4)}px` }
        }
      />
    ) : (
      <EqualizerBar
        key={`bar-${index}`}
        value={entry.value}
        color={colors[entry.colorIndex] ?? options.primaryColor}
        options={options}
        isHorizontal={staticValues.layout.isHorizontal}
        staticStyle={staticValues.barStyle}
      />
    )
  );
}

function EqualizerBar({
  value,
  color,
  options,
  isHorizontal,
  staticStyle
}: {
  value: number;
  color: string;
  options: EqualizerOptions;
  isHorizontal: boolean;
  staticStyle: EqualizerBarStaticStyle;
}) {
  const amplitude = getBarAmplitude(value, options);

  if (options.layoutMode === "mirrored") {
    return isHorizontal ? (
      <div
        data-equalizer-bar=""
        style={{
          position: "relative",
          flex: 1,
          height: "100%"
        }}
      >
        <div
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            bottom: "50%",
            height: `${amplitude * 50}%`,
            background: color,
            borderRadius: staticStyle.borderRadius,
            opacity: staticStyle.opacity,
            boxShadow: staticStyle.boxShadow
          }}
        />
        <div
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            top: "50%",
            height: `${amplitude * 50}%`,
            background: color,
            borderRadius: staticStyle.borderRadius,
            opacity: staticStyle.opacity,
            boxShadow: staticStyle.boxShadow
          }}
        />
      </div>
    ) : (
      <div
        data-equalizer-bar=""
        style={{
          position: "relative",
          flex: 1,
          width: "100%"
        }}
      >
        <div
          style={{
            position: "absolute",
            top: 0,
            bottom: 0,
            right: "50%",
            width: `${amplitude * 50}%`,
            background: color,
            borderRadius: staticStyle.borderRadius,
            opacity: staticStyle.opacity,
            boxShadow: staticStyle.boxShadow
          }}
        />
        <div
          style={{
            position: "absolute",
            top: 0,
            bottom: 0,
            left: "50%",
            width: `${amplitude * 50}%`,
            background: color,
            borderRadius: staticStyle.borderRadius,
            opacity: staticStyle.opacity,
            boxShadow: staticStyle.boxShadow
          }}
        />
      </div>
    );
  }

  return (
    <div
      data-equalizer-bar=""
      style={{
        position: "relative",
        flex: 1,
        [isHorizontal ? "height" : "width"]: "100%"
      }}
    >
      <div
        style={getSingleBarFillStyle({
          isHorizontal,
          amplitude,
          color,
          opacity: staticStyle.opacity,
          borderRadius: staticStyle.borderRadius,
          boxShadow: staticStyle.boxShadow,
          growthDirection: options.growthDirection
        })}
      />
    </div>
  );
}

function EqualizerLineGraph({
  values,
  colors,
  options,
  staticValues
}: {
  values: number[];
  colors: string[];
  options: EqualizerOptions;
  staticValues: EqualizerStaticValues;
}) {
  const geometry = buildLineGeometry(values, staticValues.layout.lineBaseline);

  return (
    <svg
      data-equalizer-line=""
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      style={staticValues.lineStyle.svgStyle}
    >
      <defs>
        <linearGradient
          id={staticValues.lineStyle.gradientId}
          gradientUnits="userSpaceOnUse"
          x1={geometry.gradientAxis.x1}
          y1={geometry.gradientAxis.y1}
          x2={geometry.gradientAxis.x2}
          y2={geometry.gradientAxis.y2}
        >
          {buildGradientStops(colors).map((stop) => (
            <stop key={stop.offset} offset={stop.offset} stopColor={stop.color} />
          ))}
        </linearGradient>
      </defs>
      {options.lineStyle === "area" ? (
        <path
          d={geometry.areaPath}
          fill={`url(#${staticValues.lineStyle.gradientId})`}
          opacity={staticValues.lineStyle.areaFillOpacity}
          style={{
            filter: staticValues.lineStyle.filter
          }}
        />
      ) : null}
      <path
        d={geometry.linePath}
        fill="none"
        stroke={`url(#${staticValues.lineStyle.gradientId})`}
        strokeWidth={staticValues.lineStyle.strokeWidth}
        strokeLinecap={staticValues.lineStyle.strokeLinecap}
        strokeLinejoin={staticValues.lineStyle.strokeLinecap === "round" ? "round" : "bevel"}
        opacity={staticValues.barStyle.opacity}
        style={{
          filter: staticValues.lineStyle.filter
        }}
      />
    </svg>
  );
}

type BarPlanEntry = { type: "bar"; value: number; colorIndex: number } | { type: "gap" };

function buildBarRenderPlan(
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

function buildRenderableBars(values: number[], options: EqualizerOptions) {
  const fallback = new Array<number>(options.barCount).fill(options.minBarScale / 100);
  const bars = values.length === options.barCount ? values : fallback;
  return bars.map((value) => clamp01(value));
}

function buildRenderableBarAmplitudes(values: number[], options: EqualizerOptions) {
  return buildRenderableBars(values, options).map((value) => getBarAmplitude(value, options));
}

function createEqualizerBrowserInitialState(
  instanceId: string,
  options: EqualizerOptions,
  initialValues: number[]
) {
  const staticValues = getEqualizerStaticValues(instanceId, options, initialValues.length);
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

function createEqualizerBrowserFrameState(options: EqualizerOptions, values: number[]) {
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

interface EqualizerBarStaticStyle {
  borderRadius: string;
  boxShadow: string;
  opacity: number;
}

interface EqualizerLineStaticStyle {
  svgStyle: React.CSSProperties;
  gradientId: string;
  strokeWidth: number;
  strokeLinecap: "butt" | "round";
  filter: string;
  areaFillOpacity: number;
}

interface EqualizerStaticValues {
  layout: ReturnType<typeof getEqualizerLayout>;
  barStyle: EqualizerBarStaticStyle;
  lineStyle: EqualizerLineStaticStyle;
}

const equalizerStaticValueCache = new Map<string, EqualizerStaticValues>();

function getEqualizerStaticValues(
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

function getBarAmplitude(value: number, options: EqualizerOptions) {
  const minScale = clamp01(options.minBarScale / 100);
  const maxScale = clamp01(options.maxBarScale / 100);
  return minScale + (maxScale - minScale) * clamp01(value);
}

function getSingleBarFillStyle({
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

function buildEqualizerShadowParts(
  options: EqualizerOptions,
  isHorizontal: boolean
) {
  const shadowParts: string[] = [];

  if (options.shadowEnabled && options.shadowStrength > 0) {
    shadowParts.push(
      isHorizontal
        ? `0 ${Math.max(2, options.shadowStrength / 8)}px ${Math.max(4, options.shadowStrength / 2)}px ${withAlpha(options.shadowColor, 0.45)}`
        : `${Math.max(2, options.shadowStrength / 8)}px 0 ${Math.max(4, options.shadowStrength / 2)}px ${withAlpha(options.shadowColor, 0.45)}`
    );
  }

  if (options.glowEnabled && options.glowStrength > 0) {
    shadowParts.push(
      `0 0 ${Math.max(6, options.glowStrength / 1.5)}px ${withAlpha(options.glowColor, 0.75)}`
    );
  }

  return shadowParts;
}

function buildSvgFilter(shadowParts: string[]) {
  return shadowParts.length > 0 ? `drop-shadow(${shadowParts.join(") drop-shadow(")})` : "none";
}

function getEqualizerLayout(options: EqualizerOptions) {
  const isHorizontal = ![
    "left-center",
    "right-center",
    "center-vertical"
  ].includes(options.placement);
  const anchor = getPlacementStyle(options.placement, options.alignment, options.innerPadding);
  const translate = `translate(${options.offsetX}px, ${options.offsetY}px)`;
  const transform =
    anchor.transform && anchor.transform !== "none"
      ? `${anchor.transform} ${translate}`
      : translate;

  return {
    isHorizontal,
    lineBaseline: getLineBaseline(options.placement),
    wrapperStyle: {
      position: "absolute",
      ...anchor,
      width: isHorizontal ? getPlacementWidth(options) : `${options.depthPercent}%`,
      height: isHorizontal ? `${options.depthPercent}%` : getPlacementHeight(options),
      padding: `${Math.max(0, options.innerPadding / 2)}px`,
      transform,
      pointerEvents: "none"
    } satisfies React.CSSProperties,
    plateStyle: {
      position: "absolute",
      inset: 0,
      background: withAlpha(options.backgroundPlateColor, options.backgroundPlateOpacity / 100),
      borderRadius: `${Math.max(12, options.cornerRadius)}px`
    } satisfies React.CSSProperties,
    trackStyle: {
      position: "relative",
      display: "flex",
      flexDirection: isHorizontal ? "row" : "column",
      gap: `${options.graphMode === "line" ? 0 : options.barGap}px`,
      width: "100%",
      height: "100%",
      alignItems: "stretch",
      justifyContent: "stretch"
    } satisfies React.CSSProperties
  };
}

function getPlacementStyle(
  placement: EqualizerPlacement,
  alignment: EqualizerAlignment,
  innerPadding: number
): React.CSSProperties {
  switch (placement) {
    case "top-center":
      return {
        top: `${innerPadding}px`,
        ...getHorizontalAlignment(alignment)
      };
    case "left-center":
      return {
        left: `${innerPadding}px`,
        ...getVerticalAlignment(alignment)
      };
    case "right-center":
      return {
        right: `${innerPadding}px`,
        ...getVerticalAlignment(alignment)
      };
    case "bottom-full":
      return {
        left: `${innerPadding}px`,
        right: `${innerPadding}px`,
        bottom: `${innerPadding}px`
      };
    case "top-full":
      return {
        left: `${innerPadding}px`,
        right: `${innerPadding}px`,
        top: `${innerPadding}px`
      };
    case "center-horizontal":
      return {
        top: "50%",
        left: 0,
        right: 0,
        transform: "translateY(-50%)",
        margin: "0 auto"
      };
    case "center-vertical":
      return {
        left: "50%",
        top: 0,
        bottom: 0,
        transform: "translateX(-50%)",
        margin: "auto 0"
      };
    case "bottom-center":
    default:
      return {
        bottom: `${innerPadding}px`,
        ...getHorizontalAlignment(alignment)
      };
  }
}

function getHorizontalAlignment(alignment: EqualizerAlignment) {
  switch (alignment) {
    case "start":
      return { left: 0 };
    case "end":
      return { right: 0 };
    case "center":
    default:
      return { left: "50%", transform: "translateX(-50%)" };
  }
}

function getVerticalAlignment(alignment: EqualizerAlignment) {
  switch (alignment) {
    case "start":
      return { top: 0 };
    case "end":
      return { bottom: 0 };
    case "center":
    default:
      return { top: "50%", transform: "translateY(-50%)" };
  }
}

function getPlacementWidth(options: EqualizerOptions) {
  if (options.placement === "bottom-full" || options.placement === "top-full") {
    return `calc(100% - ${options.innerPadding * 2}px)`;
  }

  return `${options.spanPercent}%`;
}

function getPlacementHeight(options: EqualizerOptions) {
  return `${options.spanPercent}%`;
}

function getLineBaseline(placement: EqualizerPlacement): EqualizerLineBaseline {
  switch (placement) {
    case "top-center":
    case "top-full":
      return "top";
    case "left-center":
      return "left";
    case "right-center":
      return "right";
    case "center-horizontal":
      return "center-horizontal";
    case "center-vertical":
      return "center-vertical";
    case "bottom-center":
    case "bottom-full":
    default:
      return "bottom";
  }
}

function buildEqualizerColorPlan(values: number[], options: EqualizerOptions) {
  return values.map((value, index) => getBarColor(index, values.length, options, value));
}

function getBarColor(index: number, total: number, options: EqualizerOptions, amplitude: number) {
  switch (options.colorMode) {
    case "solid":
      return options.primaryColor;
    case "intensity":
      return getIntensityColor(amplitude, options);
    case "gradient":
    default: {
      const blend = total <= 1 ? 0 : index / (total - 1);
      return index < total / 2
        ? mixHex(options.primaryColor, options.secondaryColor, blend * 2)
        : mixHex(options.secondaryColor, options.accentColor, (blend - 0.5) * 2);
    }
  }
}

function getIntensityColor(amplitude: number, options: EqualizerOptions) {
  const safeAmplitude = clamp01(amplitude);
  return safeAmplitude <= 0.5
    ? mixHex(options.primaryColor, options.secondaryColor, safeAmplitude * 2)
    : mixHex(options.secondaryColor, options.accentColor, (safeAmplitude - 0.5) * 2);
}

function buildLineGeometry(values: number[], baseline: EqualizerLineBaseline) {
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

function pointsToPath(points: Array<{ x: number; y: number }>) {
  return points
    .map((point, index) => `${index === 0 ? "M" : "L"} ${point.x.toFixed(3)} ${point.y.toFixed(3)}`)
    .join(" ");
}

function buildAreaPath(points: Array<{ x: number; y: number }>, baseline: EqualizerLineBaseline) {
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

function getLineGradientAxis(baseline: EqualizerLineBaseline) {
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

function buildGradientStops(colors: string[]) {
  if (colors.length <= 1) {
    return [{ offset: "0%", color: colors[0] ?? "#ffffff" }];
  }

  return colors.map((color, index) => ({
    offset: `${(index / (colors.length - 1)) * 100}%`,
    color
  }));
}

function mixHex(left: string, right: string, blend: number) {
  const leftRgb = parseHexColor(left);
  const rightRgb = parseHexColor(right);
  if (!leftRgb || !rightRgb) {
    return left;
  }

  const safeBlend = clamp01(blend);
  return rgbToHex({
    red: Math.round(leftRgb.red + (rightRgb.red - leftRgb.red) * safeBlend),
    green: Math.round(leftRgb.green + (rightRgb.green - leftRgb.green) * safeBlend),
    blue: Math.round(leftRgb.blue + (rightRgb.blue - leftRgb.blue) * safeBlend)
  });
}

function withAlpha(hexColor: string, alpha: number) {
  const rgb = parseHexColor(hexColor);
  if (!rgb) {
    return hexColor;
  }

  return `rgba(${rgb.red}, ${rgb.green}, ${rgb.blue}, ${clamp01(alpha)})`;
}

function parseHexColor(hexColor: string) {
  const normalized = hexColor.replace("#", "");
  const expanded =
    normalized.length === 3
      ? normalized
          .split("")
          .map((char) => char + char)
          .join("")
      : normalized;

  if (!/^[\da-fA-F]{6}$/.test(expanded)) {
    return null;
  }

  return {
    red: Number.parseInt(expanded.slice(0, 2), 16),
    green: Number.parseInt(expanded.slice(2, 4), 16),
    blue: Number.parseInt(expanded.slice(4, 6), 16)
  };
}

function rgbToHex({
  red,
  green,
  blue
}: {
  red: number;
  green: number;
  blue: number;
}) {
  return `#${[red, green, blue]
    .map((value) => value.toString(16).padStart(2, "0"))
    .join("")}`;
}

function clamp01(value: number) {
  return Math.max(0, Math.min(1, value));
}
