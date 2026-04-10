import React from "react";
import { getBarAmplitude, getSingleBarFillStyle } from "../bar-plan";
import { buildBarRenderPlan } from "../bar-plan";
import type {
  BarPlanEntry,
  EqualizerBarStaticStyle,
  EqualizerOptions,
  EqualizerStaticValues
} from "../types";

export function EqualizerBar({
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

export function renderBarPlan(
  frameValues: number[],
  colors: string[],
  options: EqualizerOptions,
  staticValues: EqualizerStaticValues
) {
  const barPlan: BarPlanEntry[] = buildBarRenderPlan(frameValues, options.layoutMode);

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
