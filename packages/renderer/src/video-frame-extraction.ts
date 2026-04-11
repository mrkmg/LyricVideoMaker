import { mkdtemp, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import type {
  PreparedSceneStackData,
  RenderJob,
  SceneAssetAccessor,
  ValidatedSceneComponentInstance
} from "@lyric-video-maker/core";
import {
  FFMPEG_EXECUTABLE,
  isVideoFrameExtractionEnabled,
  VIDEO_FRAME_URL_PREFIX
} from "./constants";
import { isAbortError } from "./abort";
import { runCommand } from "./ffmpeg/run-command";
import type { RenderLogger } from "./types";

export const VIDEO_FRAME_EXTRACTION_PREPARED_KEY = "__videoFrameExtraction";

export interface VideoFrameExtractionPrepared extends Record<string, unknown> {
  mode: "image-sequence";
  extractionId: string;
  urlPrefix: string;
  outputFps: number;
  frameCount: number;
  tempDir: string;
}

export interface VideoFrameExtractionEntry {
  instanceId: string;
  extractionId: string;
  tempDir: string;
  frameCount: number;
  outputFps: number;
}

export interface VideoFrameExtractionResult {
  enabled: boolean;
  entries: VideoFrameExtractionEntry[];
}

export function renderUsesVideoComponents(components: ValidatedSceneComponentInstance[]) {
  return components.some((component) => component.enabled && component.componentId === "video");
}

export async function prepareVideoFrameExtractions({
  job,
  components,
  assets,
  prepared,
  signal,
  logger,
  runFfmpeg = runCommand
}: {
  job: RenderJob;
  components: ValidatedSceneComponentInstance[];
  assets: Pick<SceneAssetAccessor, "getPath">;
  prepared: PreparedSceneStackData;
  signal?: AbortSignal;
  logger: RenderLogger;
  runFfmpeg?: (command: string, args: string[], signal?: AbortSignal) => Promise<string>;
}): Promise<VideoFrameExtractionResult> {
  const enabled = isVideoFrameExtractionEnabled();
  const videoComponents = components.filter((component) => component.enabled && component.componentId === "video");

  if (videoComponents.length === 0) {
    return { enabled, entries: [] };
  }

  logger.info(`Video frame extraction ${enabled ? "enabled" : "disabled"} for final render.`);
  if (!enabled) {
    return { enabled: false, entries: [] };
  }

  const entries: VideoFrameExtractionEntry[] = [];
  for (const instance of videoComponents) {
    const sourcePath = assets.getPath(instance.id, "source");
    if (!sourcePath) {
      continue;
    }

    const safeInstanceId = instance.id.replace(/[^a-zA-Z0-9_-]/g, "-") || "video";
    const tempDir = await mkdtemp(join(tmpdir(), `lyric-video-frames-${safeInstanceId}-`));
    const extractionId = basename(tempDir);
    const outputPattern = join(tempDir, "frame-%08d.jpg");

    try {
      await runFfmpeg(
        FFMPEG_EXECUTABLE,
        [
          "-hide_banner",
          "-y",
          "-i",
          sourcePath,
          "-an",
          "-r",
          String(job.video.fps),
          "-q:v",
          "2",
          "-f",
          "image2",
          outputPattern
        ],
        signal
      );
      const frameCount = await countExtractedJpegFrames(tempDir);
      if (frameCount <= 0) {
        throw new Error("ffmpeg produced no JPEG frames.");
      }

      const metadata: VideoFrameExtractionPrepared = {
        mode: "image-sequence",
        extractionId,
        urlPrefix: `${VIDEO_FRAME_URL_PREFIX}${encodeURIComponent(extractionId)}/`,
        outputFps: job.video.fps,
        frameCount,
        tempDir
      };
      prepared[instance.id] = {
        ...(prepared[instance.id] ?? {}),
        [VIDEO_FRAME_EXTRACTION_PREPARED_KEY]: metadata
      };
      entries.push({
        instanceId: instance.id,
        extractionId,
        tempDir,
        frameCount,
        outputFps: job.video.fps
      });
      logger.info(
        `Extracted ${frameCount} JPEG video frame${frameCount === 1 ? "" : "s"} for component "${instance.id}".`
      );
    } catch (error) {
      await cleanupVideoFrameExtractions([{ instanceId: instance.id, extractionId, tempDir, frameCount: 0, outputFps: job.video.fps }]);
      if (isAbortError(error)) {
        throw error;
      }
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Video frame extraction failed for component "${instance.id}": ${message}`);
    }
  }

  return { enabled: true, entries };
}

export async function cleanupVideoFrameExtractions(entries: VideoFrameExtractionEntry[]) {
  await Promise.allSettled(
    entries.map((entry) => rm(entry.tempDir, { recursive: true, force: true }))
  );
}

export function mapVideoPlaybackTimeToExtractedFrame({
  targetTimeSeconds,
  fps,
  frameCount
}: {
  targetTimeSeconds: number;
  fps: number;
  frameCount: number;
}) {
  const rawFrame = Math.floor(Math.max(0, targetTimeSeconds) * fps) + 1;
  return Math.max(1, Math.min(frameCount, rawFrame));
}

export function formatExtractedFrameName(frameNumber: number) {
  return `frame-${String(frameNumber).padStart(8, "0")}.jpg`;
}

async function countExtractedJpegFrames(tempDir: string) {
  const files = await readdir(tempDir);
  return files.filter((file) => /^frame-\d{8}\.jpg$/.test(file)).length;
}
