import { performance } from "node:perf_hooks";
import {
  createLyricRuntime,
  type RenderJob,
  type RenderProgressEvent,
  type SceneComponentDefinition
} from "@lyric-video-maker/core";
import { isAbortError, throwIfAborted } from "../abort";
import { createAudioAnalysisAccessor } from "../audio-analysis";
import { createAssetAccessor, preloadSceneAssets } from "../assets/preload";
import { shouldUseBeginFrame } from "../browser/chromium-loader";
import { createLiveDomRenderSession } from "../browser/live-dom-session";
import { PROGRESS_INTERVAL_MS } from "../constants";
import { startFrameMuxer } from "../ffmpeg/frame-muxer";
import { createMuxPipelineDiagnostics } from "../ffmpeg/mux-diagnostics";
import { canRenderWithLiveDom, createLiveDomScenePayload } from "../live-dom";
import { createRenderLogger } from "../logging";
import { logRenderProfile, createRenderProfiler, measureAsync } from "../profiling";
import { prepareSceneComponents } from "../scene-prep/prepare-components";
import {
  type FrameMuxer,
  type FrameWriteQueue,
  type FramePreviewWorkerHandle,
  type OrderedFrameWriteQueue
} from "../types";
import { createFrameWriteQueue } from "./frame-queue";
import { createOrderedFrameWriteQueue } from "./ordered-frame-queue";
import { createProgressEmitter } from "./progress";
import { resolveRenderParallelism } from "./parallelism";
import { renderWorkerFrames } from "./worker-frames";

export interface RenderLyricVideoInput {
  job: RenderJob;
  componentDefinitions: SceneComponentDefinition<Record<string, unknown>>[];
  parallelism?: number;
  signal?: AbortSignal;
  onProgress?: (event: RenderProgressEvent) => void;
}

