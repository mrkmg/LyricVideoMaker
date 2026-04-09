import React from "react";
import type { SceneComponentDefinition } from "@lyric-video-maker/core";

export interface BackgroundColorOptions {
  topColor: string;
  topOpacity: number;
  bottomColor: string;
  bottomOpacity: number;
}

export const backgroundColorComponent: SceneComponentDefinition<BackgroundColorOptions> = {
  id: "background-color",
  name: "Background Color",
  description: "Adds a gradient color wash over the full frame.",
  staticWhenMarkupUnchanged: true,
  options: [
    {
      type: "category",
      id: "background",
      label: "Background",
      defaultExpanded: false,
      options: [
        { type: "color", id: "topColor", label: "Color Top", defaultValue: "#09090f" },
        {
          type: "number",
          id: "topOpacity",
          label: "Color Top Opacity",
          defaultValue: 60,
          min: 0,
          max: 100,
          step: 1
        },
        { type: "color", id: "bottomColor", label: "Color Bottom", defaultValue: "#09090f" },
        {
          type: "number",
          id: "bottomOpacity",
          label: "Color Bottom Opacity",
          defaultValue: 60,
          min: 0,
          max: 100,
          step: 1
        }
      ]
    }
  ],
  defaultOptions: {
    topColor: "#09090f",
    topOpacity: 60,
    bottomColor: "#09090f",
    bottomOpacity: 60
  },
  Component: ({ options }) => (
    <div
      style={{
        position: "absolute",
        inset: 0,
        background: `linear-gradient(180deg, ${withAlpha(options.topColor, options.topOpacity / 100)} 0%, ${withAlpha(
          options.bottomColor,
          options.bottomOpacity / 100
        )} 100%)`
      }}
    />
  )
};

function withAlpha(hexColor: string, alpha: number) {
  const normalized = hexColor.replace("#", "");
  const expanded =
    normalized.length === 3
      ? normalized
          .split("")
          .map((char) => char + char)
          .join("")
      : normalized;

  if (!/^[\da-fA-F]{6}$/.test(expanded)) {
    return hexColor;
  }

  const red = Number.parseInt(expanded.slice(0, 2), 16);
  const green = Number.parseInt(expanded.slice(2, 4), 16);
  const blue = Number.parseInt(expanded.slice(4, 6), 16);
  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
}
