import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import { availableParallelism } from "node:os";
import { performance } from "node:perf_hooks";
import { join } from "node:path";
import type { Writable } from "node:stream";
import ffmpegPath from "ffmpeg-static";
import ffprobe from "ffprobe-static";
import type { Browser, BrowserContext, CDPSession, Page, Route } from "playwright";
import { createElement, type ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  type BrowserLyricRuntime,
  createLyricRuntime,
  createLyricRuntimeCursor,
  type PreparedSceneStackData,
  type RenderJob,
  type RenderLogEntry,
  type RenderLogLevel,
  type RenderProgressEvent,
  type RenderStatus,
  type SceneAssetAccessor,
  type SceneComponentDefinition,
  type ValidatedSceneComponentInstance
} from "@lyric-video-maker/core";
import { createAudioAnalysisAccessor } from "./audio-analysis";
import {
  canRenderWithLiveDom,
  createLiveDomFramePayload,
  createLiveDomScenePayload,
  mountLiveDomScene,
  renderPageShell,
  updateLiveDomScene
} from "./live-dom";

export interface RenderLyricVideoInput {
  job: RenderJob;
  componentDefinitions: SceneComponentDefinition<Record<string, unknown>>[];
  parallelism?: number;
  signal?: AbortSignal;
  onProgress?: (event: RenderProgressEvent) => void;
}

export interface CreateFramePreviewSessionInput {
  job: RenderJob;
  componentDefinitions: SceneComponentDefinition<Record<string, unknown>>[];
  signal?: AbortSignal;
}

export interface FramePreviewResult {
  png: Buffer;
  frame: number;
  timeMs: number;
}

export interface FramePreviewSession {
  renderFrame(input: { frame: number }): Promise<FramePreviewResult>;
  dispose(): Promise<void>;
}

type RenderProfileStage =
  | "prepare"
  | "frameState"
  | "browserUpdate"
  | "capture"
  | "queueWait"
  | "muxWrite"
  | "muxFinalize";

interface RenderProfiler {
  enabled: boolean;
  totalStartMs: number;
  stages: Record<RenderProfileStage, number>;
}

interface FrameMuxer {
  writeFrame(frame: Buffer): Promise<void>;
  finish(): Promise<void>;
  abort(): Promise<void>;
}

interface FrameWriteQueue {
  enqueue(frame: Buffer): Promise<void>;
  finish(): Promise<void>;
  abort(): Promise<void>;
}

interface OrderedFrameWriteQueue {
  enqueue(frame: { frame: number; buffer: Buffer }): Promise<number>;
  finish(): Promise<void>;
  abort(): Promise<void>;
}

interface FramePreviewWorkerHandle {
  current: FramePreviewSession;
}

interface ProgressEmitter {
  emit(event: RenderProgressEvent): void;
}

interface MuxPipelineDiagnostics {
  orderedPendingFrames: number;
  orderedNextFrameToWrite: number;
  orderedLastFlushedFrame: number;
  frameQueueBufferedFrames: number;
  frameQueueLastCompletedFrame: number;
  ffmpegFramesWritten: number;
  ffmpegLastWriteStartedAtMs: number;
  ffmpegLastWriteCompletedAtMs: number;
  ffmpegPid: number | undefined;
}

export interface RenderLogger {
  info(message: string): void;
  warn(message: string): void;
  error(message: string): void;
}

export interface PreloadedAsset {
  instanceId: string;
  optionId: string;
  path: string;
  url: string;
  contentType: string;
  body: Buffer;
}

const ASSET_URL_PREFIX = "http://lyric-video.local/assets/";
const PROGRESS_INTERVAL_MS = 250;
const FFMPEG_EXECUTABLE = resolveExecutablePath(ffmpegPath, "ffmpeg");
const FFPROBE_EXECUTABLE = resolveExecutablePath(ffprobe.path, "ffprobe");
const MUX_WRITE_TIMEOUT_MS =
  normalizePositiveInteger(process.env.LYRIC_VIDEO_FFMPEG_WRITE_TIMEOUT_MS) ?? 15000;
const FRAME_STAGE_TIMEOUT_MS =
  normalizePositiveInteger(process.env.LYRIC_VIDEO_FRAME_STAGE_TIMEOUT_MS) ?? 15000;
const WORKER_FRAME_RETRY_LIMIT =
  normalizePositiveInteger(process.env.LYRIC_VIDEO_WORKER_FRAME_RETRY_LIMIT) ?? 2;

