import type { CSSProperties } from "react";
import type { TransformAnchor, TransformOptions } from "./transform";

/**
 * Canvas dimensions for the transform runtime. The helper is pure and does
 * not currently depend on pixel dimensions (percentages are passed through to
 * CSS), but the parameter is accepted so future components can derive pixel
 * fallbacks without changing the call-site signature.
 */
export interface TransformCanvas {
  width: number;
  height: number;
}

const ANCHOR_TRANSLATIONS: Record<TransformAnchor, { tx: number; ty: number }> = {
  "top-left": { tx: 0, ty: 0 },
  "top-center": { tx: -50, ty: 0 },
  "top-right": { tx: -100, ty: 0 },
  "middle-left": { tx: 0, ty: -50 },
  "middle-center": { tx: -50, ty: -50 },
  "middle-right": { tx: -100, ty: -50 },
  "bottom-left": { tx: 0, ty: -100 },
  "bottom-center": { tx: -50, ty: -100 },
  "bottom-right": { tx: -100, ty: -100 }
};

/**
 * Pure helper: compute the CSS style needed to absolutely position an element
 * on a canvas according to the supplied TransformOptions.
 *
 * The returned style honors percent-based position and size, applies anchor
 * translation first (so the named point on the element aligns with the
 * requested (x, y) on the canvas), then applies rotation around the element's
 * visual center, then applies horizontal and vertical flips.
 *
 * No side effects. Safe to call from render or preprepare contexts.
 */
export function computeTransformStyle(
  options: TransformOptions,
  _canvas: TransformCanvas
): CSSProperties {
  const { tx, ty } = ANCHOR_TRANSLATIONS[options.anchor];

  const transformParts: string[] = [];
  transformParts.push(`translate(${tx}%, ${ty}%)`);
  if (options.rotation !== 0) {
    transformParts.push(`rotate(${options.rotation}deg)`);
  }
  if (options.flipHorizontal || options.flipVertical) {
    const sx = options.flipHorizontal ? -1 : 1;
    const sy = options.flipVertical ? -1 : 1;
    transformParts.push(`scale(${sx}, ${sy})`);
  }

  return {
    position: "absolute",
    left: `${options.x}%`,
    top: `${options.y}%`,
    width: `${options.width}%`,
    height: `${options.height}%`,
    transform: transformParts.join(" "),
    transformOrigin: "50% 50%"
  };
}
