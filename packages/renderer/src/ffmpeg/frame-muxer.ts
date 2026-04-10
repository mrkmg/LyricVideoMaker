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
import { writeFrameToMuxerInput } from "./frame-writer";

export function startFrameMuxer(
  job: RenderJob,
  signal: AbortSignal | undefined,
  logger: RenderLogger,
  diagnostics?: MuxPipelineDiagnostics
): FrameMuxer {
  let aborted = false;
  let finished = false;

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
      "-c:v",
      "libx264",
      "-pix_fmt",
      "yuv420p",
      "-c:a",
      "aac",
      "-movflags",
      "+faststart",
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
        exitPromise,
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
