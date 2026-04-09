import { readFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import { performance } from "node:perf_hooks";
import { chromium, type CDPSession, type Page, type Route } from "playwright";
import { createElement, type ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
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

export interface RenderLyricVideoInput {
  job: RenderJob;
  componentDefinitions: SceneComponentDefinition<Record<string, unknown>>[];
  signal?: AbortSignal;
  onProgress?: (event: RenderProgressEvent) => void;
}

type RenderProfileStage = "prepare" | "markup" | "domUpdate" | "screenshot" | "muxing";

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

interface ProgressEmitter {
  emit(event: RenderProgressEvent): void;
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

export async function probeAudioDurationMs(audioPath: string): Promise<number> {
  const output = await runCommand("ffprobe", [
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
  signal,
  onProgress
}: RenderLyricVideoInput): Promise<string> {
  const progress = createProgressEmitter(onProgress);
  const logger = createRenderLogger(job.id, progress);
  const profiler = createRenderProfiler();
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
  let muxerFinished = false;

  progress.emit({
    jobId: job.id,
    status: "preparing",
    progress: 0,
    message: "Preparing scene components"
  });

  logger.info(
    `Starting render at ${job.video.width}x${job.video.height} ${job.video.fps}fps with ${job.video.durationInFrames} frames.`
  );

  let browser = null;
  let page: Page | null = null;
  let cdpSession: CDPSession | null = null;
  let muxer: FrameMuxer | null = null;

  try {
    throwIfAborted(signal);

    const initialLyrics = createLyricRuntime(job.lyrics, 0);
    const prepared =
      (await measureAsync(profiler, "prepare", async () => {
        return await prepareSceneComponents(enabledComponents, componentLookup, {
          video: job.video,
          lyrics: initialLyrics,
          assets,
          audio,
          signal,
          logger
        });
      })) ?? {};

    browser = await chromium.launch({
      headless: true
    });

    page = await browser.newPage({
      viewport: {
        width: job.video.width,
        height: job.video.height
      },
      deviceScaleFactor: 1
    });

    wirePageDiagnostics(page, logger);
    await registerAssetRoutes(page, preloadedAssets, logger);

    await measureAsync(profiler, "domUpdate", async () => {
      await page!.setContent(renderPageShell(), { waitUntil: "domcontentloaded" });
    });

    cdpSession = await page.context().newCDPSession(page);
    await cdpSession.send("Page.enable");

    muxer = startFrameMuxer(job, signal, logger);
    const lyricRuntimeCursor = createLyricRuntimeCursor(job.lyrics, 0);
    const renderStartMs = performance.now();
    let lastProgressEmitMs = renderStartMs - PROGRESS_INTERVAL_MS;
    let previousMarkup: string | null = null;
    let previousFrameImage: Buffer | null = null;
    const stackStaticWhenMarkupUnchanged = areAllComponentsStaticWhenMarkupUnchanged(
      enabledComponents,
      componentLookup
    );

    for (let frame = 0; frame < job.video.durationInFrames; frame += 1) {
      throwIfAborted(signal);

      const timeMs = Math.min(job.video.durationMs, Math.round((frame / job.video.fps) * 1000));
      const lyrics = lyricRuntimeCursor.getRuntimeAt(timeMs);
      const markup = measureSync(profiler, "markup", () =>
        buildCompositeFrameMarkup({
          job,
          componentLookup,
          components: enabledComponents,
          frame,
          timeMs,
          lyrics,
          assets,
          prepared
        })
      );
      const markupChanged = markup !== previousMarkup;

      if (markupChanged) {
        const domUpdateResult = await measureAsync(profiler, "domUpdate", async () => {
          return await updatePageMarkup(page!, markup);
        });

        for (const warning of domUpdateResult.warnings) {
          logger.warn(warning);
        }

        previousMarkup = markup;
      }

      const frameImage: Buffer =
        stackStaticWhenMarkupUnchanged && !markupChanged && previousFrameImage
          ? previousFrameImage
          : await measureAsync(profiler, "screenshot", async () => {
              return await captureFrameBuffer(cdpSession!);
            });

      previousFrameImage = frameImage;

      await measureAsync(profiler, "muxing", async () => {
        await muxer!.writeFrame(frameImage);
      });

      const nowMs = performance.now();
      const isLastFrame = frame + 1 === job.video.durationInFrames;
      if (isLastFrame || nowMs - lastProgressEmitMs >= PROGRESS_INTERVAL_MS) {
        const framesRendered = frame + 1;
        const elapsedMs = Math.max(nowMs - renderStartMs, 1);
        const renderFps = (framesRendered * 1000) / elapsedMs;
        const framesRemaining = job.video.durationInFrames - framesRendered;
        const etaMs = framesRemaining > 0 ? Math.round((framesRemaining / renderFps) * 1000) : 0;

        progress.emit({
          jobId: job.id,
          status: "rendering",
          progress: (framesRendered / job.video.durationInFrames) * 85,
          message: `Rendering frame ${framesRendered} of ${job.video.durationInFrames}`,
          etaMs,
          renderFps: Number(renderFps.toFixed(2))
        });

        lastProgressEmitMs = nowMs;
      }
    }

    throwIfAborted(signal);

    progress.emit({
      jobId: job.id,
      status: "muxing",
      progress: 90,
      message: "Muxing frames with source audio"
    });

    if (!muxer) {
      throw new Error("Frame muxer was not initialized.");
    }

    const activeMuxer = muxer;
    await measureAsync(profiler, "muxing", async () => {
      await activeMuxer.finish();
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
    if (isAbortError(error)) {
      logger.warn("Render cancelled.");
      progress.emit({
        jobId: job.id,
        status: "cancelled",
        progress: 0,
        message: "Render cancelled"
      });
      throw error;
    }

    const errorMessage = error instanceof Error ? error.message : String(error);
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
    if (muxer && !muxerFinished) {
      await muxer.abort();
    }

    if (page) {
      await page.unroute(`${ASSET_URL_PREFIX}**`);
    }

    if (cdpSession) {
      await cdpSession.detach();
    }

    if (browser) {
      await browser.close();
    }

    logRenderProfile(profiler, job, logger);
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

function renderPageShell(): string {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <style>
      html, body, #app {
        margin: 0;
        width: 100%;
        height: 100%;
        overflow: hidden;
        background: #000;
      }
      * {
        box-sizing: border-box;
      }
      body {
        font-synthesis-weight: none;
        text-rendering: geometricPrecision;
      }
    </style>
  </head>
  <body>
    <div id="app"></div>
    <script>
      window.__replaceFrameMarkup = async function replaceFrameMarkup(markup) {
        const app = document.getElementById("app");
        if (!app) {
          throw new Error("Render shell app container is missing.");
        }

        app.innerHTML = markup;

        const pendingImages = Array.from(app.querySelectorAll("img"));
        const warnings = [];
        if (pendingImages.length > 0) {
          await Promise.all(
            pendingImages.map(
              (image) =>
                new Promise((resolve) => {
                  if (image.complete) {
                    if (!image.naturalWidth) {
                      warnings.push("Image failed to decode: " + (image.currentSrc || image.src));
                    }
                    resolve();
                    return;
                  }

                  image.addEventListener(
                    "load",
                    () => {
                      if (!image.naturalWidth) {
                        warnings.push("Image loaded without pixels: " + (image.currentSrc || image.src));
                      }
                      resolve();
                    },
                    { once: true }
                  );
                  image.addEventListener(
                    "error",
                    () => {
                      warnings.push("Image failed to load: " + (image.currentSrc || image.src));
                      resolve();
                    },
                    { once: true }
                  );
                })
            )
          );
        }

        if (document.fonts && document.fonts.ready) {
          await document.fonts.ready;
        }

        return { warnings };
      };
    </script>
  </body>
</html>`;
}

async function updatePageMarkup(
  page: Page,
  markup: string
): Promise<{ warnings: string[] }> {
  return await page.evaluate(async (nextMarkup) => {
    const replaceFrameMarkup = (
      window as Window & {
        __replaceFrameMarkup?: (markup: string) => Promise<{ warnings: string[] }>;
      }
    ).__replaceFrameMarkup;

    if (!replaceFrameMarkup) {
      throw new Error("Render shell has not been initialized.");
    }

    return await replaceFrameMarkup(nextMarkup);
  }, markup);
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

async function registerAssetRoutes(
  page: Page,
  assets: Map<string, PreloadedAsset>,
  logger: RenderLogger
) {
  await page.route(`${ASSET_URL_PREFIX}**`, async (route) => {
    await fulfillAssetRoute(route, assets, logger);
  });
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

async function captureFrameBuffer(cdpSession: CDPSession): Promise<Buffer> {
  const screenshot = await cdpSession.send("Page.captureScreenshot", {
    format: "png",
    fromSurface: true,
    captureBeyondViewport: false,
    optimizeForSpeed: true
  });

  return Buffer.from(screenshot.data, "base64");
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
      markup: 0,
      domUpdate: 0,
      screenshot: 0,
      muxing: 0
    }
  };
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
          markup: roundMs(profiler.stages.markup),
          domUpdate: roundMs(profiler.stages.domUpdate),
          screenshot: roundMs(profiler.stages.screenshot),
          muxing: roundMs(profiler.stages.muxing)
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

function startFrameMuxer(
  job: RenderJob,
  signal: AbortSignal | undefined,
  logger: RenderLogger
): FrameMuxer {
  let aborted = false;
  let finished = false;

  const child = spawn(
    "ffmpeg",
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

      await new Promise<void>((resolve, reject) => {
        const handleError = (error: Error) => {
          child.stdin.off("error", handleError);
          reject(error);
        };

        child.stdin.once("error", handleError);
        child.stdin.write(frame, (error) => {
          child.stdin.off("error", handleError);
          if (error) {
            reject(error);
            return;
          }

          resolve();
        });
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
