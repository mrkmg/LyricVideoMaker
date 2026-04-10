import type React from "react";
import { withAlpha } from "../../shared/color";
import type {
  EqualizerAlignment,
  EqualizerLayout,
  EqualizerLineBaseline,
  EqualizerOptions,
  EqualizerPlacement
} from "./types";

export function getEqualizerLayout(options: EqualizerOptions): EqualizerLayout {
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

export function getPlacementStyle(
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

export function getHorizontalAlignment(alignment: EqualizerAlignment): React.CSSProperties {
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

export function getVerticalAlignment(alignment: EqualizerAlignment): React.CSSProperties {
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

export function getPlacementWidth(options: EqualizerOptions) {
  if (options.placement === "bottom-full" || options.placement === "top-full") {
    return `calc(100% - ${options.innerPadding * 2}px)`;
  }

  return `${options.spanPercent}%`;
}

export function getPlacementHeight(options: EqualizerOptions) {
  return `${options.spanPercent}%`;
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
