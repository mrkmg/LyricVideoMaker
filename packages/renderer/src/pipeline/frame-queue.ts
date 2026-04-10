import { performance } from "node:perf_hooks";
import { throwIfAborted } from "../abort";
import { traceMuxState } from "../ffmpeg/mux-diagnostics";
import { measureAsync } from "../profiling";
import type {
  FrameMuxer,
  FrameWriteQueue,
  MuxPipelineDiagnostics,
  RenderLogger,
  RenderProfiler
} from "../types";

export function createFrameWriteQueue({
  muxer,
  profiler,
  signal,
  diagnostics,
  logger,
  maxBufferedFrames = 3
}: {
  muxer: FrameMuxer;
  profiler: RenderProfiler;
  signal?: AbortSignal;
  diagnostics?: MuxPipelineDiagnostics;
  logger?: RenderLogger;
  maxBufferedFrames?: number;
}): FrameWriteQueue {
  let bufferedFrames = 0;
  let writeError: unknown;
  let spaceResolvers: (() => void)[] = [];
  let writeChain = Promise.resolve();

  return {
    async enqueue(frame) {
      throwIfAborted(signal);
      if (writeError) {
        throw writeError;
      }

      const waitStartMs = profiler.enabled ? performance.now() : 0;
      while (bufferedFrames >= maxBufferedFrames) {
        traceMuxState(logger, diagnostics, "frame-queue-waiting-for-space");
        await new Promise<void>((resolve) => {
          spaceResolvers.push(resolve);
        });
        throwIfAborted(signal);
        if (writeError) {
          throw writeError;
        }
      }

      if (profiler.enabled) {
        profiler.stages.queueWait += performance.now() - waitStartMs;
      }

      bufferedFrames += 1;
      if (diagnostics) {
        diagnostics.frameQueueBufferedFrames = bufferedFrames;
      }
      const pendingWrite = writeChain.then(async () => {
        await measureAsync(profiler, "muxWrite", async () => {
          await muxer.writeFrame(frame);
        });
      });
      writeChain = pendingWrite
        .catch((error) => {
          writeError ??= error;
        })
        .finally(() => {
          bufferedFrames = Math.max(0, bufferedFrames - 1);
          if (diagnostics) {
            diagnostics.frameQueueBufferedFrames = bufferedFrames;
            diagnostics.frameQueueLastCompletedFrame = diagnostics.ffmpegFramesWritten;
          }
          const resolvers = spaceResolvers;
          spaceResolvers = [];
          for (const resolve of resolvers) {
            resolve();
          }
        });
    },
    async finish() {
      await writeChain;
      if (writeError) {
        throw writeError;
      }
      await muxer.finish();
    },
    async abort() {
      const resolvers = spaceResolvers;
      spaceResolvers = [];
      if (diagnostics) {
        diagnostics.frameQueueBufferedFrames = 0;
      }
      for (const resolve of resolvers) {
        resolve();
      }
      await muxer.abort();
    }
  };
}