export async function renderLyricVideo({
  job,
  componentDefinitions,
  parallelism,
  signal,
  onProgress
}: RenderLyricVideoInput): Promise<string> {
  const progress = createProgressEmitter(onProgress);
  const logger = createRenderLogger(job.id, progress);
  const profiler = createRenderProfiler();
  const componentLookup = new Map(componentDefinitions.map((component) => [component.id, component]));
  const enabledComponents = job.components.filter((component) => component.enabled);
  const renderController = new AbortController();
  const renderSignal = renderController.signal;
  const forwardAbort = () => {
    if (!renderController.signal.aborted) {
      renderController.abort();
    }
  };
  if (signal?.aborted) {
    forwardAbort();
  } else {
    signal?.addEventListener("abort", forwardAbort, { once: true });
  }

  let muxer: FrameMuxer | null = null;
  let frameQueue: FrameWriteQueue | null = null;
  let orderedFrameQueue: OrderedFrameWriteQueue | null = null;
  let muxerFinished = false;
  let workerFailure: unknown = null;
  const workerHandles: FramePreviewWorkerHandle[] = [];
  const muxDiagnostics = createMuxPipelineDiagnostics();
  try {
    throwIfAborted(renderSignal);

    if (!canRenderWithLiveDom(enabledComponents, componentLookup)) {
      throw new Error("One or more enabled scene components do not support the live DOM renderer.");
    }

    const preloadedAssets = await preloadSceneAssets(
      enabledComponents,
      componentLookup,
      job.video,
      logger,
      renderSignal
    );
    const assets = createAssetAccessor(enabledComponents, preloadedAssets);
    const audio = createAudioAnalysisAccessor({
      audioPath: job.audioPath,
      video: job.video,
      signal: renderSignal,
      logger
    });

    progress.emit({
      jobId: job.id,
      status: "preparing",
      progress: 0,
      message: "Preparing scene components"
    });

    logger.info(
      `Starting render at ${job.video.width}x${job.video.height} ${job.video.fps}fps with ${job.video.durationInFrames} frames.`
    );

    const initialLyricsRuntime = createLyricRuntime(job.lyrics, 0);
    const prepared =
      (await measureAsync(profiler, "prepare", async () => {
        return await prepareSceneComponents(enabledComponents, componentLookup, {
          video: job.video,
          lyrics: initialLyricsRuntime,
          assets,
          audio,
          signal: renderSignal,
          logger
        });
      })) ?? {};
    const scenePayload = createLiveDomScenePayload({
      job,
      components: enabledComponents,
      componentLookup,
      assets,
      prepared
    });
    const workerCount = resolveRenderParallelism({
      parallelism,
      totalFrames: job.video.durationInFrames
    });
    const useBeginFrame = shouldUseBeginFrame() && workerCount === 1;

    logger.info(`Using ${workerCount} Chromium render worker${workerCount === 1 ? "" : "s"}.`);
    if (shouldUseBeginFrame() && !useBeginFrame) {
      logger.info("Disabling BeginFrameControl because parallel rendering uses screenshot capture.");
    }

    for (let workerIndex = 0; workerIndex < workerCount; workerIndex += 1) {
      workerHandles.push({
        current: await createLiveDomRenderSession({
          sessionLabel: `worker-${workerIndex}`,
          preferBeginFrame: useBeginFrame,
          job,
          componentLookup,
          components: enabledComponents,
          assets,
          preloadedAssets,
          prepared,
          scenePayload,
          signal: renderSignal,
          logger,
          profiler
        })
      });
    }

    muxer = startFrameMuxer(job, renderSignal, logger, muxDiagnostics);
    frameQueue = createFrameWriteQueue({
      muxer,
      profiler,
      signal: renderSignal,
      diagnostics: muxDiagnostics,
      logger
    });
    orderedFrameQueue = createOrderedFrameWriteQueue({
      totalFrames: job.video.durationInFrames,
      frameQueue,
      signal: renderSignal,
      profiler,
      diagnostics: muxDiagnostics,
      logger,
      maxPendingFrames: Math.max(4, workerCount * 2)
    });
    const renderStartMs = performance.now();
    let lastProgressEmitMs = renderStartMs - PROGRESS_INTERVAL_MS;
    const emitRenderProgress = (framesWritten: number) => {
      if (framesWritten <= 0) {
        return;
      }

      const nowMs = performance.now();
      const isLastFrame = framesWritten >= job.video.durationInFrames;
      if (isLastFrame || nowMs - lastProgressEmitMs >= PROGRESS_INTERVAL_MS) {
        const elapsedMs = Math.max(nowMs - renderStartMs, 1);
        const renderFps = (framesWritten * 1000) / elapsedMs;
        const framesRemaining = job.video.durationInFrames - framesWritten;
        const etaMs = framesRemaining > 0 ? Math.round((framesRemaining / renderFps) * 1000) : 0;

        progress.emit({
          jobId: job.id,
          status: "rendering",
          progress: (framesWritten / job.video.durationInFrames) * 85,
          message: `Rendering frame ${framesWritten} of ${job.video.durationInFrames}`,
          etaMs,
          renderFps: Number(renderFps.toFixed(2))
        });

        lastProgressEmitMs = nowMs;
      }
    };

    await Promise.all(
      workerHandles.map((workerHandle, workerIndex) =>
        renderWorkerFrames({
          workerHandle,
          workerIndex,
          workerCount,
          totalFrames: job.video.durationInFrames,
          orderedFrameQueue: orderedFrameQueue!,
          createWorkerSession: async () =>
            await createLiveDomRenderSession({
              sessionLabel: `worker-${workerIndex}`,
              preferBeginFrame: useBeginFrame,
              job,
              componentLookup,
              components: enabledComponents,
              assets,
              preloadedAssets,
              prepared,
              scenePayload,
              signal: renderSignal,
              logger,
              profiler
            }),
          signal: renderSignal,
          logger,
          abort: () => {
            if (!renderController.signal.aborted) {
              renderController.abort();
            }
          },
          onError: (error) => {
            if (!workerFailure) {
              workerFailure = error;
            }
          },
          onFramesWritten: emitRenderProgress
        })
      )
    );

    throwIfAborted(renderSignal);
    emitRenderProgress(job.video.durationInFrames);

    progress.emit({
      jobId: job.id,
      status: "muxing",
      progress: 90,
      message: "Muxing frames with source audio"
    });

    if (!orderedFrameQueue) {
      throw new Error("Ordered frame queue was not initialized.");
    }
    const activeOrderedFrameQueue = orderedFrameQueue;

    await measureAsync(profiler, "muxFinalize", async () => {
      await activeOrderedFrameQueue.finish();
      muxerFinished = true;
    });

    logger.info(`Render complete: ${job.outputPath}`);
    progress.emit({
      jobId: job.id,
      status: "completed",
      progress: 100,
      message: "Render complete",
      outputPath: job.outputPath
    });

    return job.outputPath;
  } catch (error) {
    if (isAbortError(error) && !workerFailure) {
      logger.warn("Render cancelled.");
      progress.emit({
        jobId: job.id,
        status: "cancelled",
        progress: 0,
        message: "Render cancelled"
      });
      throw error;
    }

    const failure = workerFailure ?? error;
    const errorMessage = failure instanceof Error ? failure.message : String(failure);
    if (!renderController.signal.aborted) {
      renderController.abort();
    }
    logger.error(errorMessage);
    progress.emit({
      jobId: job.id,
      status: "failed",
      progress: 0,
      message: "Render failed",
      error: errorMessage
    });
    throw error;
  } finally {
    if (orderedFrameQueue && !muxerFinished) {
      await orderedFrameQueue.abort();
    } else if (frameQueue && !muxerFinished) {
      await frameQueue.abort();
    } else if (muxer && !muxerFinished) {
      await muxer.abort();
    }

    await Promise.allSettled(workerHandles.map((workerHandle) => workerHandle.current.dispose()));
    signal?.removeEventListener("abort", forwardAbort);

    logRenderProfile(profiler, job, logger);
  }
}
