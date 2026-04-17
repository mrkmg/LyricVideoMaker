import {
  type LyricCue,
  type PreparedSceneStackData,
  type RenderJob,
  type SceneAssetAccessor,
  type SceneComponentDefinition,
  type ValidatedSceneComponentInstance
} from "@lyric-video-maker/core";
import { throwIfAborted } from "../abort";
import { FRAME_STAGE_TIMEOUT_MS } from "../constants";
import { createFrameStageTimeoutError, withTimeout } from "../ffmpeg/frame-writer";
import { awaitFrameReadiness, type ReadinessTimeoutEvent } from "../live-dom";
import {
  maybeMeasureAsync,
  measurePreviewStage,
  traceRenderStep
} from "../profiling";
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
import { BROWSER_BUNDLE_SOURCE } from "./_generated-browser-bundle";
import { FRAME_READINESS_SCRIPT_SOURCE } from "../live-dom";

// ---------------------------------------------------------------------------
// Payload types (must match react-shell.tsx structurally)
// ---------------------------------------------------------------------------

interface ReactModifierConfig {
  id: string;
  modifierId: string;
  enabled: boolean;
  options: Record<string, unknown>;
}

interface ReactSceneConfig {
  video: RenderJob["video"];
  lyricCues: LyricCue[];
  components: Array<{
    instanceId: string;
    componentId: string;
    componentName: string;
    options: Record<string, unknown>;
    modifiers: ReactModifierConfig[];
    prepared: Record<string, unknown>;
    resolvedAssets: Record<string, string | null>;
  }>;
}

interface ReactFramePayload {
  frame: number;
  timeMs: number;
}

// ---------------------------------------------------------------------------
// React page shell — HTML skeleton with readiness gate + React bundle
// ---------------------------------------------------------------------------