const NOOP_PROGRESS_EMITTER: ProgressEmitter = {
  emit() {}
};

export async function probeAudioDurationMs(audioPath: string): Promise<number> {
  const output = await runCommand(FFPROBE_EXECUTABLE, [
    "-v",
    "error",
    "-show_entries",
    "format=duration",
    "-of",
    "default=noprint_wrappers=1:nokey=1",
    audioPath
  ]);

  const durationSeconds = Number(output.trim());
  if (Number.isNaN(durationSeconds) || durationSeconds <= 0) {
    throw new Error("Unable to determine audio duration with ffprobe.");
  }

  return Math.round(durationSeconds * 1000);
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

export async function createFramePreviewSession({
  job,
  componentDefinitions,
  signal
}: CreateFramePreviewSessionInput): Promise<FramePreviewSession> {
  const logger = createRenderLogger(job.id, NOOP_PROGRESS_EMITTER);
  const componentLookup = new Map(componentDefinitions.map((component) => [component.id, component]));
  const enabledComponents = job.components.filter((component) => component.enabled);
  const preloadedAssets = await preloadSceneAssets(enabledComponents, componentLookup, job.video, logger, signal);
  const assets = createAssetAccessor(enabledComponents, preloadedAssets);
  const audio = createAudioAnalysisAccessor({
    audioPath: job.audioPath,
    video: job.video,
    signal,
    logger
  });

  throwIfAborted(signal);

  if (!canRenderWithLiveDom(enabledComponents, componentLookup)) {
    throw new Error("One or more enabled scene components do not support the live DOM renderer.");
  }

  const initialLyricsRuntime = createLyricRuntime(job.lyrics, 0);
  const prepared = await prepareSceneComponents(enabledComponents, componentLookup, {
    video: job.video,
    lyrics: initialLyricsRuntime,
    assets,
    audio,
    signal,
      logger
  });
  return await createLiveDomRenderSession({
    sessionLabel: "preview",
    preferBeginFrame: shouldUseBeginFrame(),
    job,
    componentLookup,
    components: enabledComponents,
    assets,
    preloadedAssets,
    prepared,
    scenePayload: createLiveDomScenePayload({
      job,
      components: enabledComponents,
      componentLookup,
      assets,
      prepared
    }),
    signal,
    logger
  });
}

async function createLiveDomRenderSession({
  sessionLabel,
  preferBeginFrame,
  job,
  componentLookup,
  components,
  assets,
  preloadedAssets,
  prepared,
  scenePayload,
  signal,
  logger,
  profiler
}: {
  sessionLabel: string;
  preferBeginFrame: boolean;
  job: RenderJob;
  componentLookup: Map<string, SceneComponentDefinition<Record<string, unknown>>>;
  components: ValidatedSceneComponentInstance[];
  assets: Pick<SceneAssetAccessor, "getUrl">;
  preloadedAssets: Map<string, PreloadedAsset>;
  prepared: PreparedSceneStackData;
  scenePayload: ReturnType<typeof createLiveDomScenePayload>;
  signal?: AbortSignal;
  logger: RenderLogger;
  profiler?: RenderProfiler;
}): Promise<FramePreviewSession> {
  let browser: Browser | null = null;
  let browserContext: BrowserContext | null = null;
  let page: Page | null = null;
  let cdpSession: CDPSession | null = null;
  let disposed = false;
  let beginFrameFallbackLogged = false;
  const lyricRuntimeCursor = createLyricRuntimeCursor(job.lyrics, 0);

  try {
    const chromium = await loadChromium();
    browser = await chromium.launch({
      headless: true,
      args: getBeginFrameLaunchArgs(preferBeginFrame)
    });

    const renderPage = await createRenderPage({
      browser,
      width: job.video.width,
      height: job.video.height,
      preferBeginFrame
    });
    browserContext = renderPage.context;
    page = renderPage.page;

    wirePageDiagnostics(page, logger);
    await registerAssetRoutes(page, preloadedAssets, logger);
    await page.setContent(renderPageShell(), { waitUntil: "domcontentloaded" });

    cdpSession = await page.context().newCDPSession(page);
    await cdpSession.send("Page.enable");

    const mountWarnings = await maybeMeasureAsync(profiler, "browserUpdate", async () => {
      return await mountLiveDomScene(page!, scenePayload);
    });

    for (const warning of mountWarnings.warnings) {
      logger.warn(warning);
    }
  } catch (error) {
    await disposePreviewBrowserResources({ page, cdpSession, browserContext, browser });
    throw error;
  }

  return {
    async renderFrame({ frame }) {
      if (disposed || !page || !cdpSession) {
        throw new Error("Preview session has already been disposed.");
      }

      throwIfAborted(signal);

      const safeFrame = Math.max(0, Math.min(job.video.durationInFrames - 1, Math.floor(frame)));
      const timeMs = Math.min(job.video.durationMs, Math.round((safeFrame / job.video.fps) * 1000));
      traceRenderStep(logger, sessionLabel, safeFrame, "frame-start");
      const lyrics = toBrowserLyricRuntime(lyricRuntimeCursor.getRuntimeAt(timeMs));
      const framePayload = maybeMeasureSync(profiler, "frameState", () =>
        createLiveDomFramePayload({
          components,
          componentLookup,
          frame: safeFrame,
          timeMs,
          video: job.video,
          lyrics,
          assets,
          prepared
        })
      );

      traceRenderStep(logger, sessionLabel, safeFrame, "browser-update-start");
      await withTimeout(
        maybeMeasureAsync(profiler, "browserUpdate", async () => {
          await updateLiveDomScene(page!, framePayload);
        }),
        createFrameStageTimeoutError({
          sessionLabel,
          frame: safeFrame,
          stage: "browser update"
        }),
        FRAME_STAGE_TIMEOUT_MS
      );
      traceRenderStep(logger, sessionLabel, safeFrame, "browser-update-done");

      traceRenderStep(logger, sessionLabel, safeFrame, "capture-start");
      const capture = await withTimeout(
        maybeMeasureAsync(profiler, "capture", async () => {
          return await captureFrameBuffer({
            cdpSession: cdpSession!,
            fps: job.video.fps,
            preferBeginFrame,
            logger,
            beginFrameFallbackLogged
          });
        }),
        createFrameStageTimeoutError({
          sessionLabel,
          frame: safeFrame,
          stage: "capture"
        }),
        FRAME_STAGE_TIMEOUT_MS
      );
      traceRenderStep(logger, sessionLabel, safeFrame, "capture-done");
      beginFrameFallbackLogged = capture.beginFrameFallbackLogged;

      return {
        png: capture.buffer,
        frame: safeFrame,
        timeMs
      };
    },
    async dispose() {
      if (disposed) {
        return;
      }

      disposed = true;
      await disposePreviewBrowserResources({ page, cdpSession, browserContext, browser });
      page = null;
      cdpSession = null;
      browserContext = null;
      browser = null;
    }
  };
}

async function createRenderPage({
  browser,
  width,
  height,
  preferBeginFrame
}: {
  browser: Browser;
  width: number;
  height: number;
  preferBeginFrame: boolean;
}): Promise<{ context: BrowserContext; page: Page }> {
  const context = await browser.newContext({
    viewport: {
      width,
      height
    },
    deviceScaleFactor: 1
  });

  if (!preferBeginFrame) {
    const page = await context.newPage();
    return { context, page };
  }

  const browserSession = await browser.newBrowserCDPSession();

  try {
    const internalContext = (context as BrowserContext & {
      _connection?: { toImpl?: (object: unknown) => { _browserContextId?: string } };
    })._connection?.toImpl?.(context);
    const browserContextId = internalContext?._browserContextId;
    if (!browserContextId) {
      throw new Error("Playwright did not expose the Chromium browserContextId required for BeginFrameControl.");
    }

    const pagePromise = context.waitForEvent("page");
    await browserSession.send("Target.createTarget", {
      url: "about:blank",
      browserContextId,
      enableBeginFrameControl: true
    });
    const page = await pagePromise;
    return { context, page };
  } finally {
    await browserSession.detach();
  }
}

export function buildCompositeFrameMarkup({
  job,
  componentLookup,
  components,
  frame,
  timeMs,
  lyrics,
  assets,
  prepared
}: {
  job: RenderJob;
  componentLookup: Map<string, SceneComponentDefinition<Record<string, unknown>>>;
  components: ValidatedSceneComponentInstance[];
  frame: number;
  timeMs: number;
  lyrics: ReturnType<typeof createLyricRuntime>;
  assets: Pick<SceneAssetAccessor, "getUrl">;
  prepared: PreparedSceneStackData;
}): string {
  const layerElements = components.map((instance) => {
    const definition = componentLookup.get(instance.componentId);
    if (!definition) {
      throw new Error(`Scene component definition "${instance.componentId}" is not registered.`);
    }

    const renderedLayer = definition.Component({
      instance,
      options: instance.options,
      frame,
      timeMs,
      video: job.video,
      lyrics,
      assets,
      prepared: prepared[instance.id] ?? {}
    });

    if (!renderedLayer) {
      return null;
    }

    return createElement(
      "div",
      {
        key: instance.id,
        "data-scene-component-id": instance.componentId,
        style: {
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          overflow: "hidden"
        }
      },
      renderedLayer
    );
  });

  return renderFrameMarkup(
    createElement(
      "div",
      {
        style: {
          position: "relative",
          width: job.video.width,
          height: job.video.height,
          overflow: "hidden",
          background: "#09090f"
        }
      },
      layerElements
    )
  );
}

function renderFrameMarkup(markup: ReactElement): string {
  return renderToStaticMarkup(markup);
}

async function prepareSceneComponents(
  components: ValidatedSceneComponentInstance[],
  componentLookup: Map<string, SceneComponentDefinition<Record<string, unknown>>>,
  context: {
    video: RenderJob["video"];
    lyrics: ReturnType<typeof createLyricRuntime>;
    assets: SceneAssetAccessor;
    audio: ReturnType<typeof createAudioAnalysisAccessor>;
    signal?: AbortSignal;
    logger: RenderLogger;
  }
): Promise<PreparedSceneStackData> {
  const prepared: PreparedSceneStackData = {};

  for (const instance of components) {
    const definition = componentLookup.get(instance.componentId);
    if (!definition) {
      throw new Error(`Scene component definition "${instance.componentId}" is not registered.`);
    }

    prepared[instance.id] =
      (await definition.prepare?.({
        instance,
        options: instance.options,
        video: context.video,
        lyrics: context.lyrics,
        assets: context.assets,
        audio: context.audio,
        signal: context.signal
      })) ?? {};

    context.logger.info(`Prepared component "${instance.componentName}" (${instance.id}).`);
  }

  return prepared;
}

export async function preloadSceneAssets(
  components: ValidatedSceneComponentInstance[],
  componentLookup: Map<string, SceneComponentDefinition<Record<string, unknown>>>,
  video: RenderJob["video"],
  logger: RenderLogger,
  signal?: AbortSignal
): Promise<Map<string, PreloadedAsset>> {
  const assets = new Map<string, PreloadedAsset>();

  for (const instance of components) {
    const definition = componentLookup.get(instance.componentId);
    if (!definition) {
      throw new Error(`Scene component definition "${instance.componentId}" is not registered.`);
    }

    for (const field of definition.options) {
      if (field.type !== "image") {
        continue;
      }

      const optionValue = instance.options[field.id];
      if (typeof optionValue !== "string" || !optionValue) {
        continue;
      }

      const normalizedBody = await normalizeImageAsset(optionValue, video, signal, logger);
      const originalBody = normalizedBody ? null : await readFile(optionValue);
      const asset = {
        instanceId: instance.id,
        optionId: field.id,
        path: optionValue,
        url: `${ASSET_URL_PREFIX}${encodeURIComponent(instance.id)}-${encodeURIComponent(field.id)}${getExtensionSuffix(optionValue)}`,
        contentType: normalizedBody ? "image/png" : getMimeType(optionValue),
        body: normalizedBody ?? originalBody!
      } satisfies PreloadedAsset;

      assets.set(getAssetKey(instance.id, field.id), asset);
      logger.info(
        `Preloaded image asset "${instance.id}/${field.id}" from ${optionValue}${normalizedBody ? " (normalized)" : ""}`
      );
    }
  }

  return assets;
}

export function areAllComponentsStaticWhenMarkupUnchanged(
  components: ValidatedSceneComponentInstance[],
  componentLookup: Map<string, SceneComponentDefinition<Record<string, unknown>>>
) {
  return components.every(
    (instance) => componentLookup.get(instance.componentId)?.staticWhenMarkupUnchanged === true
  );
}

export function resolveRenderParallelism({
  parallelism,
  totalFrames
}: {
  parallelism?: number;
  totalFrames: number;
}) {
  const requested =
    normalizePositiveInteger(parallelism) ??
    normalizePositiveInteger(process.env.LYRIC_VIDEO_RENDER_WORKERS) ??
    Math.min(8, Math.max(1, Math.floor(availableParallelism() - 1)));
  const maxWorkersFromFrames = Math.max(1, Math.floor(totalFrames / 2));

  return Math.max(1, Math.min(requested, totalFrames, maxWorkersFromFrames));
}

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

async function registerAssetRoutes(
  page: Page,
  assets: Map<string, PreloadedAsset>,
  logger: RenderLogger
) {
  await page.route(`${ASSET_URL_PREFIX}**`, async (route) => {
    await fulfillAssetRoute(route, assets, logger);
  });
}

async function disposePreviewBrowserResources({
  page,
  cdpSession,
  browserContext,
  browser
}: {
  page: Page | null;
  cdpSession: CDPSession | null;
  browserContext: BrowserContext | null;
  browser: Browser | null;
}) {
  if (page) {
    await page.unroute(`${ASSET_URL_PREFIX}**`);
  }

  if (cdpSession) {
    await cdpSession.detach();
  }

  if (browserContext) {
    await browserContext.close();
  }

  if (browser) {
    await browser.close();
  }
}

async function fulfillAssetRoute(
  route: Route,
  assets: Map<string, PreloadedAsset>,
  logger: RenderLogger
) {
  const url = route.request().url();
  const asset = [...assets.values()].find((candidate) => candidate.url === url);

  if (!asset) {
    logger.warn(`Asset request had no registered payload: ${url}`);
    await route.fulfill({
      status: 404,
      body: "Not found",
      headers: {
        "Content-Type": "text/plain"
      }
    });
    return;
  }

  await route.fulfill({
    status: 200,
    body: asset.body,
    headers: {
      "Content-Type": asset.contentType,
      "Cache-Control": "public, max-age=31536000, immutable"
    }
  });
}

function createAssetAccessor(
  components: ValidatedSceneComponentInstance[],
  preloadedAssets: Map<string, PreloadedAsset>
): SceneAssetAccessor {
  const componentLookup = new Map(components.map((component) => [component.id, component]));

  return {
    getPath(instanceId, optionId) {
      const instance = componentLookup.get(instanceId);
      if (!instance) {
        return null;
      }

      const value = instance.options[optionId];
      return typeof value === "string" ? value : null;
    },
    getUrl(instanceId, optionId) {
      return preloadedAssets.get(getAssetKey(instanceId, optionId))?.url ?? null;
    }
  };
}

function getAssetKey(instanceId: string, optionId: string) {
  return `${instanceId}:${optionId}`;
}

async function captureFrameBuffer({
  cdpSession,
  fps,
  preferBeginFrame,
  logger,
  beginFrameFallbackLogged
}: {
  cdpSession: CDPSession;
  fps: number;
  preferBeginFrame: boolean;
  logger: RenderLogger;
  beginFrameFallbackLogged: boolean;
}): Promise<{ buffer: Buffer; beginFrameFallbackLogged: boolean }> {
  if (preferBeginFrame) {
    try {
      const frame = await cdpSession.send("HeadlessExperimental.beginFrame", {
        interval: 1000 / Math.max(fps, 1),
        noDisplayUpdates: false,
        screenshot: {
          format: "png",
          optimizeForSpeed: true
        }
      });

      if (frame?.screenshotData) {
        return {
          buffer: Buffer.from(frame.screenshotData, "base64"),
          beginFrameFallbackLogged
        };
      }
    } catch (error) {
      if (!beginFrameFallbackLogged) {
        logger.warn(
          `HeadlessExperimental.beginFrame failed; falling back to Page.captureScreenshot. ${error instanceof Error ? error.message : String(error)}`
        );
        beginFrameFallbackLogged = true;
      }
    }
  }

  const screenshot = await cdpSession.send("Page.captureScreenshot", {
    format: "png",
    fromSurface: true,
    captureBeyondViewport: false,
    optimizeForSpeed: true
  });

  return {
    buffer: Buffer.from(screenshot.data, "base64"),
    beginFrameFallbackLogged
  };
}

function toBrowserLyricRuntime(
  lyrics: Pick<BrowserLyricRuntime, "current" | "next">
): BrowserLyricRuntime {
  return {
    current: lyrics.current,
    next: lyrics.next
  };
}

function shouldUseBeginFrame() {
  return process.env.LYRIC_VIDEO_RENDER_USE_BEGIN_FRAME !== "0";
}

function getBeginFrameLaunchArgs(preferBeginFrame: boolean) {
  if (!preferBeginFrame) {
    return [];
  }

  return [
    "--enable-surface-synchronization",
    "--run-all-compositor-stages-before-draw",
    "--disable-threaded-animation",
    "--disable-threaded-scrolling",
    "--disable-checker-imaging"
  ];
}

function traceRenderStep(
  logger: RenderLogger,
  sessionLabel: string,
  frame: number,
  step: string
) {
  if (process.env.LYRIC_VIDEO_RENDER_TRACE !== "1") {
    return;
  }

  logger.info(`[trace:${sessionLabel}] frame=${frame} step=${step}`);
}

function createMuxPipelineDiagnostics(): MuxPipelineDiagnostics {
  const nowMs = Date.now();
  return {
    orderedPendingFrames: 0,
    orderedNextFrameToWrite: 0,
    orderedLastFlushedFrame: -1,
    frameQueueBufferedFrames: 0,
    frameQueueLastCompletedFrame: -1,
    ffmpegFramesWritten: 0,
    ffmpegLastWriteStartedAtMs: nowMs,
    ffmpegLastWriteCompletedAtMs: nowMs,
    ffmpegPid: undefined
  };
}

function traceMuxState(
  logger: RenderLogger | undefined,
  diagnostics: MuxPipelineDiagnostics | undefined,
  reason: string
) {
  if (!logger || process.env.LYRIC_VIDEO_RENDER_MUX_TRACE !== "1") {
    return;
  }

  logger.info(`[mux-trace:${reason}] ${formatMuxDiagnostics(diagnostics)}`);
}

function formatMuxDiagnostics(diagnostics: MuxPipelineDiagnostics | undefined) {
  if (!diagnostics) {
    return "mux diagnostics unavailable.";
  }

  const nowMs = Date.now();
  const elapsedSinceLastWriteMs = Math.max(0, nowMs - diagnostics.ffmpegLastWriteCompletedAtMs);
  return [
    `orderedPending=${diagnostics.orderedPendingFrames}`,
    `nextExpected=${diagnostics.orderedNextFrameToWrite}`,
    `lastFlushed=${diagnostics.orderedLastFlushedFrame}`,
    `frameQueueBuffered=${diagnostics.frameQueueBufferedFrames}`,
    `lastFrameCompleted=${diagnostics.frameQueueLastCompletedFrame}`,
    `ffmpegFramesWritten=${diagnostics.ffmpegFramesWritten}`,
    `ffmpegPid=${diagnostics.ffmpegPid ?? "unknown"}`,
    `lastWriteAgeMs=${elapsedSinceLastWriteMs}`
  ].join(" ");
}

function createFrameStageTimeoutError({
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

async function withTimeout<T>(
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

async function renderWorkerFrames({
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

function createProgressEmitter(onProgress: RenderLyricVideoInput["onProgress"]): ProgressEmitter {
  let lastStatus: RenderStatus | null = null;
  let lastProgress = Number.NaN;
  let lastOutputPath: string | undefined;
  let lastError: string | undefined;
  let lastEtaMs: number | undefined;
  let lastRenderFps: number | undefined;
  let lastLogKey: string | undefined;

  return {
    emit(event) {
      const nextLogKey = event.logEntry
        ? `${event.logEntry.timestamp}|${event.logEntry.level}|${event.logEntry.message}`
        : undefined;

      if (
        event.status === lastStatus &&
        numbersMatch(event.progress, lastProgress) &&
        event.outputPath === lastOutputPath &&
        event.error === lastError &&
        numbersMatch(event.etaMs, lastEtaMs) &&
        numbersMatch(event.renderFps, lastRenderFps) &&
        nextLogKey === lastLogKey
      ) {
        return;
      }

      lastStatus = event.status;
      lastProgress = event.progress;
      lastOutputPath = event.outputPath;
      lastError = event.error;
      lastEtaMs = event.etaMs;
      lastRenderFps = event.renderFps;
      lastLogKey = nextLogKey;
      onProgress?.(event);
    }
  };
}

function numbersMatch(left: number | undefined, right: number | undefined) {
  return left === right || (Number.isNaN(left) && Number.isNaN(right));
}

function createRenderLogger(jobId: string, progress: ProgressEmitter): RenderLogger {
  return {
    info(message) {
      emitLog("info", message);
    },
    warn(message) {
      emitLog("warning", message);
    },
    error(message) {
      emitLog("error", message);
    }
  };

  function emitLog(level: RenderLogLevel, message: string) {
    const entry = createLogEntry(level, message);
    const output =
      level === "error" ? console.error : level === "warning" ? console.warn : console.info;
    output(`[lyric-video-render:${jobId}] ${message}`);
    progress.emit({
      jobId,
      status: "rendering",
      progress: Number.NaN,
      message,
      logEntry: entry
    });
  }
}

function createLogEntry(level: RenderLogLevel, message: string): RenderLogEntry {
  return {
    timestamp: new Date().toISOString(),
    level,
    message
  };
}

function wirePageDiagnostics(page: Page, logger: RenderLogger) {
  page.on("console", (msg) => {
    if (msg.type() === "error" || msg.type() === "warning") {
      const log = msg.text().trim();
      if (log) {
        if (msg.type() === "error") {
          logger.error(`Browser console: ${log}`);
        } else {
          logger.warn(`Browser console: ${log}`);
        }
      }
    }
  });

  page.on("pageerror", (error) => {
    logger.error(`Page error: ${error.message}`);
  });

  page.on("requestfailed", (request) => {
    logger.warn(`Request failed: ${request.url()}${request.failure()?.errorText ? ` (${request.failure()?.errorText})` : ""}`);
  });
}

function createRenderProfiler(): RenderProfiler {
  return {
    enabled: process.env.LYRIC_VIDEO_RENDER_DEBUG === "1",
    totalStartMs: performance.now(),
    stages: {
      prepare: 0,
      frameState: 0,
      browserUpdate: 0,
      capture: 0,
      queueWait: 0,
      muxWrite: 0,
      muxFinalize: 0
    }
  };
}

function maybeMeasureSync<T>(
  profiler: RenderProfiler | undefined,
  stage: RenderProfileStage,
  run: () => T
): T {
  if (!profiler) {
    return run();
  }

  return measureSync(profiler, stage, run);
}

async function maybeMeasureAsync<T>(
  profiler: RenderProfiler | undefined,
  stage: RenderProfileStage,
  run: () => Promise<T>
): Promise<T> {
  if (!profiler) {
    return await run();
  }

  return await measureAsync(profiler, stage, run);
}

function measureSync<T>(
  profiler: RenderProfiler,
  stage: RenderProfileStage,
  run: () => T
): T {
  if (!profiler.enabled) {
    return run();
  }

  const startMs = performance.now();
  try {
    return run();
  } finally {
    profiler.stages[stage] += performance.now() - startMs;
  }
}

async function measureAsync<T>(
  profiler: RenderProfiler,
  stage: RenderProfileStage,
  run: () => Promise<T>
): Promise<T> {
  if (!profiler.enabled) {
    return await run();
  }

  const startMs = performance.now();
  try {
    return await run();
  } finally {
    profiler.stages[stage] += performance.now() - startMs;
  }
}

function logRenderProfile(
  profiler: RenderProfiler,
  job: RenderJob,
  logger: RenderLogger
) {
  if (!profiler.enabled) {
    return;
  }

  const totalMs = performance.now() - profiler.totalStartMs;
  const renderedFps = job.video.durationInFrames / Math.max(totalMs / 1000, 0.001);
  logger.info(
    `Profile ${JSON.stringify(
      {
        jobId: job.id,
        frames: job.video.durationInFrames,
        totalMs: roundMs(totalMs),
        renderedFps: Number(renderedFps.toFixed(2)),
        stagesMs: {
          prepare: roundMs(profiler.stages.prepare),
          frameState: roundMs(profiler.stages.frameState),
          browserUpdate: roundMs(profiler.stages.browserUpdate),
          capture: roundMs(profiler.stages.capture),
          queueWait: roundMs(profiler.stages.queueWait),
          muxWrite: roundMs(profiler.stages.muxWrite),
          muxFinalize: roundMs(profiler.stages.muxFinalize)
        }
      },
      null,
      2
    )}`
  );
}

function roundMs(value: number): number {
  return Number(value.toFixed(2));
}

function createFrameWriteQueue({
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

function startFrameMuxer(
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

  const stderr: Buffer[] = [];
  const exitPromise = new Promise<void>((resolve, reject) => {
    child.stderr.on("data", (chunk) => stderr.push(Buffer.from(chunk)));
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
        new Error(`ffmpeg exited with code ${code}: ${Buffer.concat(stderr).toString("utf8").trim()}`)
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

function getMimeType(path: string): string {
  const lowerPath = path.toLowerCase();
  if (lowerPath.endsWith(".png")) {
    return "image/png";
  }
  if (lowerPath.endsWith(".webp")) {
    return "image/webp";
  }
  if (lowerPath.endsWith(".gif")) {
    return "image/gif";
  }

  return "image/jpeg";
}

function getExtensionSuffix(path: string): string {
  const match = /\.[^./\\]+$/.exec(path);
  return match ? match[0] : "";
}

async function loadChromium() {
  if (!process.env.PLAYWRIGHT_BROWSERS_PATH) {
    const localBrowsersPath = process.resourcesPath
      ? join(process.resourcesPath, "app", "node_modules", "playwright-core", ".local-browsers")
      : null;
    if (localBrowsersPath && existsSync(localBrowsersPath)) {
      process.env.PLAYWRIGHT_BROWSERS_PATH = "0";
    }
  }

  return (await import("playwright")).chromium;
}

function resolveExecutablePath(
  bundledPath: string | null | undefined,
  fallbackCommand: string
) {
  return typeof bundledPath === "string" && bundledPath.trim() ? bundledPath : fallbackCommand;
}

function normalizePositiveInteger(value: number | string | undefined) {
  if (typeof value === "number") {
    return Number.isInteger(value) && value > 0 ? value : undefined;
  }

  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : undefined;
  }

  return undefined;
}

async function normalizeImageAsset(
  path: string,
  video: RenderJob["video"],
  signal: AbortSignal | undefined,
  logger: RenderLogger
): Promise<Buffer | null> {
  try {
    return await runBinaryCommand(
      "ffmpeg",
      [
        "-v",
        "error",
        "-i",
        path,
        "-vf",
        `scale=${video.width}:${video.height}:force_original_aspect_ratio=increase,crop=${video.width}:${video.height}`,
        "-frames:v",
        "1",
        "-f",
        "image2pipe",
        "-vcodec",
        "png",
        "-"
      ],
      signal
    );
  } catch (error) {
    logger.warn(
      `Image normalization failed for ${path}; falling back to original asset. ${error instanceof Error ? error.message : String(error)}`
    );
    return null;
  }
}

function throwIfAborted(signal?: AbortSignal) {
  if (signal?.aborted) {
    throw createAbortError();
  }
}

function createAbortError() {
  return new DOMException("The operation was aborted.", "AbortError");
}

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}

async function runCommand(
  command: string,
  args: string[],
  signal?: AbortSignal
): Promise<string> {
  return await new Promise<string>((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: ["ignore", "pipe", "pipe"]
    });

    const stdout: Buffer[] = [];
    const stderr: Buffer[] = [];

    const abortHandler = () => {
      child.kill();
      reject(createAbortError());
    };

    signal?.addEventListener("abort", abortHandler, { once: true });

    child.stdout.on("data", (chunk) => stdout.push(Buffer.from(chunk)));
    child.stderr.on("data", (chunk) => stderr.push(Buffer.from(chunk)));
    child.on("error", (error) => {
      signal?.removeEventListener("abort", abortHandler);
      reject(error);
    });
    child.on("close", (code) => {
      signal?.removeEventListener("abort", abortHandler);
      if (code === 0) {
        resolve(Buffer.concat(stdout).toString("utf8"));
        return;
      }

      reject(
        new Error(
          `${command} exited with code ${code}: ${Buffer.concat(stderr).toString("utf8").trim()}`
        )
      );
    });
  });
}

async function runBinaryCommand(
  command: string,
  args: string[],
  signal?: AbortSignal
): Promise<Buffer> {
  return await new Promise<Buffer>((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: ["ignore", "pipe", "pipe"]
    });

    const stdout: Buffer[] = [];
    const stderr: Buffer[] = [];

    const abortHandler = () => {
      child.kill();
      reject(createAbortError());
    };

    signal?.addEventListener("abort", abortHandler, { once: true });

    child.stdout.on("data", (chunk) => stdout.push(Buffer.from(chunk)));
    child.stderr.on("data", (chunk) => stderr.push(Buffer.from(chunk)));
    child.on("error", (error) => {
      signal?.removeEventListener("abort", abortHandler);
      reject(error);
    });
    child.on("close", (code) => {
      signal?.removeEventListener("abort", abortHandler);
      if (code === 0) {
        resolve(Buffer.concat(stdout));
        return;
      }

      reject(
        new Error(
          `${command} exited with code ${code}: ${Buffer.concat(stderr).toString("utf8").trim()}`
        )
      );
    });
  });
}
