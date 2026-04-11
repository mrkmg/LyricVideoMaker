import type { SceneOptionCategory } from "@lyric-video-maker/core";

/**
 * Nine-position anchor point for placing a positioned element on the canvas.
 * The anchor describes which point on the element's bounding box aligns with
 * the requested x/y position on the canvas.
 */
export type TransformAnchor =
  | "top-left"
  | "top-center"
  | "top-right"
  | "middle-left"
  | "middle-center"
  | "middle-right"
  | "bottom-left"
  | "bottom-center"
  | "bottom-right";

export const TRANSFORM_ANCHOR_VALUES: readonly TransformAnchor[] = [
  "top-left",
  "top-center",
  "top-right",
  "middle-left",
  "middle-center",
  "middle-right",
  "bottom-left",
  "bottom-center",
  "bottom-right"
] as const;

/**
 * Reusable transform options contract. All positional fields are expressed in
 * percentage units of the canvas so a single options value renders consistently
 * regardless of the render resolution.
 *
 * Ranges support off-canvas placement (negative / > 100 position) for slide-in
 * effects and oversized elements (size > 100).
 */
export interface TransformOptions {
  /** X position of the anchor point, in percent of canvas width. */
  x: number;
  /** Y position of the anchor point, in percent of canvas height. */
  y: number;
  /** Width in percent of canvas width. */
  width: number;
  /** Height in percent of canvas height. */
  height: number;
  /** Which point on the element aligns with the (x, y) position. */
  anchor: TransformAnchor;
  /** Rotation in degrees applied around the element's visual center. */
  rotation: number;
  /** Horizontal flip (mirrors element along vertical axis). */
  flipHorizontal: boolean;
  /** Vertical flip (mirrors element along horizontal axis). */
  flipVertical: boolean;
}

/**
 * Default transform values place a visible, centered element with no rotation
 * or flip. Consumers should spread these defaults into their component
 * defaults rather than duplicating the literals.
 */
export const DEFAULT_TRANSFORM_OPTIONS: TransformOptions = {
  x: 50,
  y: 50,
  width: 50,
  height: 50,
  anchor: "middle-center",
  rotation: 0,
  flipHorizontal: false,
  flipVertical: false
};

/**
 * Reusable Transform option category exposing the nine transform fields to the
 * component editor. Position fields allow off-canvas values (for slide-in
 * effects), size fields accept > 100 percent (for oversized elements), and
 * rotation accepts a full negative-to-positive range.
 */
export const transformCategory: SceneOptionCategory = {
  type: "category",
  id: "transform",
  label: "Transform",
  defaultExpanded: true,
  options: [
    { type: "number", id: "x", label: "X", defaultValue: 50, min: -200, max: 300, step: 1 },
    { type: "number", id: "y", label: "Y", defaultValue: 50, min: -200, max: 300, step: 1 },
    {
      type: "number",
      id: "width",
      label: "Width",
      defaultValue: 50,
      min: 0,
      max: 500,
      step: 1
    },
    {
      type: "number",
      id: "height",
      label: "Height",
      defaultValue: 50,
      min: 0,
      max: 500,
      step: 1
    },
    {
      type: "select",
      id: "anchor",
      label: "Anchor",
      defaultValue: "middle-center",
      options: [
        { label: "Top Left", value: "top-left" },
        { label: "Top Center", value: "top-center" },
        { label: "Top Right", value: "top-right" },
        { label: "Middle Left", value: "middle-left" },
        { label: "Middle Center", value: "middle-center" },
        { label: "Middle Right", value: "middle-right" },
        { label: "Bottom Left", value: "bottom-left" },
        { label: "Bottom Center", value: "bottom-center" },
        { label: "Bottom Right", value: "bottom-right" }
      ]
    },
    {
      type: "number",
      id: "rotation",
      label: "Rotation",
      defaultValue: 0,
      min: -360,
      max: 360,
      step: 1
    },
    { type: "boolean", id: "flipHorizontal", label: "Flip Horizontal", defaultValue: false },
    { type: "boolean", id: "flipVertical", label: "Flip Vertical", defaultValue: false }
  ]
};