function renderReactPageShell(fontCss = ""): string {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    ${fontCss ? `<style data-google-fonts>\n${fontCss.replace(/<\/style/gi, "<\\/style")}\n    </style>` : ""}
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
      (() => {
        ${FRAME_READINESS_SCRIPT_SOURCE}
      })();
    </script>
    <script>
      ${BROWSER_BUNDLE_SOURCE}
    </script>
  </body>
</html>`;
}

// ---------------------------------------------------------------------------
// Build the React scene config from render job data
// ---------------------------------------------------------------------------

function buildReactSceneConfig({
  job,
  components,
  assets,
  prepared,
  preloadedAssets
}: {
  job: RenderJob;
  components: ValidatedSceneComponentInstance[];
  assets: Pick<SceneAssetAccessor, "getUrl">;
  prepared: PreparedSceneStackData;
  preloadedAssets: Map<string, PreloadedAsset>;
}): ReactSceneConfig {
  return {
    video: job.video,
    lyricCues: job.lyrics,
    components: components.map((instance) => {
      // Pre-resolve all asset URLs for this instance
      const resolvedAssets: Record<string, string | null> = {};
      for (const [, asset] of preloadedAssets) {
        if (asset.instanceId === instance.id) {
          resolvedAssets[asset.optionId] = asset.url;
        }
      }

      return {
        instanceId: instance.id,
        componentId: instance.componentId,
        componentName: instance.componentName,
        options: instance.options,
        modifiers: (instance.modifiers ?? []).map((modifier) => ({
          id: modifier.id,
          modifierId: modifier.modifierId,
          enabled: modifier.enabled,
          options: modifier.options
        })),
        prepared: prepared[instance.id] ?? {},
        resolvedAssets
      };
    })
  };
}

// ---------------------------------------------------------------------------
// Plugin activation in browser
// ---------------------------------------------------------------------------

async function activatePluginInBrowser(
  page: PageClient,
  bundleSource: string
): Promise<void> {
  await page.evaluate((source: string) => {
    const register = (
      window as Window & {
        __registerReactComponent?: (id: string, component: Function) => void;
        __registerModifier?: (id: string, definition: unknown) => void;
        __getPluginHost?: () => unknown;
      }
    );

    const host = register.__getPluginHost?.() as
      | {
          React: unknown;
          pluginBase: unknown;
          modifiers: unknown;
          core: unknown;
        }
      | undefined;
    if (!host) {
      throw new Error("Plugin host not available in browser page.");
    }

    // require shim: plugin bundles externalize "react" and
    // "@lyric-video-maker/plugin-base" so they resolve to the host's
    // copies at load time. This prevents duplicate React instances
    // (invalid-hook-call) and keeps `process.env.NODE_ENV` out of
    // plugin.cjs entirely.
    const requireShim = (id: string): unknown => {
      if (id === "react") return host.React;
      if (id === "@lyric-video-maker/plugin-base") return host.pluginBase;
      throw new Error(`Plugin require() for "${id}" is not supported.`);
    };

    // Evaluate the CJS bundle in a CommonJS-like wrapper
    const mod = { exports: {} as Record<string, unknown> };
    const wrapper = new Function("module", "exports", "require", source);
    wrapper(mod, mod.exports, requireShim);

    // Call activate(host) to get component definitions (host.modifiers.register
    // may also have been called directly during activate — see browser-entry).
    const activate = (mod.exports as { activate?: Function }).activate;
    if (typeof activate !== "function") {
      throw new Error("Plugin bundle does not export activate().");
    }

    const activation = activate(host) as {
      components?: Array<{ id: string; Component: Function }>;
      modifiers?: Array<{ id: string; apply: Function }>;
    };

    if (activation?.components) {
      for (const component of activation.components) {
        if (component.id && typeof component.Component === "function") {
          register.__registerReactComponent!(component.id, component.Component);
        }
      }
    }
    if (activation?.modifiers && register.__registerModifier) {
      for (const modifier of activation.modifiers) {
        if (modifier && modifier.id && typeof modifier.apply === "function") {
          register.__registerModifier(modifier.id, modifier);
        }
      }
    }
  }, bundleSource);
}

// ---------------------------------------------------------------------------
// Mount + update helpers via CDP
// ---------------------------------------------------------------------------

async function mountReactScene(
  page: PageClient,
  config: ReactSceneConfig
): Promise<{ warnings: string[] }> {
  return await page.evaluate(async (sceneConfig) => {
    const mount = (
      window as Window & {
        __mountReactScene?: (
          config: ReactSceneConfig
        ) => Promise<{ warnings: string[] }>;
      }
    ).__mountReactScene;

    if (!mount) {
      throw new Error("React render shell has not been initialized.");
    }

    return await mount(sceneConfig);
  }, config);
}

async function updateReactFrame(
  page: PageClient,
  payload: ReactFramePayload
): Promise<void> {
  await page.evaluate((framePayload) => {
    const update = (
      window as Window & {
        __updateFrameProps?: (payload: ReactFramePayload) => void;
      }
    ).__updateFrameProps;

    if (!update) {
      throw new Error("React render shell has not been initialized.");
    }

    update(framePayload);
  }, payload);
}

// ---------------------------------------------------------------------------
// Session factory — same FramePreviewSession interface as live-dom-session
// ---------------------------------------------------------------------------

export async function createRenderSession({
  sessionLabel,
  job,
  componentLookup,
  components,
  assets,
  preloadedAssets,
  prepared,
  pluginBundleSources = [],
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
  pluginBundleSources?: string[];
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

    // Inject the React page shell (readiness gate + React bundle)
    await page.setContent(renderReactPageShell(fontCss));

    // Activate external plugin bundles in the browser page
    for (const bundleSource of pluginBundleSources) {
      await activatePluginInBrowser(page, bundleSource);
    }

    // Build and mount the React scene
    const sceneConfig = buildReactSceneConfig({
      job,
      components,
      assets,
      prepared,
      preloadedAssets
    });

    const mountResult = await maybeMeasureAsync(profiler, "browserUpdate", async () => {
      return await mountReactScene(page!, sceneConfig);
    });

    for (const warning of mountResult.warnings) {
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

        const framePayload: ReactFramePayload = {
          frame: safeFrame,
          timeMs
        };

        traceRenderStep(logger, sessionLabel, safeFrame, "browser-update-start");
        await measurePreviewStage(previewProfiler, "updateLiveDomScene", async () => {
          await withTimeout(
            maybeMeasureAsync(profiler, "browserUpdate", async () => {
              await updateReactFrame(page!, framePayload);
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

        // Per-frame readiness gate
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
