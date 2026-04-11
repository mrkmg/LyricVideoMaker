import { describe, expect, it } from "vitest";
import type { VideoSettings } from "@lyric-video-maker/core";
import {
  DEFAULT_VIDEO_OPTIONS,
  videoComponent,
  type VideoComponentOptions
} from "../src/components/video";
import { computeVideoPlaybackState } from "../src/components/video/playback";

const video: VideoSettings = {
  width: 1920,
  height: 1080,
  fps: 30,
  durationMs: 30_000,
  durationInFrames: 900
};

const SHORT_CLIP_DURATION_MS = 5_000; // simulated 5s clip
const ONE_FRAME_MS = 1000 / 30;

function opts(overrides: Partial<VideoComponentOptions>): VideoComponentOptions {
  return {
    ...DEFAULT_VIDEO_OPTIONS,
    ...overrides,
    source: "/synthetic/clip.mp4"
  };
}

/**
 * T-059 — cavekit-video-component R10 verification.
 *
 * Smoke-tests the four playback modes through a simulated 30-second
 * render against a synthetic 5-second clip. Boundary timestamps (start,
 * middle, end + 1 frame) are checked per mode without requiring an
 * actual playwright preview. Renderer-owned frame extraction and route
 * handling are covered in renderer package tests.
 */
describe("T-059 — Video component end-to-end smoke", () => {
  describe("preview plays a short clip across all four playback modes", () => {
    it.each([
      "sync-with-song",
      "loop",
      "play-once-clamp",
      "play-once-hide"
    ] as const)("mode=%s produces a frame state for the first frame", (playbackMode) => {
      if (!videoComponent.browserRuntime?.getFrameState) {
        throw new Error("video browserRuntime missing");
      }
      const state = videoComponent.browserRuntime.getFrameState({
        instance: {
          id: "v1",
          componentId: "video",
          componentName: "Video",
          enabled: true,
          options: opts({ playbackMode })
        },
        options: opts({ playbackMode }),
        frame: 0,
        timeMs: 0,
        video,
        lyrics: { current: null, next: null, all: [] },
        assets: { getUrl: () => "/asset/clip.mp4" },
        prepared: {
          durationMs: SHORT_CLIP_DURATION_MS,
          width: 640,
          height: 360,
          frameRate: 30
        }
      });
      expect(state).toBeDefined();
    });
  });

  describe("thirty-second simulated render keeps frame sync per mode", () => {
    function simulateRender(playbackMode: VideoComponentOptions["playbackMode"]) {
      const positions: number[] = [];
      const hidden: boolean[] = [];
      for (let frame = 0; frame < video.durationInFrames; frame += 1) {
        const timeMs = (frame / video.fps) * 1000;
        const r = computeVideoPlaybackState({
          options: { playbackMode, videoStartOffsetMs: 0, playbackSpeed: 1, startTime: 0 },
          durationMs: SHORT_CLIP_DURATION_MS,
          timeMs
        });
        positions.push(r.targetTimeSeconds);
        hidden.push(r.hidden);
      }
      return { positions, hidden };
    }

    it("sync-with-song: monotonic until clamp at clip end", () => {
      const { positions, hidden } = simulateRender("sync-with-song");
      // First N frames advance linearly until reaching clip duration.
      for (let i = 1; i < positions.length; i += 1) {
        expect(positions[i]).toBeGreaterThanOrEqual(positions[i - 1] - 1e-9);
      }
      expect(positions[positions.length - 1]).toBeCloseTo(SHORT_CLIP_DURATION_MS / 1000);
      expect(hidden.every((v) => v === false)).toBe(true);
    });

    it("loop: positions stay within [0, duration) and the wrap pattern repeats", () => {
      const { positions, hidden } = simulateRender("loop");
      for (const p of positions) {
        expect(p).toBeGreaterThanOrEqual(0);
        expect(p).toBeLessThan(SHORT_CLIP_DURATION_MS / 1000 + 1e-6);
      }
      // After the first wrap (~5s into the song) the position should
      // have wrapped back to near 0.
      const wrapFrame = Math.floor((SHORT_CLIP_DURATION_MS + 100) / 1000 * video.fps);
      expect(positions[wrapFrame]).toBeLessThan(0.5);
      expect(hidden.every((v) => v === false)).toBe(true);
    });

    it("play-once-clamp: holds last frame after clip end", () => {
      const { positions, hidden } = simulateRender("play-once-clamp");
      const lastFrame = positions[positions.length - 1];
      expect(lastFrame).toBeGreaterThan(SHORT_CLIP_DURATION_MS / 1000 - 1);
      expect(hidden.every((v) => v === false)).toBe(true);
    });

    it("play-once-hide: hidden after clip end", () => {
      const { hidden } = simulateRender("play-once-hide");
      // Some frames hidden after first 5 seconds.
      const lateHidden = hidden.slice(Math.floor(6 * video.fps));
      expect(lateHidden.every((v) => v === true)).toBe(true);
    });
  });

  describe("boundary timestamps (start, middle, end + 1 frame)", () => {
    const cases: VideoComponentOptions["playbackMode"][] = [
      "sync-with-song",
      "loop",
      "play-once-clamp",
      "play-once-hide"
    ];
    for (const mode of cases) {
      it(`mode=${mode} produces documented behavior at start, middle, end+1`, () => {
        const optsBase = { playbackMode: mode, videoStartOffsetMs: 0, playbackSpeed: 1, startTime: 0 };
        const start = computeVideoPlaybackState({
          options: optsBase,
          durationMs: SHORT_CLIP_DURATION_MS,
          timeMs: 0
        });
        const middle = computeVideoPlaybackState({
          options: optsBase,
          durationMs: SHORT_CLIP_DURATION_MS,
          timeMs: SHORT_CLIP_DURATION_MS / 2
        });
        const endPlusOne = computeVideoPlaybackState({
          options: optsBase,
          durationMs: SHORT_CLIP_DURATION_MS,
          timeMs: SHORT_CLIP_DURATION_MS + ONE_FRAME_MS
        });

        expect(start.targetTimeSeconds).toBe(0);
        expect(middle.targetTimeSeconds).toBeCloseTo(SHORT_CLIP_DURATION_MS / 2000);

        switch (mode) {
          case "sync-with-song":
            expect(endPlusOne.targetTimeSeconds).toBe(SHORT_CLIP_DURATION_MS / 1000);
            break;
          case "loop":
            // wrapped back near 0
            expect(endPlusOne.targetTimeSeconds).toBeLessThan(0.1);
            break;
          case "play-once-clamp":
            expect(endPlusOne.hidden).toBe(false);
            expect(endPlusOne.targetTimeSeconds).toBeGreaterThan(SHORT_CLIP_DURATION_MS / 1000 - 0.1);
            break;
          case "play-once-hide":
            expect(endPlusOne.hidden).toBe(true);
            break;
        }
      });
    }
  });

  it("uses extracted image frames as the documented playback path", () => {
    expect(videoComponent.description).toMatch(/extracted image frames/);
    // Component prepare still only probes metadata. Renderer-owned
    // extraction augments prepared data before live DOM mount.
    expect(typeof videoComponent.prepare).toBe("function");
  });

  it("audio: video element is muted, song remains the only audio source (T-058)", () => {
    expect(DEFAULT_VIDEO_OPTIONS.muted).toBe(true);
  });
});
