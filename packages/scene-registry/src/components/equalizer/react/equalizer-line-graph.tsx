import React from "react";
import { buildGradientStops, buildLineGeometry } from "../line-geometry";
import type { EqualizerOptions, EqualizerStaticValues } from "../types";

export function EqualizerLineGraph({
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
