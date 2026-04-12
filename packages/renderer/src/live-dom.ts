import type { PageClient } from "./browser/cdp-session";
import type {
  BrowserLyricRuntime,
  PreparedSceneStackData,
  RenderJob,
  SceneAssetAccessor,
  SceneComponentDefinition,
  ValidatedSceneComponentInstance
} from "@lyric-video-maker/core";

export interface LiveDomSceneComponentPayload {
  instanceId: string;
  componentId: string;
  componentName: string;
  runtimeId: string;
  initialState: Record<string, unknown> | null;
}

export interface LiveDomScenePayload {
  video: RenderJob["video"];
  components: LiveDomSceneComponentPayload[];
}

export interface LiveDomFrameComponentPayload {
  instanceId: string;
  state: Record<string, unknown>;
}

export interface LiveDomFramePayload {
  frame: number;
  timeMs: number;
  components: LiveDomFrameComponentPayload[];
}

export function canRenderWithLiveDom(
  components: ValidatedSceneComponentInstance[],
  componentLookup: Map<string, SceneComponentDefinition<Record<string, unknown>>>
) {
  return components.every((instance) => {
    const definition = componentLookup.get(instance.componentId);
    return Boolean(definition?.browserRuntime?.runtimeId && definition.browserRuntime.browserScript);
  });
}

export async function injectComponentRuntimes(
  page: PageClient,
  components: ValidatedSceneComponentInstance[],
  componentLookup: Map<string, SceneComponentDefinition<Record<string, unknown>>>
): Promise<void> {
  const injected = new Set<string>();
  for (const instance of components) {
    const definition = componentLookup.get(instance.componentId);
    const runtime = definition?.browserRuntime;
    if (!runtime || injected.has(runtime.runtimeId)) continue;
    injected.add(runtime.runtimeId);

    if (!runtime.browserScript) {
      throw new Error(
        `Component "${instance.componentId}" has runtimeId "${runtime.runtimeId}" but no browserScript.`
      );
    }

    await page.evaluate((script: string) => {
      new Function(script)();
    }, runtime.browserScript);
  }
}

export function createLiveDomScenePayload({
  job,
  components,
  componentLookup,
  assets,
  prepared
}: {
  job: RenderJob;
  components: ValidatedSceneComponentInstance[];
  componentLookup: Map<string, SceneComponentDefinition<Record<string, unknown>>>;
  assets: Pick<SceneAssetAccessor, "getUrl">;
  prepared: PreparedSceneStackData;
}): LiveDomScenePayload {
  const lyrics = createBrowserLyricRuntime(job.lyrics[0] ? { current: null, next: job.lyrics[0] } : { current: null, next: null });

  return {
    video: job.video,
    components: components.map((instance) => {
      const definition = componentLookup.get(instance.componentId);
      if (!definition?.browserRuntime) {
        throw new Error(`Scene component "${instance.componentId}" is missing a browser runtime.`);
      }

      return {
        instanceId: instance.id,
        componentId: instance.componentId,
        componentName: instance.componentName,
        runtimeId: definition.browserRuntime.runtimeId,
        initialState:
          definition.browserRuntime.getInitialState?.({
            instance,
            options: instance.options,
            video: job.video,
            lyrics,
            assets,
            prepared: prepared[instance.id] ?? {}
          }) ?? null
      };
    })
  };
}

export function createLiveDomFramePayload({
  components,
  componentLookup,
  frame,
  timeMs,
  video,
  lyrics,
  assets,
  prepared
}: {
  components: ValidatedSceneComponentInstance[];
  componentLookup: Map<string, SceneComponentDefinition<Record<string, unknown>>>;
  frame: number;
  timeMs: number;
  video: RenderJob["video"];
  lyrics: BrowserLyricRuntime;
  assets: Pick<SceneAssetAccessor, "getUrl">;
  prepared: PreparedSceneStackData;
}): LiveDomFramePayload {
  return {
    frame,
    timeMs,
    components: components.flatMap((instance) => {
      const definition = componentLookup.get(instance.componentId);
      const frameState = definition?.browserRuntime?.getFrameState?.({
        instance,
        options: instance.options,
        frame,
        timeMs,
        video,
        lyrics,
        assets,
        prepared: prepared[instance.id] ?? {}
      });

      if (!frameState) {
        return [];
      }

      return [
        {
          instanceId: instance.id,
          state: frameState
        }
      ];
    })
  };
}

