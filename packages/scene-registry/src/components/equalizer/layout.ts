import type React from "react";
import { withAlpha } from "../../shared/color";
import { computeTransformStyle } from "../../shared/transform-runtime";
import type { TransformOptions } from "../../shared";
import type {
  EqualizerLayout,
  EqualizerLineBaseline,
  EqualizerOptions,
  EqualizerPlacement
} from "./types";

export function getEqualizerLayout(
  options: EqualizerOptions,
  video: { width: number; height: number }
): EqualizerLayout {
  const isHorizontal = ![
    "left-center",
    "right-center",
    "center-vertical"
  ].includes(options.placement);
  const transformStyle = computeTransformStyle(getEqualizerTransformOptions(options), video);

  return {
    isHorizontal,
    lineBaseline: getLineBaseline(options.placement),
    wrapperStyle: {
      ...transformStyle,
      padding: `${Math.max(0, options.innerPadding / 2)}px`,
      justifySelf: options.alignment,
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
    x: options.x ?? 50,
    y: options.y ?? 98,
    width: options.width ?? 56,
    height: options.height ?? 14,
    anchor: options.anchor ?? "bottom-center",
    rotation: options.rotation ?? 0,
    flipHorizontal: options.flipHorizontal ?? false,
    flipVertical: options.flipVertical ?? false
  };
}

export function getLineBaseline(placement: EqualizerPlacement): EqualizerLineBaseline {
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
