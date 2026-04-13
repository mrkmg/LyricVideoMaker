import { describe, expect, it } from "vitest";
import {
  DEFAULT_TRANSFORM_OPTIONS,
  TRANSFORM_ANCHOR_VALUES,
  transformCategory,
  type TransformOptions
} from "../src/shared";

describe("TransformOptions defaults", () => {
  it("place a centered visible element with no rotation or flip", () => {
    expect(DEFAULT_TRANSFORM_OPTIONS).toEqual<TransformOptions>({
      x: 0,
      y: 0,
      width: 100,
      height: 100,
      anchor: "top-left",
      rotation: 0,
      flipHorizontal: false,
      flipVertical: false
    });
  });

  it("expose the nine canonical anchor values", () => {
    expect(TRANSFORM_ANCHOR_VALUES).toHaveLength(9);
    expect(TRANSFORM_ANCHOR_VALUES).toEqual([
      "top-left",
      "top-center",
      "top-right",
      "middle-left",
      "middle-center",
      "middle-right",
      "bottom-left",
      "bottom-center",
      "bottom-right"
    ]);
  });
});

describe("transformCategory", () => {
  it("is a collapsible category entry", () => {
    expect(transformCategory.type).toBe("category");
    expect(transformCategory.id).toBe("transform");
  });

  it("exposes all nine transform fields in the editor", () => {
    const fieldIds = transformCategory.options.map((f) => f.id).sort();
    expect(fieldIds).toEqual(
      [
        "x",
        "y",
        "width",
        "height",
        "anchor",
        "rotation",
        "flipHorizontal",
        "flipVertical"
      ].sort()
    );
  });

  it("allows off-canvas position fields for slide-in effects", () => {
    const x = transformCategory.options.find((f) => f.id === "x");
    const y = transformCategory.options.find((f) => f.id === "y");
    if (x?.type !== "number" || y?.type !== "number") {
      throw new Error("x and y must be number fields");
    }
    expect(x.min).toBeLessThan(0);
    expect(x.max).toBeGreaterThan(100);
    expect(y.min).toBeLessThan(0);
    expect(y.max).toBeGreaterThan(100);
  });

  it("allows oversized elements in size fields", () => {
    const w = transformCategory.options.find((f) => f.id === "width");
    const h = transformCategory.options.find((f) => f.id === "height");
    if (w?.type !== "number" || h?.type !== "number") {
      throw new Error("width and height must be number fields");
    }
    expect(w.max).toBeGreaterThan(100);
    expect(h.max).toBeGreaterThan(100);
  });

  it("accepts a full negative-to-positive rotation range", () => {
    const rotation = transformCategory.options.find((f) => f.id === "rotation");
    if (rotation?.type !== "number") {
      throw new Error("rotation must be a number field");
    }
    expect(rotation.min).toBeLessThanOrEqual(-360);
    expect(rotation.max).toBeGreaterThanOrEqual(360);
  });

  it("exposes the anchor as a select with all nine values", () => {
    const anchor = transformCategory.options.find((f) => f.id === "anchor");
    if (anchor?.type !== "select") {
      throw new Error("anchor must be a select field");
    }
    expect(anchor.options.map((o) => o.value).sort()).toEqual(
      [...TRANSFORM_ANCHOR_VALUES].sort()
    );
  });
});