export async function mountLiveDomScene(page: PageClient, payload: LiveDomScenePayload) {
  return await page.evaluate(async (scenePayload) => {
    const mountScene = (
      window as Window & {
        __mountLiveDomScene?: (
          payload: LiveDomScenePayload
        ) => Promise<{ warnings: string[] }>;
      }
    ).__mountLiveDomScene;

    if (!mountScene) {
      throw new Error("Live DOM render shell has not been initialized.");
    }

    return await mountScene(scenePayload);
  }, payload);
}

export async function updateLiveDomScene(page: PageClient, payload: LiveDomFramePayload) {
  if (payload.components.length === 0) {
    return;
  }

  await page.evaluate(async (framePayload) => {
    const renderFrame = (
      window as Window & {
        __renderLiveDomFrame?: (payload: LiveDomFramePayload) => Promise<void>;
      }
    ).__renderLiveDomFrame;

    if (!renderFrame) {
      throw new Error("Live DOM render shell has not been initialized.");
    }

    await renderFrame(framePayload);
  }, payload);
}

/**
 * Per-frame readiness gate.
 *
 * Awaits any asynchronous readiness tasks that components registered with
 * `window.__frameReadiness` during the current frame — typically video
 * seeks in flight — so capture sees a settled DOM. Resolves immediately
 * when no tasks are pending, adding effectively zero latency to scenes
 * that do not register readiness tasks.
 *
 * Also drains any timeout events that the page emitted while waiting so
 * the render logger can surface them without aborting the render.
 */
export async function awaitFrameReadiness(
  page: PageClient
): Promise<{ timeouts: ReadinessTimeoutEvent[] }> {
  return await page.evaluate(async () => {
    const hook = (
      window as Window & {
        __frameReadiness?: { awaitAll(): Promise<void> };
        __frameReadinessDrainTimeoutEvents?: () => ReadinessTimeoutEvent[];
      }
    ).__frameReadiness;

    if (hook) {
      await hook.awaitAll();
    }

    // Wait for any in-flight @font-face loads to settle. Without this, the
    // first few frames render with fallback metrics and reflow once the
    // real font arrives — visible as text in slightly wrong positions.
    if (typeof document !== "undefined" && document.fonts && document.fonts.ready) {
      try {
        await document.fonts.ready;
      } catch {
        // Some browsers reject fonts.ready on internal failures — ignore
        // and let the screenshot proceed with whatever fonts are loaded.
      }
    }

    // // Force a synchronous style/layout flush so the compositor frame
    // // captured next sees final positions instead of stale ones from the
    // // previous frame's update.
    // if (typeof document !== "undefined" && document.body) {
    //   // Reading offsetHeight is the standard "force layout" trick.
    //   void document.body.offsetHeight;
    // }

    // // Yield two animation frames so any CSS transitions / transforms
    // // applied during updateLiveDomScene get a chance to commit to the
    // // compositor before captureScreenshot reads the surface.
    // await new Promise<void>((resolve) => {
    //   const raf = (window as Window & {
    //     requestAnimationFrame?: (cb: () => void) => number;
    //   }).requestAnimationFrame;
    //   if (typeof raf === "function") {
    //     raf(() => raf(() => resolve()));
    //   } else {
    //     resolve();
    //   }
    // });

    const drain = (
      window as Window & {
        __frameReadinessDrainTimeoutEvents?: () => ReadinessTimeoutEvent[];
      }
    ).__frameReadinessDrainTimeoutEvents;

    return {
      timeouts: drain ? drain() : ([] as ReadinessTimeoutEvent[])
    };
  });
}

export interface ReadinessTimeoutEvent {
  frame: number;
  label: string | null;
  timeoutMs: number;
  timestamp: number;
}

