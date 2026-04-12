import type React from "react";
import { withAlpha } from "../../shared/color";
import { computeTransformStyle } from "../../shared/transform-runtime";
import type { TransformOptions } from "../../shared";
import type {
  EqualizerLayout,
  EqualizerOptions
} from "./types";

export function getEqualizerLayout(
  options: EqualizerOptions,
  video: { width: number; height: number }
): EqualizerLayout {
  const isHorizontal = options.barOrientation === "horizontal";
  const transformStyle = computeTransformStyle(getEqualizerTransformOptions(options), video);

  return {
    isHorizontal,
    lineBaseline: options.lineBaseline,
    wrapperStyle: {
      ...transformStyle,
      padding: `${Math.max(0, options.innerPadding / 2)}px`,
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
      justifyContent: "stretch",
      overflow: "hidden"
    } satisfies React.CSSProperties
  };
}

function getEqualizerTransformOptions(options: EqualizerOptions): TransformOptions {
  return {
    x: options.x ?? 0,
    y: options.y ?? 0,
    width: options.width ?? 100,
    height: options.height ?? 100,
    anchor: options.anchor ?? "top-left",
    rotation: options.rotation ?? 0,
    flipHorizontal: options.flipHorizontal ?? false,
    flipVertical: options.flipVertical ?? false
  };
}
