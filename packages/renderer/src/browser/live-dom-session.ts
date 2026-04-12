import {
  createLyricRuntimeCursor,
  type PreparedSceneStackData,
  type RenderJob,
  type SceneAssetAccessor,
  type SceneComponentDefinition,
  type ValidatedSceneComponentInstance
} from "@lyric-video-maker/core";
import { throwIfAborted } from "../abort";
import { FRAME_STAGE_TIMEOUT_MS } from "../constants";
import { createFrameStageTimeoutError, withTimeout } from "../ffmpeg/frame-writer";
import {
  awaitFrameReadiness,
  createLiveDomFramePayload,
  createLiveDomScenePayload,
  injectComponentRuntimes,
  mountLiveDomScene,
  renderPageShell,
  updateLiveDomScene
} from "../live-dom";
import {
  maybeMeasureAsync,
  maybeMeasureSync,
  measurePreviewStage,
  traceRenderStep
} from "../profiling";
import { toBrowserLyricRuntime } from "../react-ssr/lyric-runtime-bridge";
import type {
  FramePreviewSession,
  PreloadedAsset,
  PreviewProfiler,
  RenderLogger,
  RenderProfiler
} from "../types";
import type { VideoFrameExtractionEntry } from "../video-frame-extraction";
import { captureFrameBuffer } from "./capture";
import { resolveChromiumExecutable } from "./chromium-loader";
import { wirePageDiagnostics } from "./diagnostics";
import { disposePreviewBrowserResources } from "./dispose";
import { registerAssetRoutes } from "./asset-routes";
import { createRenderPage } from "./render-page";
import { connectBrowser, type BrowserClient, type PageClient } from "./cdp-session";
import { launchChromium, type LaunchedChromium } from "./launch";

export async function createLiveDomRenderSession({
  sessionLabel,
  job,
  componentLookup,
  components,
  assets,
  preloadedAssets,
  prepared,
  scenePayload,
  signal,
  logger,
  profiler,
  previewProfiler,
  videoFrameExtractions = [],
  fontCss = "",
  fontCacheDir
}: {
  sessionLabel: string;
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
  previewProfiler?: PreviewProfiler;
  videoFrameExtractions?: VideoFrameExtractionEntry[];
  fontCss?: string;
  fontCacheDir?: string;
}): Promise<FramePreviewSession> {
  let launched: LaunchedChromium | null = null;
  let browser: BrowserClient | null = null;
  let page: PageClient | null = null;
  let detachAssetRoutes: (() => Promise<void>) | null = null;
  let detachDiagnostics: (() => void) | null = null;
  let disposed = false;
  let renderChain = Promise.resolve();
  const lyricRuntimeCursor = createLyricRuntimeCursor(job.lyrics, 0);

  try {
    const executable = await resolveChromiumExecutable();
    launched = await launchChromium({ executable });
    browser = await connectBrowser({ port: launched.port, wsEndpoint: launched.wsEndpoint });

    const renderPage = await createRenderPage({
      browser,
      width: job.video.width,
      height: job.video.height
    });
    page = renderPage.page;

    detachDiagnostics = wirePageDiagnostics(page, logger);
    const assetRoutes = await registerAssetRoutes(
      page,
      preloadedAssets,
      logger,
      videoFrameExtractions,
      fontCacheDir
    );
    detachAssetRoutes = assetRoutes.dispose;
    await page.setContent(renderPageShell(fontCss));
    await injectComponentRuntimes(page, components, componentLookup);

    const mountWarnings = await maybeMeasureAsync(profiler, "browserUpdate", async () => {
      return await mountLiveDomScene(page!, scenePayload);
    });

    for (const warning of mountWarnings.warnings) {
      logger.warn(warning);
    }
  } catch (error) {
    if (detachDiagnostics) {
      detachDiagnostics();
    }
    await disposePreviewBrowserResources({ page, browser, launched, detachAssetRoutes });
    throw error;
  }

  return {
    async renderFrame({ frame }) {
      const nextRender = renderChain.then(async () => {
        if (disposed || !page) {
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
        await measurePreviewStage(previewProfiler, "updateLiveDomScene", async () => {
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
        }, { frame: safeFrame, timeMs });
        traceRenderStep(logger, sessionLabel, safeFrame, "browser-update-done");

        // Per-frame readiness gate. Awaits any async tasks components
        // registered during updateLiveDomScene so capture sees a settled DOM.
        // Zero added latency when no
        // tasks are pending.
        const readinessResult = await awaitFrameReadiness(page!);
        for (const timeout of readinessResult.timeouts) {
          logger.warn(
            `[frame-readiness] seek timeout at frame ${timeout.frame} label=${timeout.label ?? "(none)"} timeoutMs=${timeout.timeoutMs}`
          );
        }

        traceRenderStep(logger, sessionLabel, safeFrame, "capture-start");
        const capture = await measurePreviewStage(previewProfiler, "captureScreenshot", async () => {
          return await withTimeout(
            maybeMeasureAsync(profiler, "capture", async () => {
              return await captureFrameBuffer({
                page: page!
              });
            }),
            createFrameStageTimeoutError({
              sessionLabel,
              frame: safeFrame,
              stage: "capture"
            }),
            FRAME_STAGE_TIMEOUT_MS
          );
        }, { frame: safeFrame, timeMs });
        traceRenderStep(logger, sessionLabel, safeFrame, "capture-done");

        return {
          png: capture,
          frame: safeFrame,
          timeMs
        };
      });

      renderChain = nextRender.then(() => undefined, () => undefined);
      return await nextRender;
    },
    async dispose() {
      if (disposed) {
        return;
      }

      disposed = true;
      if (detachDiagnostics) {
        detachDiagnostics();
        detachDiagnostics = null;
      }
      await disposePreviewBrowserResources({ page, browser, launched, detachAssetRoutes });
      page = null;
      browser = null;
      launched = null;
      detachAssetRoutes = null;
    }
  };
}
