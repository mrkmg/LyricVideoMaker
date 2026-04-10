import type { Writable } from "node:stream";
import { FRAME_STAGE_TIMEOUT_MS } from "../constants";
import type { MuxPipelineDiagnostics, RenderLogger } from "../types";
import { formatMuxDiagnostics, traceMuxState } from "./mux-diagnostics";

export async function writeFrameToMuxerInput({
  stdin,
  frame,
  logger,
  diagnostics,
  exitPromise,
  timeoutMs
}: {
  stdin: Writable;
  frame: Buffer;
  logger: RenderLogger;
  diagnostics?: MuxPipelineDiagnostics;
  exitPromise?: Promise<void>;
  timeoutMs: number;
}) {
  const writeStartedAtMs = Date.now();
  if (diagnostics) {
    diagnostics.ffmpegLastWriteStartedAtMs = writeStartedAtMs;
  }

  await new Promise<void>((resolve, reject) => {
    let settled = false;
    let writeCallbackCompleted = false;
    let drainCompleted = false;
    let timeoutId: NodeJS.Timeout | undefined;

    const finishIfReady = () => {
      if (settled || !writeCallbackCompleted || !drainCompleted) {
        return;
      }

      settled = true;
      cleanup();
      if (diagnostics) {
        diagnostics.ffmpegFramesWritten += 1;
        diagnostics.ffmpegLastWriteCompletedAtMs = Date.now();
      }
      resolve();
    };

    const fail = (error: Error) => {
      if (settled) {
        return;
      }

      settled = true;
      cleanup();
      reject(error);
    };

    const cleanup = () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      stdin.off("drain", handleDrain);
      stdin.off("error", handleError);
      stdin.off("close", handleClose);
    };

    const handleDrain = () => {
      drainCompleted = true;
      finishIfReady();
    };

    const handleError = (error: Error) => {
      fail(error);
    };

    const handleClose = () => {
      fail(new Error("ffmpeg stdin closed before a frame write completed."));
    };

    stdin.on("error", handleError);
    stdin.on("close", handleClose);

    if (exitPromise) {
      void exitPromise.catch((error) => {
        const exitError = error instanceof Error ? error : new Error(String(error));
        fail(exitError);
      });
    }

    timeoutId = setTimeout(() => {
      const elapsedMs = Date.now() - writeStartedAtMs;
      logger.error(
        `ffmpeg stdin write stalled for ${elapsedMs}ms. ${formatMuxDiagnostics(diagnostics)}`
      );
      fail(
        new Error(
          `ffmpeg stdin write timed out after ${elapsedMs}ms. ${formatMuxDiagnostics(diagnostics)}`
        )
      );
    }, timeoutMs);

    const accepted = stdin.write(frame, (error) => {
      if (error) {
        fail(error);
        return;
      }

      writeCallbackCompleted = true;
      finishIfReady();
    });

    if (accepted) {
      drainCompleted = true;
      finishIfReady();
      return;
    }

    traceMuxState(logger, diagnostics, "ffmpeg-stdin-backpressure");
    stdin.once("drain", handleDrain);
  });
}

export function createFrameStageTimeoutError({
  sessionLabel,
  frame,
  stage
}: {
  sessionLabel: string;
  frame: number;
  stage: string;
}) {
  return new Error(
    `Chromium session ${sessionLabel} timed out during ${stage} for frame ${frame} after ${FRAME_STAGE_TIMEOUT_MS}ms.`
  );
}

export async function withTimeout<T>(
  operation: Promise<T>,
  timeoutError: Error,
  timeoutMs: number
) {
  let timer: NodeJS.Timeout | undefined;
  void operation.catch(() => {});

  try {
    return await Promise.race([
      operation,
      new Promise<T>((_resolve, reject) => {
        timer = setTimeout(() => {
          reject(timeoutError);
        }, timeoutMs);
      })
    ]);
  } finally {
    if (timer) {
      clearTimeout(timer);
    }
  }
}
