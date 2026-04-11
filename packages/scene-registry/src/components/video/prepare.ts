import type { ScenePrepareContext } from "@lyric-video-maker/core";
import { probeVideoFile, type VideoProbeResult } from "./probe";
import type { VideoComponentOptions } from "./options";

/**
 * Prepared data produced by the Video component prepare phase (T-053 R5).
 *
 * The probed metadata is consumed by:
 *   - The browser initial state builder to size the inner video element
 *   - The per-frame playback math (sync-with-song / loop / play-once-*)
 *   so the runtime never re-probes per frame.
 */
export interface VideoPrepared extends Record<string, unknown> {
  durationMs: number;
  width: number;
  height: number;
  frameRate: number;
  __videoFrameExtraction?: {
    mode: "image-sequence";
    extractionId: string;
    urlPrefix: string;
    outputFps: number;
    frameCount: number;
    tempDir: string;
  };
}

export async function prepareVideoComponent(
  ctx: ScenePrepareContext<VideoComponentOptions>,
  probe: (path: string, opts?: { signal?: AbortSignal }) => Promise<VideoProbeResult> = probeVideoFile
): Promise<VideoPrepared> {
  const sourcePath = ctx.assets.getPath(ctx.instance.id, "source");
  if (!sourcePath) {
    throw new Error(
      `Video component "${ctx.instance.id}" is missing a source path. Pick a video file before rendering.`
    );
  }
  try {
    const result = await probe(sourcePath, { signal: ctx.signal });
    return {
      durationMs: result.durationMs,
      width: result.width,
      height: result.height,
      frameRate: result.frameRate
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    // Surface a readable validation error without crashing the render.
    throw new Error(
      `Unable to probe video file for component "${ctx.instance.id}": ${message}`
    );
  }
}
