import React from "react";
import type { SceneComponentDefinition } from "@lyric-video-maker/core";
import { withAlpha } from "../shared/color";

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
  browserRuntime: {
    runtimeId: "background-color",
    getInitialState({ options }) {
      return {
        background: `linear-gradient(180deg, ${withAlpha(options.topColor, options.topOpacity / 100)} 0%, ${withAlpha(
          options.bottomColor,
          options.bottomOpacity / 100
        )} 100%)`
      };
    }
  },
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
