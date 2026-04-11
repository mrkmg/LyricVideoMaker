import { spawn } from "node:child_process";
import type { RenderJob } from "@lyric-video-maker/core";
import { createAbortError, isAbortError, throwIfAborted } from "../abort";
import {
  FFMPEG_EXECUTABLE,
  FFMPEG_STDERR_BUFFER_LIMIT_BYTES,
  MUX_WRITE_TIMEOUT_MS
} from "../constants";
import type { FrameMuxer, MuxPipelineDiagnostics, RenderLogger } from "../types";
import { createBoundedOutputBuffer } from "./bounded-output-buffer";
import { createMuxExitMonitor } from "./mux-exit-monitor";
import { writeFrameToMuxerInput } from "./frame-writer";

export function startFrameMuxer(
  job: RenderJob,
  signal: AbortSignal | undefined,
  logger: RenderLogger,
  diagnostics?: MuxPipelineDiagnostics
): FrameMuxer {
  let aborted = false;
  let finished = false;
  const outputArgs = getOutputArgs(job);

  const child = spawn(
    FFMPEG_EXECUTABLE,
    [
      "-y",
      "-f",
      "image2pipe",
      "-framerate",
      String(job.video.fps),
      "-vcodec",
      "png",
      "-i",
      "-",
      "-i",
      job.audioPath,
      ...outputArgs,
      "-shortest",
      job.outputPath
    ],
    {
      stdio: ["pipe", "ignore", "pipe"]
    }
  );

  if (diagnostics) {
    diagnostics.ffmpegPid = child.pid;
  }
  logger.info("Spawned ffmpeg muxer process.");

  const stderr = createBoundedOutputBuffer(FFMPEG_STDERR_BUFFER_LIMIT_BYTES);
  const exitMonitor = createMuxExitMonitor();
  const exitPromise = new Promise<void>((resolve, reject) => {
    child.stderr.on("data", (chunk) => {
      stderr.append(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    });
    child.on("error", reject);
    child.on("close", (code) => {
      cleanup();

      if (code === 0) {
        resolve();
        return;
      }

      if (aborted) {
        reject(createAbortError());
        return;
      }

      reject(
        new Error(`ffmpeg exited with code ${code}: ${stderr.toString()}`)
      );
    });
  });
  exitPromise.then(
    () => exitMonitor.markExited(null),
    (error) =>
      exitMonitor.markExited(error instanceof Error ? error : new Error(String(error)))
  );

  const abortHandler = () => {
    aborted = true;
    child.kill();
  };

  signal?.addEventListener("abort", abortHandler, { once: true });

  return {
    async writeFrame(frame) {
      if (finished) {
        throw new Error("Cannot write additional frames after the muxer has finished.");
      }

      throwIfAborted(signal);
      await writeFrameToMuxerInput({
        stdin: child.stdin,
        frame,
        logger,
        diagnostics,
        exitMonitor,
        timeoutMs: MUX_WRITE_TIMEOUT_MS
      });
    },
    async finish() {
      if (finished) {
        await exitPromise;
        return;
      }

      finished = true;
      child.stdin.end();
      await exitPromise;
      logger.info("ffmpeg muxing finished successfully.");
    },
    async abort() {
      if (finished) {
        return;
      }

      aborted = true;
      finished = true;
      child.stdin.end();
      child.kill();

      try {
        await exitPromise;
      } catch (error) {
        if (!isAbortError(error)) {
          throw error;
        }
      }
    }
  };

  function cleanup() {
    signal?.removeEventListener("abort", abortHandler);
  }
}

function getOutputArgs(job: RenderJob) {
  switch (job.render.encoding) {
    case "x265":
      return [
        "-c:v",
        "libx265",
        "-preset",
        getX265Preset(job.render.quality),
        "-crf",
        getX265Crf(job.render.quality),
        "-pix_fmt",
        "yuv420p",
        "-tag:v",
        "hvc1",
        "-c:a",
        "aac",
        "-movflags",
        "+faststart"
      ];
    case "webm":
      return [
        "-c:v",
        "libvpx-vp9",
        "-crf",
        getWebmCrf(job.render.quality),
        "-b:v",
        "0",
        "-cpu-used",
        getWebmCpuUsed(job.render.quality),
        "-pix_fmt",
        "yuv420p",
        "-c:a",
        "libopus"
      ];
    case "x264":
    default:
      return [
        "-c:v",
        "libx264",
        "-preset",
        getX264Preset(job.render.quality),
        "-crf",
        getX264Crf(job.render.quality),
        "-pix_fmt",
        "yuv420p",
        "-c:a",
        "aac",
        "-movflags",
        "+faststart"
      ];
  }
}

function getX264Preset(quality: RenderJob["render"]["quality"]) {
  switch (quality) {
    case "speed":
      return "veryfast";
    case "quality":
      return "slow";
    case "balanced":
    default:
      return "medium";
  }
}

function getX264Crf(quality: RenderJob["render"]["quality"]) {
  switch (quality) {
    case "speed":
      return "28";
    case "quality":
      return "18";
    case "balanced":
    default:
      return "23";
  }
}

function getX265Preset(quality: RenderJob["render"]["quality"]) {
  switch (quality) {
    case "speed":
      return "fast";
    case "quality":
      return "slow";
    case "balanced":
    default:
      return "medium";
  }
}

function getX265Crf(quality: RenderJob["render"]["quality"]) {
  switch (quality) {
    case "speed":
      return "32";
    case "quality":
      return "23";
    case "balanced":
    default:
      return "28";
  }
}

function getWebmCrf(quality: RenderJob["render"]["quality"]) {
  switch (quality) {
    case "speed":
      return "38";
    case "quality":
      return "28";
    case "balanced":
    default:
      return "32";
  }
}

function getWebmCpuUsed(quality: RenderJob["render"]["quality"]) {
  switch (quality) {
    case "speed":
      return "6";
    case "quality":
      return "2";
    case "balanced":
    default:
      return "4";
  }
}