/**
 * Standalone script source for the frame-readiness + video-sync helpers.
 *
 * Exported as a string so it can be:
 *   (a) inlined into the renderPageShell IIFE, and
 *   (b) unit-tested in isolation by eval'ing into a fake window.
 *
 * The script installs:
 *   - window.__frameReadiness  — the per-frame readiness gate (T-042, R1)
 *   - window.__syncImageFrameElement — helper to swap an <img> source and
 *                                      return a readiness promise
 *   - window.__frameReadinessSetCurrentFrame — internal hook so the frame
 *                                               loop records which frame is
 *                                               active when a timeout fires
 *   - window.__frameReadinessDrainTimeoutEvents — drain logged timeout
 *                                                  events for Node to report
 *
 * Bounded timeout + log surfacing for stuck seeks (T-045) lives here. A
 * timed-out seek resolves the readiness task and pushes an event onto the
 * drain queue so the Node-side render logger can emit a warning without
 * aborting the render.
 */
export const FRAME_READINESS_SCRIPT_SOURCE = `
  var pendingReadiness = [];
  var readinessTimeoutEvents = [];
  var currentFrameNumber = -1;

  window.__frameReadiness = {
    register: function(task, label) {
      pendingReadiness.push({ task: task, label: label });
    },
    awaitAll: function() {
      if (pendingReadiness.length === 0) {
        return Promise.resolve();
      }
      var tasks = pendingReadiness.splice(0, pendingReadiness.length);
      return Promise.allSettled(tasks.map(function(entry) { return entry.task; }))
        .then(function() {});
    },
    get pendingCount() { return pendingReadiness.length; }
  };

  window.__frameReadinessSetCurrentFrame = function(frame) {
    currentFrameNumber = typeof frame === "number" ? frame : -1;
  };

  window.__frameReadinessDrainTimeoutEvents = function() {
    return readinessTimeoutEvents.splice(0, readinessTimeoutEvents.length);
  };

  var IMAGE_FRAME_TIMEOUT_MS = 1000;

  function recordReadinessTimeout(label) {
    readinessTimeoutEvents.push({
      frame: currentFrameNumber,
      label: label || null,
      timeoutMs: IMAGE_FRAME_TIMEOUT_MS,
      timestamp: Date.now()
    });
    if (typeof console !== "undefined" && console.warn) {
      console.warn(
        "[frame-readiness] timeout at frame " + currentFrameNumber +
        " label=" + (label || "(none)") +
        " timeoutMs=" + IMAGE_FRAME_TIMEOUT_MS
      );
    }
  }

  window.__syncImageFrameElement = function syncImageFrameElement(image, src, label) {
    if (!image || typeof src !== "string" || !src) {
      return null;
    }
    if ((image.currentSrc === src || image.src === src) && image.complete && image.naturalWidth > 0) {
      return null;
    }
    return new Promise(function(resolve) {
      var settled = false;
      var timer = null;
      function finish() {
        if (settled) return;
        settled = true;
        if (timer !== null) { clearTimeout(timer); }
        image.removeEventListener("load", onLoad);
        image.removeEventListener("error", onError);
        resolve();
      }
      function onLoad() {
        if (typeof image.decode === "function") {
          image.decode().then(finish, finish);
          return;
        }
        finish();
      }
      function onError() { finish(); }
      image.addEventListener("load", onLoad, { once: true });
      image.addEventListener("error", onError, { once: true });
      try {
        image.src = src;
        if (image.complete) {
          onLoad();
        }
      } catch (error) {
        finish();
      }
      timer = setTimeout(function() {
        if (!settled) {
          recordReadinessTimeout(label);
        }
        finish();
      }, IMAGE_FRAME_TIMEOUT_MS);
    });
  };
`;

