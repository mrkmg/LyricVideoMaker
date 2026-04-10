import { isAbortError, throwIfAborted } from "../abort";
import { WORKER_FRAME_RETRY_LIMIT } from "../constants";
import type {
  FramePreviewSession,
  FramePreviewWorkerHandle,
  OrderedFrameWriteQueue,
  RenderLogger
} from "../types";

export async function renderWorkerFrames({
  workerHandle,
  workerIndex,
  workerCount,
  totalFrames,
  orderedFrameQueue,
  createWorkerSession,
  signal,
  logger,
  abort,
  onError,
  onFramesWritten
}: {
  workerHandle: FramePreviewWorkerHandle;
  workerIndex: number;
  workerCount: number;
  totalFrames: number;
  orderedFrameQueue: OrderedFrameWriteQueue;
  createWorkerSession: () => Promise<FramePreviewSession>;
  signal?: AbortSignal;
  logger: RenderLogger;
  abort: () => void;
  onError: (error: unknown) => void;
  onFramesWritten: (framesWritten: number) => void;
}) {
  try {
    for (let frame = workerIndex; frame < totalFrames; frame += workerCount) {
      throwIfAborted(signal);
      const renderedFrame = await renderFrameWithWorkerRecovery({
        workerHandle,
        frame,
        workerIndex,
        createWorkerSession,
        logger,
        signal
      });
      const framesWritten = await orderedFrameQueue.enqueue({
        frame: renderedFrame.frame,
        buffer: renderedFrame.png
      });
      onFramesWritten(framesWritten);
    }
  } catch (error) {
    if (!isAbortError(error)) {
      onError(error);
    }
    abort();
    throw error;
  }
}

export async function renderFrameWithWorkerRecovery({
  workerHandle,
  frame,
  workerIndex,
  createWorkerSession,
  logger,
  signal,
  retryLimit = WORKER_FRAME_RETRY_LIMIT
}: {
  workerHandle: FramePreviewWorkerHandle;
  frame: number;
  workerIndex: number;
  createWorkerSession: () => Promise<FramePreviewSession>;
  logger: RenderLogger;
  signal?: AbortSignal;
  retryLimit?: number;
}) {
  let attempt = 0;

  while (true) {
    throwIfAborted(signal);
    try {
      return await workerHandle.current.renderFrame({ frame });
    } catch (error) {
      attempt += 1;
      if (!isRecoverableWorkerRenderError(error) || attempt >= retryLimit) {
        throw error;
      }

      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.warn(
        `Worker ${workerIndex} hit a recoverable frame render failure at frame ${frame}; restarting Chromium session (${attempt}/${retryLimit - 1} retries). ${errorMessage}`
      );
      await disposeWorkerSession(workerHandle.current, logger, workerIndex);
      workerHandle.current = await createWorkerSession();
    }
  }
}

async function disposeWorkerSession(
  worker: FramePreviewSession,
  logger: RenderLogger,
  workerIndex: number
) {
  try {
    await worker.dispose();
  } catch (error) {
    logger.warn(
      `Worker ${workerIndex} Chromium session disposal failed during recovery. ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

function isRecoverableWorkerRenderError(error: unknown) {
  if (!(error instanceof Error)) {
    return false;
  }

  return (
    error.message.includes("timed out during") ||
    error.message.includes("Target page, context or browser has been closed") ||
    error.message.includes("Browser has been closed")
  );
}
