import { existsSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { RenderJob, ValidatedSceneComponentInstance } from "@lyric-video-maker/core";
import { createAbortError } from "../src/abort";
import { isVideoFrameExtractionEnabled } from "../src/constants";
import {
  cleanupVideoFrameExtractions,
  formatExtractedFrameName,
  mapVideoPlaybackTimeToExtractedFrame,
  prepareVideoFrameExtractions,
  VIDEO_FRAME_EXTRACTION_PREPARED_KEY
} from "../src/video-frame-extraction";

const logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };

const videoComponent: ValidatedSceneComponentInstance = {
  id: "video-1",
  componentId: "video",
  componentName: "Video",
  enabled: true,
  options: { source: "C:/tmp/clip.mp4" }
};

const job: RenderJob = {
  id: "job-1",
  audioPath: "song.mp3",
  subtitlePath: "song.srt",
  outputPath: "out.mp4",
  sceneId: "scene",
  sceneName: "Scene",
  components: [videoComponent],
  video: { width: 1920, height: 1080, fps: 30, durationMs: 1000, durationInFrames: 30 },
  lyrics: [],
  createdAt: "2026-01-01T00:00:00.000Z"
};

afterEach(() => {
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});

describe("video frame extraction flag", () => {
  it("defaults off and enables only with value 1", () => {
    expect(isVideoFrameExtractionEnabled(undefined)).toBe(false);
    expect(isVideoFrameExtractionEnabled("0")).toBe(false);
    expect(isVideoFrameExtractionEnabled("true")).toBe(false);
    expect(isVideoFrameExtractionEnabled("1")).toBe(true);
  });
});

describe("prepareVideoFrameExtractions", () => {
  it("does not augment prepared data when flag is off", async () => {
    vi.stubEnv("LYRIC_VIDEO_VIDEO_FRAME_EXTRACTION", "0");
    const prepared = { "video-1": { durationMs: 1000 } };

    const result = await prepareVideoFrameExtractions({
      job,
      components: [videoComponent],
      assets: { getPath: () => "C:/tmp/clip.mp4" },
      prepared,
      logger
    });

    expect(result.enabled).toBe(false);
    expect(result.entries).toHaveLength(0);
    expect(prepared["video-1"][VIDEO_FRAME_EXTRACTION_PREPARED_KEY]).toBeUndefined();
  });

  it("creates extraction metadata and removes temp dirs", async () => {
    vi.stubEnv("LYRIC_VIDEO_VIDEO_FRAME_EXTRACTION", "1");
    const prepared = { "video-1": { durationMs: 1000 } };
    const runFfmpeg = vi.fn(async (_command: string, args: string[]) => {
      const pattern = args[args.length - 1];
      const dir = dirname(pattern);
      await mkdir(dir, { recursive: true });
      await writeFile(pattern.replace("%08d", "00000001"), Buffer.from([1]));
      await writeFile(pattern.replace("%08d", "00000002"), Buffer.from([2]));
      return "";
    });

    const result = await prepareVideoFrameExtractions({
      job,
      components: [videoComponent],
      assets: { getPath: () => "C:/tmp/clip.mp4" },
      prepared,
      logger,
      runFfmpeg
    });

    expect(runFfmpeg).toHaveBeenCalledTimes(1);
    expect(result.entries).toHaveLength(1);
    const metadata = prepared["video-1"][VIDEO_FRAME_EXTRACTION_PREPARED_KEY] as Record<string, unknown>;
    expect(metadata.mode).toBe("image-sequence");
    expect(metadata.outputFps).toBe(30);
    expect(metadata.frameCount).toBe(2);
    expect(String(metadata.urlPrefix)).toContain(result.entries[0].extractionId);
    expect(existsSync(result.entries[0].tempDir)).toBe(true);

    await cleanupVideoFrameExtractions(result.entries);
    expect(existsSync(result.entries[0].tempDir)).toBe(false);
  });

  it("cleans temp dir when ffmpeg extraction fails", async () => {
    vi.stubEnv("LYRIC_VIDEO_VIDEO_FRAME_EXTRACTION", "1");
    let createdDir = "";
    const runFfmpeg = vi.fn(async (_command: string, args: string[]) => {
      createdDir = dirname(args[args.length - 1]);
      await mkdir(createdDir, { recursive: true });
      throw new Error("ffmpeg boom");
    });

    await expect(
      prepareVideoFrameExtractions({
        job,
        components: [videoComponent],
        assets: { getPath: () => "C:/tmp/clip.mp4" },
        prepared: { "video-1": { durationMs: 1000 } },
        logger,
        runFfmpeg
      })
    ).rejects.toThrow(/Video frame extraction failed/);

    expect(createdDir).not.toBe("");
    expect(existsSync(createdDir)).toBe(false);
  });

  it("preserves abort errors after cleaning temp dir", async () => {
    vi.stubEnv("LYRIC_VIDEO_VIDEO_FRAME_EXTRACTION", "1");
    let createdDir = "";
    const runFfmpeg = vi.fn(async (_command: string, args: string[]) => {
      createdDir = dirname(args[args.length - 1]);
      await mkdir(createdDir, { recursive: true });
      throw createAbortError();
    });

    await expect(
      prepareVideoFrameExtractions({
        job,
        components: [videoComponent],
        assets: { getPath: () => "C:/tmp/clip.mp4" },
        prepared: { "video-1": { durationMs: 1000 } },
        logger,
        runFfmpeg
      })
    ).rejects.toMatchObject({ name: "AbortError" });

    expect(createdDir).not.toBe("");
    expect(existsSync(createdDir)).toBe(false);
  });

  it("maps playback time to clamped extracted frame names", () => {
    expect(mapVideoPlaybackTimeToExtractedFrame({ targetTimeSeconds: 0, fps: 30, frameCount: 90 })).toBe(1);
    expect(mapVideoPlaybackTimeToExtractedFrame({ targetTimeSeconds: 1.2, fps: 30, frameCount: 90 })).toBe(37);
    expect(mapVideoPlaybackTimeToExtractedFrame({ targetTimeSeconds: 99, fps: 30, frameCount: 90 })).toBe(90);
    expect(formatExtractedFrameName(37)).toBe("frame-00000037.jpg");
  });
});
