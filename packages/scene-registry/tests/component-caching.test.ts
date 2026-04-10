import { beforeEach, describe, expect, it, vi } from "vitest";

const pretextRuntime = vi.hoisted(() => ({
  measureNaturalWidth: vi.fn(() => 800),
  prepareWithSegments: vi.fn(() => ({ segments: [] }))
}));

vi.mock("@chenglou/pretext", () => pretextRuntime);

import { equalizerComponent, lyricsByLineComponent } from "../src/components";
import { lyricsByLineTestUtils } from "../src/components/lyrics-by-line";

describe("component caching", () => {
  beforeEach(() => {
    pretextRuntime.measureNaturalWidth.mockClear();
    pretextRuntime.prepareWithSegments.mockClear();
    lyricsByLineTestUtils.clearCaches();
  });

  it("keeps the equalizer prepare cache key stable for cosmetic-only option changes", () => {
    const baseOptions = equalizerComponent.defaultOptions;
    const cacheKey = equalizerComponent.getPrepareCacheKey?.({
      instance: {
        id: "equalizer-1",
        componentId: equalizerComponent.id,
        componentName: equalizerComponent.name,
        enabled: true,
        options: baseOptions
      },
      options: baseOptions,
      video: {
        width: 1920,
        height: 1080,
        fps: 30,
        durationMs: 1000,
        durationInFrames: 30
      },
      audioPath: "song.mp3"
    });
    const cosmeticOptions = {
      ...baseOptions,
      primaryColor: "#ff00ff",
      secondaryColor: "#00ff00",
      glowStrength: 15,
      placement: "top-center" as const
    };
    const cosmeticKey = equalizerComponent.getPrepareCacheKey?.({
      instance: {
        id: "equalizer-1",
        componentId: equalizerComponent.id,
        componentName: equalizerComponent.name,
        enabled: true,
        options: cosmeticOptions
      },
      options: cosmeticOptions,
      video: {
        width: 1920,
        height: 1080,
        fps: 30,
        durationMs: 1000,
        durationInFrames: 30
      },
      audioPath: "song.mp3"
    });

    expect(cacheKey).toBe(cosmeticKey);
  });

  it("memoizes repeated lyrics single-line width measurements", () => {
    const options = {
      ...lyricsByLineComponent.defaultOptions,
      forceSingleLine: true
    };
    const runtime = lyricsByLineComponent.browserRuntime!;

    runtime.getFrameState?.({
      instance: {
        id: "lyrics-1",
        componentId: lyricsByLineComponent.id,
        componentName: lyricsByLineComponent.name,
        enabled: true,
        options
      },
      options,
      frame: 0,
      timeMs: 100,
      video: {
        width: 1920,
        height: 1080,
        fps: 30,
        durationMs: 1000,
        durationInFrames: 30
      },
      lyrics: {
        current: {
          index: 1,
          startMs: 0,
          endMs: 500,
          text: "hello world",
          lines: ["hello", "world"]
        },
        next: null
      },
      assets: {
        getUrl: () => null
      },
      prepared: {}
    });
    runtime.getFrameState?.({
      instance: {
        id: "lyrics-1",
        componentId: lyricsByLineComponent.id,
        componentName: lyricsByLineComponent.name,
        enabled: true,
        options
      },
      options,
      frame: 1,
      timeMs: 150,
      video: {
        width: 1920,
        height: 1080,
        fps: 30,
        durationMs: 1000,
        durationInFrames: 30
      },
      lyrics: {
        current: {
          index: 1,
          startMs: 0,
          endMs: 500,
          text: "hello world",
          lines: ["hello", "world"]
        },
        next: null
      },
      assets: {
        getUrl: () => null
      },
      prepared: {}
    });

    expect(lyricsByLineTestUtils.getMeasurementCacheSize()).toBe(1);
  });
});
