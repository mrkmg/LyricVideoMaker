import { describe, expect, it } from "vitest";
import {
  DEFAULT_TIMING_OPTIONS,
  TIMING_EASING_VALUES,
  timingCategory,
  type TimingOptions
} from "../src/shared/timing";

describe("TimingOptions defaults", () => {
  it("produce an always-visible component with no fades", () => {
    expect(DEFAULT_TIMING_OPTIONS).toEqual<TimingOptions>({
      startTime: 0,
      endTime: 0,
      fadeInDuration: 0,
      fadeOutDuration: 0,
      easing: "linear"
    });
  });

  it("include the four canonical easing curves", () => {
    expect(TIMING_EASING_VALUES).toEqual(["linear", "ease-in", "ease-out", "ease-in-out"]);
  });
});

describe("timingCategory", () => {
  it("is a collapsed-by-default category entry", () => {
    expect(timingCategory.type).toBe("category");
    expect(timingCategory.id).toBe("timing");
    expect(timingCategory.defaultExpanded).toBe(false);
  });

  it("exposes all five timing fields", () => {
    const fieldIds = timingCategory.options.map((f) => f.id).sort();
    expect(fieldIds).toEqual(
      ["startTime", "endTime", "fadeInDuration", "fadeOutDuration", "easing"].sort()
    );
  });

  it("exposes easing as a select with all four values", () => {
    const easing = timingCategory.options.find((f) => f.id === "easing");
    if (easing?.type !== "select") {
      throw new Error("easing must be a select field");
    }
    expect(easing.options.map((o) => o.value).sort()).toEqual(
      [...TIMING_EASING_VALUES].sort()
    );
  });

  it("endTime default of 0 preserves the 'end of song' sentinel", () => {
    const endTime = timingCategory.options.find((f) => f.id === "endTime");
    if (endTime?.type !== "number") {
      throw new Error("endTime must be a number field");
    }
    expect(endTime.defaultValue).toBe(0);
  });
});
