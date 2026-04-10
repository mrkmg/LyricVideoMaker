import type { Browser, BrowserContext, CDPSession, Page } from "playwright";
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
  createLiveDomFramePayload,
  createLiveDomScenePayload,
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
import { captureFrameBuffer } from "./capture";
import { getBeginFrameLaunchArgs, loadChromium } from "./chromium-loader";
import { wirePageDiagnostics } from "./diagnostics";
import { disposePreviewBrowserResources } from "./dispose";
import { registerAssetRoutes } from "./asset-routes";
import { createRenderPage } from "./render-page";

export async function createLiveDomRenderSession({
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
  profiler,
  previewProfiler
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
  previewProfiler?: PreviewProfiler;
}): Promise<FramePreviewSession> {
  let browser: Browser | null = null;
  let browserContext: BrowserContext | null = null;
  let page: Page | null = null;
  let cdpSession: CDPSession | null = null;
  let disposed = false;
  let beginFrameFallbackLogged = false;
  let renderChain = Promise.resolve();
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
      const nextRender = renderChain.then(async () => {
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

        traceRenderStep(logger, sessionLabel, safeFrame, "capture-start");
        const capture = await measurePreviewStage(previewProfiler, "captureScreenshot", async () => {
          return await withTimeout(
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
        }, { frame: safeFrame, timeMs });
        traceRenderStep(logger, sessionLabel, safeFrame, "capture-done");
        beginFrameFallbackLogged = capture.beginFrameFallbackLogged;

        return {
          png: capture.buffer,
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
      await disposePreviewBrowserResources({ page, cdpSession, browserContext, browser });
      page = null;
      cdpSession = null;
      browserContext = null;
      browser = null;
    }
  };
}
