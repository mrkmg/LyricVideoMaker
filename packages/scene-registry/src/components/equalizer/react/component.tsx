import React from "react";
import type { SceneRenderProps } from "@lyric-video-maker/core";
import { buildRenderableBars } from "../bar-plan";
import { buildEqualizerColorPlan } from "../color-plan";
import { getEqualizerStaticValues } from "../static-values";
import type { EqualizerOptions, PreparedEqualizerData } from "../types";
import { EqualizerLineGraph } from "./equalizer-line-graph";
import { renderBarPlan } from "./equalizer-bar";

export function EqualizerRenderComponent({
  instance,
  frame,
  options,
  prepared,
  video
}: SceneRenderProps<EqualizerOptions>) {
  const preparedData = prepared as unknown as PreparedEqualizerData;
  const frameValues = buildRenderableBars(preparedData.frames?.[frame] ?? [], options);
  const staticValues = getEqualizerStaticValues(instance.id, options, frameValues.length, video);
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
