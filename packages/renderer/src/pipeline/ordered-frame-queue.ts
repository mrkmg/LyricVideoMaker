import { performance } from "node:perf_hooks";
import { throwIfAborted } from "../abort";
import { traceMuxState } from "../ffmpeg/mux-diagnostics";
import type {
  FrameWriteQueue,
  MuxPipelineDiagnostics,
  OrderedFrameWriteQueue,
  RenderLogger,
  RenderProfiler
} from "../types";

export function createOrderedFrameWriteQueue({
  totalFrames,
  frameQueue,
  signal,
  profiler,
  diagnostics,
  logger,
  maxPendingFrames = 4
}: {
  totalFrames: number;
  frameQueue: FrameWriteQueue;
  signal?: AbortSignal;
  profiler?: RenderProfiler;
  diagnostics?: MuxPipelineDiagnostics;
  logger?: RenderLogger;
  maxPendingFrames?: number;
}): OrderedFrameWriteQueue {
  let nextFrameToWrite = 0;
  let finished = false;
  let writeError: unknown;
  let pendingFrames = new Map<number, Buffer>();
  let spaceResolvers: (() => void)[] = [];
  let flushChain = Promise.resolve();

  return {
    async enqueue(frame) {
      if (finished) {
        throw new Error("Cannot enqueue frames after the ordered frame queue has finished.");
      }

      throwIfAborted(signal);
      if (writeError) {
        throw writeError;
      }

      const waitStartMs = profiler?.enabled ? performance.now() : 0;
      while (pendingFrames.size >= maxPendingFrames && frame.frame !== nextFrameToWrite) {
        traceMuxState(logger, diagnostics, "ordered-queue-waiting-for-space");
        await new Promise<void>((resolve) => {
          spaceResolvers.push(resolve);
        });
        throwIfAborted(signal);
        if (writeError) {
          throw writeError;
        }
      }

      if (profiler?.enabled) {
        profiler.stages.queueWait += performance.now() - waitStartMs;
      }

      if (frame.frame < nextFrameToWrite || pendingFrames.has(frame.frame)) {
        throw new Error(`Frame ${frame.frame} was submitted more than once.`);
      }

      pendingFrames.set(frame.frame, frame.buffer);
      if (diagnostics) {
        diagnostics.orderedPendingFrames = pendingFrames.size;
      }
      scheduleFlush();

      return nextFrameToWrite;
    },
    async finish() {
      finished = true;
      await flushChain;

      if (writeError) {
        throw writeError;
      }

      if (nextFrameToWrite !== totalFrames) {
        throw new Error(
          `Render finished with missing frames. Expected ${totalFrames}, wrote ${nextFrameToWrite}.`
        );
      }

      await frameQueue.finish();
    },
    async abort() {
      finished = true;
      pendingFrames.clear();
      releaseSpaceResolvers();
      await frameQueue.abort();
    }
  };

  function scheduleFlush() {
    const pendingFlush = flushChain.then(async () => {
      await flushPendingFrames();
    });
    flushChain = pendingFlush.catch((error) => {
      writeError ??= error;
      releaseSpaceResolvers();
    });
  }

  async function flushPendingFrames() {
    while (pendingFrames.has(nextFrameToWrite)) {
      if (diagnostics) {
        diagnostics.orderedNextFrameToWrite = nextFrameToWrite;
      }
      const nextFrame = pendingFrames.get(nextFrameToWrite);
      pendingFrames.delete(nextFrameToWrite);
      if (diagnostics) {
        diagnostics.orderedPendingFrames = pendingFrames.size;
      }
      releaseSpaceResolvers();

      await frameQueue.enqueue(nextFrame!);
      if (diagnostics) {
        diagnostics.orderedLastFlushedFrame = nextFrameToWrite;
      }
      nextFrameToWrite += 1;
      if (diagnostics) {
        diagnostics.orderedNextFrameToWrite = nextFrameToWrite;
      }
      releaseSpaceResolvers();
    }
  }

  function releaseSpaceResolvers() {
    const resolvers = spaceResolvers;
    spaceResolvers = [];
    for (const resolve of resolvers) {
      resolve();
    }
  }
}
