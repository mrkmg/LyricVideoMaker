import ffmpegPath from "ffmpeg-static";
import ffprobe from "ffprobe-static";

export const ASSET_URL_PREFIX = "http://lyric-video.local/assets/";
export const PROGRESS_INTERVAL_MS = 250;
export const FFMPEG_EXECUTABLE = resolveExecutablePath(ffmpegPath, "ffmpeg");
export const FFPROBE_EXECUTABLE = resolveExecutablePath(ffprobe.path, "ffprobe");
export const MUX_WRITE_TIMEOUT_MS =
  normalizePositiveInteger(process.env.LYRIC_VIDEO_FFMPEG_WRITE_TIMEOUT_MS) ?? 15000;
export const FRAME_STAGE_TIMEOUT_MS =
  normalizePositiveInteger(process.env.LYRIC_VIDEO_FRAME_STAGE_TIMEOUT_MS) ?? 15000;
export const WORKER_FRAME_RETRY_LIMIT =
  normalizePositiveInteger(process.env.LYRIC_VIDEO_WORKER_FRAME_RETRY_LIMIT) ?? 2;
export const FFMPEG_STDERR_BUFFER_LIMIT_BYTES = 64 * 1024;

export function resolveExecutablePath(
  bundledPath: string | null | undefined,
  fallbackCommand: string
) {
  return typeof bundledPath === "string" && bundledPath.trim() ? bundledPath : fallbackCommand;
}

export function normalizePositiveInteger(value: number | string | undefined) {
  if (typeof value === "number") {
    return Number.isInteger(value) && value > 0 ? value : undefined;
  }

  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : undefined;
  }

  return undefined;
}