export function renderPageShell(fontCss = ""): string {
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
        const mountedComponents = new Map();

        // ────────────────────────────────────────────────────────────────
        // Per-frame readiness gate. Installs
        // window.__frameReadiness, window.__syncImageFrameElement, and related
        // helpers. The contract is component-agnostic so any async task can
        // be registered. See FRAME_READINESS_SCRIPT_SOURCE in live-dom.ts.
        // ────────────────────────────────────────────────────────────────
        ${FRAME_READINESS_SCRIPT_SOURCE}

        function applyStyles(element, styles) {
          if (!styles) {
            return;
          }

          for (const [key, value] of Object.entries(styles)) {
            if (value === undefined || value === null) {
              continue;
            }

            element.style[key] = String(value);
          }
        }

        function createLayer() {
          const layer = document.createElement("div");
          applyStyles(layer, {
            position: "absolute",
            inset: "0",
            width: "100%",
            height: "100%",
            overflow: "hidden"
          });
          return layer;
        }

        function waitForAssets(root) {
          const warnings = [];
          const pendingImages = Array.from(root.querySelectorAll("img")).filter(
            (image) => !image.hasAttribute("data-video-frame")
          );

          const waitForImages = pendingImages.length > 0
            ? Promise.all(
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
              )
            : Promise.resolve();

          return waitForImages.then(async () => {
            if (document.fonts && document.fonts.ready) {
              await document.fonts.ready;
            }

            return warnings;
          });
        }

        // ────────────────────────────────────────────────────────────────
        // Live-DOM runtime registry.
        //
        // Runtimes are registered dynamically by component browserScript
        // strings via window.__registerLiveDomRuntime(). The registry
        // starts empty — scripts are injected before scene mounting.
        //
        // Each runtime exposes mount(layer, initialState) → handle and
        // update(handle, state) for per-frame DOM updates.
        //
        // Per-frame readiness contract:
        //   Components returning state.__imageFrameSync from getFrameState
        //   trigger the image sync gate automatically. Any async task can
        //   register on window.__frameReadiness.
        // ────────────────────────────────────────────────────────────────
        const runtimeRegistry = {};

        window.__registerLiveDomRuntime = function(runtimeId, runtime) {
          runtimeRegistry[runtimeId] = runtime;
        };

        window.__liveDomUtils = {
          applyStyles: applyStyles
        };

        window.__mountLiveDomScene = async function mountLiveDomScene(payload) {
          const app = document.getElementById("app");
          if (!app) {
            throw new Error("Render shell app container is missing.");
          }

          app.innerHTML = "";
          mountedComponents.clear();

          const root = document.createElement("div");
          applyStyles(root, {
            position: "relative",
            width: String(payload.video.width) + "px",
            height: String(payload.video.height) + "px",
            overflow: "hidden",
            background: "#09090f"
          });
          app.appendChild(root);

          for (const component of payload.components) {
            const runtime = runtimeRegistry[component.runtimeId];
            if (!runtime) {
              throw new Error('Unsupported browser runtime "' + component.runtimeId + '".');
            }

            const layer = createLayer();
            layer.dataset.sceneComponentId = component.componentId;
            layer.dataset.sceneInstanceId = component.instanceId;
            root.appendChild(layer);
            const handle = runtime.mount(layer, component.initialState || {});
            mountedComponents.set(component.instanceId, { runtime, handle, layer });
          }

          const warnings = await waitForAssets(root);
          return { warnings };
        };

        window.__renderLiveDomFrame = async function renderLiveDomFrame(payload) {
          window.__frameReadinessSetCurrentFrame(
            typeof payload.frame === "number" ? payload.frame : -1
          );
          for (const component of payload.components) {
            const mounted = mountedComponents.get(component.instanceId);
            if (!mounted) {
              continue;
            }

            const state = component.state || {};
            mounted.runtime.update(mounted.handle, state);

            const imageFrameSync = state.__imageFrameSync;
            if (imageFrameSync && typeof imageFrameSync === "object" && typeof imageFrameSync.src === "string") {
              const images = mounted.layer.querySelectorAll("img[data-video-frame]");
              for (let i = 0; i < images.length; i += 1) {
                const label = imageFrameSync.label || (component.instanceId + ":image-frame");
                const readiness = window.__syncImageFrameElement(
                  images[i],
                  imageFrameSync.src,
                  label
                );
                if (readiness) {
                  window.__frameReadiness.register(readiness, label);
                }
              }
            }
          }
        };
      })();
    </script>
  </body>
</html>`;
}

function createBrowserLyricRuntime(
  lyrics: Pick<BrowserLyricRuntime, "current" | "next">
): BrowserLyricRuntime {
  return {
    current: lyrics.current,
    next: lyrics.next
  };
}
