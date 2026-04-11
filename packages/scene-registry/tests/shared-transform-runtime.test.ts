import { describe, expect, it } from "vitest";
import {
  DEFAULT_TRANSFORM_OPTIONS,
  TRANSFORM_ANCHOR_VALUES
} from "../src/shared/transform";
import { computeTransformStyle } from "../src/shared/transform-runtime";

const canvas = { width: 1920, height: 1080 };

describe("computeTransformStyle — anchor translation", () => {
  it.each(TRANSFORM_ANCHOR_VALUES)(
    "translates so the %s anchor aligns with the requested position",
    (anchor) => {
      const style = computeTransformStyle(
        { ...DEFAULT_TRANSFORM_OPTIONS, x: 25, y: 75, anchor },
        canvas
      );
      expect(style.left).toBe("25%");
      expect(style.top).toBe("75%");
      // transform string should contain the translate
      expect(style.transform).toContain("translate(");
    }
  );

  it("top-left anchor has translate(0%, 0%)", () => {
    const style = computeTransformStyle(
      { ...DEFAULT_TRANSFORM_OPTIONS, anchor: "top-left" },
      canvas
    );
    expect(style.transform).toContain("translate(0%, 0%)");
  });

  it("middle-center anchor has translate(-50%, -50%)", () => {
    const style = computeTransformStyle(
      { ...DEFAULT_TRANSFORM_OPTIONS, anchor: "middle-center" },
      canvas
    );
    expect(style.transform).toContain("translate(-50%, -50%)");
  });

  it("bottom-right anchor has translate(-100%, -100%)", () => {
    const style = computeTransformStyle(
      { ...DEFAULT_TRANSFORM_OPTIONS, anchor: "bottom-right" },
      canvas
    );
    expect(style.transform).toContain("translate(-100%, -100%)");
  });
});

describe("computeTransformStyle — rotation", () => {
  it("applies rotation around visual center via transformOrigin 50% 50%", () => {
    const style = computeTransformStyle(
      { ...DEFAULT_TRANSFORM_OPTIONS, rotation: 45 },
      canvas
    );
    expect(style.transform).toContain("rotate(45deg)");
    expect(style.transformOrigin).toBe("50% 50%");
  });

  it("applies rotation after anchor translation (anchor first, then rotate)", () => {
    const style = computeTransformStyle(
      { ...DEFAULT_TRANSFORM_OPTIONS, anchor: "middle-center", rotation: 90 },
      canvas
    );
    const t = style.transform as string;
    expect(t.indexOf("translate(")).toBeLessThan(t.indexOf("rotate("));
  });

  it("omits rotate() when rotation is zero (avoids unnecessary transform)", () => {
    const style = computeTransformStyle({ ...DEFAULT_TRANSFORM_OPTIONS, rotation: 0 }, canvas);
    expect(style.transform).not.toContain("rotate(");
  });
});

describe("computeTransformStyle — flips", () => {
  it("horizontal flip composes with rotation via scale(-1, 1)", () => {
    const style = computeTransformStyle(
      { ...DEFAULT_TRANSFORM_OPTIONS, flipHorizontal: true, rotation: 30 },
      canvas
    );
    expect(style.transform).toContain("scale(-1, 1)");
    expect(style.transform).toContain("rotate(30deg)");
  });

  it("vertical flip uses scale(1, -1)", () => {
    const style = computeTransformStyle(
      { ...DEFAULT_TRANSFORM_OPTIONS, flipVertical: true },
      canvas
    );
    expect(style.transform).toContain("scale(1, -1)");
  });

  it("both flips compose to scale(-1, -1)", () => {
    const style = computeTransformStyle(
      { ...DEFAULT_TRANSFORM_OPTIONS, flipHorizontal: true, flipVertical: true },
      canvas
    );
    expect(style.transform).toContain("scale(-1, -1)");
  });

  it("flips are independent of rotation (no interference)", () => {
    const flipOnly = computeTransformStyle(
      { ...DEFAULT_TRANSFORM_OPTIONS, flipHorizontal: true },
      canvas
    );
    const rotOnly = computeTransformStyle(
      { ...DEFAULT_TRANSFORM_OPTIONS, rotation: 90 },
      canvas
    );
    const both = computeTransformStyle(
      { ...DEFAULT_TRANSFORM_OPTIONS, flipHorizontal: true, rotation: 90 },
      canvas
    );
    expect(both.transform).toContain("scale(-1, 1)");
    expect(both.transform).toContain("rotate(90deg)");
  });
});

describe("computeTransformStyle — purity", () => {
  it("does not mutate input options", () => {
    const input = { ...DEFAULT_TRANSFORM_OPTIONS };
    const snapshot = JSON.stringify(input);
    computeTransformStyle(input, canvas);
    expect(JSON.stringify(input)).toBe(snapshot);
  });

  it("returns stable output for identical inputs", () => {
    const opts = { ...DEFAULT_TRANSFORM_OPTIONS, x: 30, y: 40, rotation: 15 };
    const a = computeTransformStyle(opts, canvas);
    const b = computeTransformStyle(opts, canvas);
    expect(a).toEqual(b);
  });
});

describe("computeTransformStyle — positional passthrough", () => {
  it("passes through x, y, width, height as percentages", () => {
    const style = computeTransformStyle(
      { ...DEFAULT_TRANSFORM_OPTIONS, x: 33, y: 66, width: 80, height: 20 },
      canvas
    );
    expect(style.left).toBe("33%");
    expect(style.top).toBe("66%");
    expect(style.width).toBe("80%");
    expect(style.height).toBe("20%");
    expect(style.position).toBe("absolute");
  });

  it("preserves off-canvas positions (supports slide-in effects)", () => {
    const style = computeTransformStyle(
      { ...DEFAULT_TRANSFORM_OPTIONS, x: -50, y: 200 },
      canvas
    );
    expect(style.left).toBe("-50%");
    expect(style.top).toBe("200%");
  });

  it("preserves oversized dimensions (> 100%)", () => {
    const style = computeTransformStyle(
      { ...DEFAULT_TRANSFORM_OPTIONS, width: 250, height: 150 },
      canvas
    );
    expect(style.width).toBe("250%");
    expect(style.height).toBe("150%");
  });
});
