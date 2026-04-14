import {
  createLyricRuntime,
  createLyricRuntimeCursor,
  frameToMs,
  getCueAt,
  getCueProgress,
  getCuesInRange,
  getNextCue,
  msToFrame
} from "../src/timeline";
import type { LyricCue } from "../src/types";

const cues: LyricCue[] = [
  { index: 1, startMs: 0, endMs: 1000, text: "One", lines: ["One"] },
  { index: 2, startMs: 1500, endMs: 2500, text: "Two", lines: ["Two"] },
  { index: 3, startMs: 2500, endMs: 4000, text: "Three", lines: ["Three"] }
];

describe("timeline helpers", () => {
  it("finds current and next cues around boundaries", () => {
    expect(getCueAt(cues, 0)?.text).toBe("One");
    expect(getCueAt(cues, 999)?.text).toBe("One");
    expect(getCueAt(cues, 1000)).toBeNull();
    expect(getNextCue(cues, 1000)?.text).toBe("Two");
    expect(getCueAt(cues, 2500)?.text).toBe("Three");
  });

  it("finds overlapping cue ranges", () => {
    expect(getCuesInRange(cues, 900, 2600).map((cue) => cue.text)).toEqual(["One", "Two", "Three"]);
  });

  it("computes cue progress with clamping", () => {
    expect(getCueProgress(cues[0], -100)).toBe(0);
    expect(getCueProgress(cues[0], 500)).toBe(0.5);
    expect(getCueProgress(cues[0], 1500)).toBe(1);
  });

  it("converts time and frames", () => {
    expect(msToFrame(1000, 30)).toBe(30);
    expect(frameToMs(30, 30)).toBe(1000);
  });

  it("round-trips frameToMs → msToFrame without floating-point drift", () => {
    for (const fps of [24, 25, 30, 48, 50, 60]) {
      for (let frame = 0; frame < 8000; frame++) {
        const ms = frameToMs(frame, fps);
        const roundTrip = msToFrame(ms, fps);
        if (roundTrip !== frame) {
          throw new Error(
            `Round-trip failed at fps=${fps} frame=${frame}: ` +
            `frameToMs=${ms}, msToFrame=${roundTrip}`
          );
        }
      }
    }
  });

  it("builds a frame runtime", () => {
    const runtime = createLyricRuntime(cues, 1600);
    expect(runtime.current?.text).toBe("Two");
    expect(runtime.next?.text).toBe("Three");
  });

  it("advances through cues with a sequential runtime cursor", () => {
    const cursor = createLyricRuntimeCursor(cues, 0);

    expect(cursor.getRuntimeAt(500).current?.text).toBe("One");
    expect(cursor.getRuntimeAt(1100).current).toBeNull();
    expect(cursor.getRuntimeAt(1100).next?.text).toBe("Two");
    expect(cursor.getRuntimeAt(1600).current?.text).toBe("Two");
    expect(cursor.getRuntimeAt(3200).current?.text).toBe("Three");
    expect(cursor.getRuntimeAt(4500).current).toBeNull();
    expect(cursor.getRuntimeAt(4500).next).toBeNull();
  });

  it("resets the sequential runtime cursor when time goes backwards", () => {
    const cursor = createLyricRuntimeCursor(cues, 3200);

    expect(cursor.getRuntimeAt(3200).current?.text).toBe("Three");
    expect(cursor.getRuntimeAt(400).current?.text).toBe("One");
    expect(cursor.getRuntimeAt(400).next?.text).toBe("Two");
  });
});
