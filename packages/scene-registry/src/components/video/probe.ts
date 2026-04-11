import { spawn } from "node:child_process";

/** Result of probing a video file. */
export interface VideoProbeResult {
  durationMs: number;
  width: number;
  height: number;
  frameRate: number;
}

/**
 * Probe a video file for duration, pixel dimensions, and frame rate.
 *
 * Spawns ffprobe (expected on PATH — the renderer package bundles its
 * own ffprobe-static, but scene-registry does not depend on it directly
 * to avoid a circular package reference). The ffprobe binary is
 * available in the shipping desktop build and in developer environments
 * where the renderer package has already been installed.
 *
 * On failure the function throws a readable Error that the Video
 * component prepare phase surfaces as a scene validation error without
 * crashing the render (T-053 AC2).
 */
export async function probeVideoFile(
  videoPath: string,
  options: { binary?: string; signal?: AbortSignal } = {}
): Promise<VideoProbeResult> {
  const binary = options.binary ?? "ffprobe";
  const args = [
    "-v",
    "error",
    "-select_streams",
    "v:0",
    "-show_entries",
    "stream=width,height,r_frame_rate,duration,nb_frames",
    "-show_entries",
    "format=duration",
    "-of",
    "json",
    videoPath
  ];

  const stdout = await runBinary(binary, args, options.signal);

  let parsed: unknown;
  try {
    parsed = JSON.parse(stdout);
  } catch (error) {
    throw new Error(
      `Unable to parse ffprobe output for ${videoPath}: ${error instanceof Error ? error.message : String(error)}`
    );
  }

  const stream = extractFirstStream(parsed);
  if (!stream) {
    throw new Error(`ffprobe returned no video stream for ${videoPath}.`);
  }

  const width = toPositiveInt(stream.width);
  const height = toPositiveInt(stream.height);
  const frameRate = parseFrameRate(stream.r_frame_rate);
  const durationMs = Math.round(parseDurationSeconds(parsed, stream) * 1000);

  if (!width || !height) {
    throw new Error(`ffprobe returned invalid dimensions for ${videoPath}.`);
  }
  if (!Number.isFinite(frameRate) || frameRate <= 0) {
    throw new Error(`ffprobe returned invalid frame rate for ${videoPath}.`);
  }
  if (!Number.isFinite(durationMs) || durationMs <= 0) {
    throw new Error(`ffprobe returned invalid duration for ${videoPath}.`);
  }

  return { durationMs, width, height, frameRate };
}

function runBinary(binary: string, args: string[], signal?: AbortSignal): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn(binary, args, { stdio: ["ignore", "pipe", "pipe"], signal });
    const stdoutChunks: Buffer[] = [];
    const stderrChunks: Buffer[] = [];
    child.stdout.on("data", (chunk: Buffer) => stdoutChunks.push(chunk));
    child.stderr.on("data", (chunk: Buffer) => stderrChunks.push(chunk));
    child.on("error", (error) => {
      reject(
        new Error(
          `Failed to invoke ${binary}: ${error.message}. Ensure ffprobe is installed and on PATH.`
        )
      );
    });
    child.on("close", (code) => {
      if (code !== 0) {
        const stderr = Buffer.concat(stderrChunks).toString("utf8").trim();
        reject(new Error(`${binary} exited ${code}${stderr ? `: ${stderr}` : ""}`));
        return;
      }
      resolve(Buffer.concat(stdoutChunks).toString("utf8"));
    });
  });
}

interface FfprobeStream {
  width?: number | string;
  height?: number | string;
  r_frame_rate?: string;
  duration?: string;
  nb_frames?: string;
}

function extractFirstStream(value: unknown): FfprobeStream | null {
  if (!value || typeof value !== "object") return null;
  const streams = (value as { streams?: unknown }).streams;
  if (!Array.isArray(streams) || streams.length === 0) return null;
  return streams[0] as FfprobeStream;
}

function parseDurationSeconds(parsed: unknown, stream: FfprobeStream): number {
  const streamDuration = Number(stream.duration);
  if (Number.isFinite(streamDuration) && streamDuration > 0) {
    return streamDuration;
  }
  const format = (parsed as { format?: { duration?: string } }).format;
  const formatDuration = Number(format?.duration);
  if (Number.isFinite(formatDuration) && formatDuration > 0) {
    return formatDuration;
  }
  return 0;
}

function parseFrameRate(value: string | undefined): number {
  if (!value) return 0;
  const [numerator, denominator] = value.split("/");
  const num = Number(numerator);
  const den = Number(denominator ?? "1");
  if (!Number.isFinite(num) || !Number.isFinite(den) || den === 0) {
    return 0;
  }
  return num / den;
}

function toPositiveInt(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? Math.round(n) : 0;
}
