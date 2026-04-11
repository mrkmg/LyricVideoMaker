import type { Page } from "playwright";
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
    return Boolean(definition?.browserRuntime?.runtimeId);
  });
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

export async function mountLiveDomScene(page: Page, payload: LiveDomScenePayload) {
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

export async function updateLiveDomScene(page: Page, payload: LiveDomFramePayload) {
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
  page: Page
): Promise<{ timeouts: ReadinessTimeoutEvent[] }> {
  return await page.evaluate(async () => {
    const hook = (
      window as Window & {
        __frameReadiness?: { awaitAll(): Promise<void> };
        __frameReadinessDrainTimeoutEvents?: () => ReadinessTimeoutEvent[];
      }
    ).__frameReadiness;

    if (!hook) {
      return { timeouts: [] as ReadinessTimeoutEvent[] };
    }

    await hook.awaitAll();

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

export function renderPageShell(): string {
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

        function createEqualizerBarDescriptor(handle, entry, initialState, track) {
          if (entry.type === "gap") {
            const gap = document.createElement("div");
            gap.style.flex = "0 0 " + String(initialState.gapSize) + "px";
            track.appendChild(gap);
            return null;
          }

          const bar = document.createElement("div");
          bar.dataset.equalizerBar = "";
          bar.style.position = "relative";
          bar.style.flex = "1";
          if (initialState.isHorizontal) {
            bar.style.height = "100%";
          } else {
            bar.style.width = "100%";
          }

          const descriptor = {
            type: initialState.layoutMode,
            isHorizontal: initialState.isHorizontal,
            growthDirection: initialState.growthDirection,
            fills: []
          };

          if (initialState.layoutMode === "mirrored") {
            if (initialState.isHorizontal) {
              const upper = document.createElement("div");
              applyStyles(upper, {
                position: "absolute",
                left: "0",
                right: "0",
                top: "0",
                bottom: "50%",
                background: entry.color,
                borderRadius: initialState.borderRadius,
                opacity: initialState.opacity,
                boxShadow: initialState.boxShadow,
                transformOrigin: "center bottom",
                willChange: "transform",
                contain: "layout paint style"
              });
              const lower = upper.cloneNode(false);
              lower.style.top = "50%";
              lower.style.bottom = "0";
              lower.style.transformOrigin = "center top";
              bar.appendChild(upper);
              bar.appendChild(lower);
              descriptor.fills.push(upper, lower);
            } else {
              const left = document.createElement("div");
              applyStyles(left, {
                position: "absolute",
                top: "0",
                bottom: "0",
                left: "0",
                right: "50%",
                background: entry.color,
                borderRadius: initialState.borderRadius,
                opacity: initialState.opacity,
                boxShadow: initialState.boxShadow,
                transformOrigin: "right center",
                willChange: "transform",
                contain: "layout paint style"
              });
              const right = left.cloneNode(false);
              right.style.left = "50%";
              right.style.right = "0";
              right.style.transformOrigin = "left center";
              bar.appendChild(left);
              bar.appendChild(right);
              descriptor.fills.push(left, right);
            }
          } else {
            const fill = document.createElement("div");
            applyStyles(fill, {
              position: "absolute",
              top: "0",
              right: "0",
              bottom: "0",
              left: "0",
              background: entry.color,
              borderRadius: initialState.borderRadius,
              opacity: initialState.opacity,
              boxShadow: initialState.boxShadow,
              willChange: "transform",
              contain: "layout paint style"
            });

            if (initialState.isHorizontal) {
              fill.style.transformOrigin =
                initialState.growthDirection === "down"
                  ? "center top"
                  : initialState.growthDirection === "outward"
                    ? "center center"
                    : "center bottom";
            } else {
              fill.style.transformOrigin =
                initialState.growthDirection === "left"
                  ? "right center"
                  : initialState.growthDirection === "outward"
                    ? "center center"
                    : "left center";
            }

            bar.appendChild(fill);
            descriptor.fills.push(fill);
          }

          track.appendChild(bar);
          handle.barDescriptors.push(descriptor);
          return descriptor;
        }

        function setEqualizerDescriptorColor(descriptor, color) {
          if (typeof color !== "string") {
            return;
          }

          for (const fill of descriptor.fills) {
            fill.style.background = color;
          }
        }

        function applyEqualizerValue(descriptor, value, color) {
          const amplitude = Math.max(0, Math.min(1, Number(value) || 0));
          const transform = descriptor.isHorizontal
            ? "scaleY(" + String(amplitude) + ")"
            : "scaleX(" + String(amplitude) + ")";

          setEqualizerDescriptorColor(descriptor, color);

          for (const fill of descriptor.fills) {
            fill.style.transform = transform;
          }
        }

        function createEqualizerLineDescriptor(initialState, track) {
          const svgNS = "http://www.w3.org/2000/svg";
          const svg = document.createElementNS(svgNS, "svg");
          svg.dataset.equalizerLine = "";
          svg.setAttribute("viewBox", "0 0 100 100");
          svg.setAttribute("preserveAspectRatio", "none");
          applyStyles(svg, initialState.svgStyle || {
            width: "100%",
            height: "100%",
            overflow: "visible"
          });

          const defs = document.createElementNS(svgNS, "defs");
          const gradient = document.createElementNS(svgNS, "linearGradient");
          gradient.setAttribute("id", String(initialState.gradientId || "equalizer-gradient"));
          gradient.setAttribute("gradientUnits", "userSpaceOnUse");
          gradient.setAttribute("x1", String(initialState.gradientAxis?.x1 ?? 0));
          gradient.setAttribute("y1", String(initialState.gradientAxis?.y1 ?? 0));
          gradient.setAttribute("x2", String(initialState.gradientAxis?.x2 ?? 100));
          gradient.setAttribute("y2", String(initialState.gradientAxis?.y2 ?? 0));
          defs.appendChild(gradient);
          svg.appendChild(defs);

          const areaPath = initialState.lineStyle === "area"
            ? document.createElementNS(svgNS, "path")
            : null;
          if (areaPath) {
            areaPath.setAttribute("fill", "url(#" + String(initialState.gradientId) + ")");
            areaPath.style.opacity = String(initialState.areaFillOpacity ?? 0.35);
            areaPath.style.filter = String(initialState.filter || "none");
            svg.appendChild(areaPath);
          }

          const linePath = document.createElementNS(svgNS, "path");
          linePath.setAttribute("fill", "none");
          linePath.setAttribute("stroke", "url(#" + String(initialState.gradientId) + ")");
          linePath.setAttribute("stroke-width", String(initialState.strokeWidth ?? 3));
          linePath.setAttribute("stroke-linecap", String(initialState.strokeLinecap || "round"));
          linePath.setAttribute("stroke-linejoin", String(initialState.strokeLinecap || "round"));
          linePath.style.opacity = String(initialState.opacity ?? 1);
          linePath.style.filter = String(initialState.filter || "none");
          svg.appendChild(linePath);

          track.appendChild(svg);

          return {
            svg,
            gradient,
            linePath,
            areaPath,
            baseline: initialState.baseline || "bottom"
          };
        }

        function buildEqualizerLineGeometry(values, baseline) {
          const safeValues = Array.isArray(values) && values.length > 0 ? values : [0];
          const points = safeValues.map((rawValue, index) => {
            const amplitude = Math.max(0, Math.min(1, Number(rawValue) || 0));
            const progress = safeValues.length <= 1 ? 0.5 : index / (safeValues.length - 1);

            switch (baseline) {
              case "top":
                return { x: progress * 100, y: amplitude * 100 };
              case "left":
                return { x: amplitude * 100, y: progress * 100 };
              case "right":
                return { x: 100 - amplitude * 100, y: progress * 100 };
              case "center-horizontal":
                return { x: progress * 100, y: 50 - amplitude * 50 };
              case "center-vertical":
                return { x: 50 + amplitude * 50, y: progress * 100 };
              case "bottom":
              default:
                return { x: progress * 100, y: 100 - amplitude * 100 };
            }
          });

          const linePath = points
            .map((point, index) =>
              (index === 0 ? "M " : "L ") + point.x.toFixed(3) + " " + point.y.toFixed(3)
            )
            .join(" ");

          const firstPoint = points[0];
          const lastPoint = points[points.length - 1];
          let areaPath = linePath;

          switch (baseline) {
            case "top":
              areaPath += " L " + lastPoint.x.toFixed(3) + " 0 L " + firstPoint.x.toFixed(3) + " 0 Z";
              break;
            case "left":
              areaPath += " L 0 " + lastPoint.y.toFixed(3) + " L 0 " + firstPoint.y.toFixed(3) + " Z";
              break;
            case "right":
              areaPath += " L 100 " + lastPoint.y.toFixed(3) + " L 100 " + firstPoint.y.toFixed(3) + " Z";
              break;
            case "center-horizontal":
              areaPath += " L " + lastPoint.x.toFixed(3) + " 50 L " + firstPoint.x.toFixed(3) + " 50 Z";
              break;
            case "center-vertical":
              areaPath += " L 50 " + lastPoint.y.toFixed(3) + " L 50 " + firstPoint.y.toFixed(3) + " Z";
              break;
            case "bottom":
            default:
              areaPath += " L " + lastPoint.x.toFixed(3) + " 100 L " + firstPoint.x.toFixed(3) + " 100 Z";
              break;
          }

          return { linePath, areaPath };
        }

        function updateEqualizerLineGradient(gradient, colors) {
          gradient.textContent = "";
          const safeColors = Array.isArray(colors) && colors.length > 0 ? colors : ["#ffffff"];

          for (let index = 0; index < safeColors.length; index += 1) {
            const stop = document.createElementNS("http://www.w3.org/2000/svg", "stop");
            const offset = safeColors.length <= 1 ? 0 : (index / (safeColors.length - 1)) * 100;
            stop.setAttribute("offset", String(offset) + "%");
            stop.setAttribute("stop-color", String(safeColors[index]));
            gradient.appendChild(stop);
          }
        }

        function applyEqualizerLineState(handle, state) {
          const geometry = buildEqualizerLineGeometry(state.values, state.baseline || handle.baseline || "bottom");
          updateEqualizerLineGradient(handle.gradient, state.colors);
          handle.linePath.setAttribute("d", geometry.linePath);
          if (handle.areaPath) {
            handle.areaPath.setAttribute("d", geometry.areaPath);
          }
        }

        // ────────────────────────────────────────────────────────────────
        // Live-DOM runtime registry.
        //
        // Each browser runtime exposes mount(layer, initialState) which
        // returns a handle, and update(handle, state) which applies a new
        // per-frame state to the mounted DOM. Runtimes are keyed by
        // runtimeId and looked up in the registry below.
        //
        // Per-frame readiness contract:
        //   Components that need asynchronous DOM work to settle before
        //   capture participate implicitly via internal frame state.
        //   Video frame sequences return:
        //
        //     state.__imageFrameSync = { src: string, label?: string }
        //
        //   The wrapper updates owned <img data-video-frame> elements and
        //   registers a readiness task until load/decode settles.
        //
        //   The contract is deliberately component-agnostic: any async
        //   task can register itself on __frameReadiness, and future
        //   features beyond video seeks will reuse the same gate.
        //
        //   The public scene-component and render-prop interfaces remain
        //   unchanged — runtimes participate purely by returning state in
        //   the appropriate shape from getFrameState.
        // ────────────────────────────────────────────────────────────────
        const runtimeRegistry = {
          "background-image": {
            mount(layer, initialState) {
              if (!initialState || !initialState.imageUrl) {
                return null;
              }

              const image = document.createElement("img");
              image.src = initialState.imageUrl;
              image.alt = "";
              applyStyles(image, {
                position: "absolute",
                inset: "0",
                width: "100%",
                height: "100%",
                objectFit: "cover",
                transform: "scale(1.03)",
                contain: "paint"
              });
              layer.appendChild(image);
              return { image };
            },
            update() {}
          },
          "background-color": {
            mount(layer, initialState) {
              const gradient = document.createElement("div");
              applyStyles(gradient, {
                position: "absolute",
                inset: "0",
                background: initialState && initialState.background ? initialState.background : "transparent",
                contain: "paint"
              });
              layer.appendChild(gradient);
              return { gradient };
            },
            update() {}
          },
          // Generic runtime used by Shape, Static Text, Image, and Video
          // components: injects a prebuilt HTML fragment into an absolutely
          // positioned container, then per-frame updates only opacity (and
          // any auxiliary state the component returns). This avoids
          // duplicating shape/text/image rendering logic inside the page
          // shell — the Node side assembles markup via a builder, and the
          // browser runtime just mounts and toggles visibility.
          "static-fx-layer": {
            mount(layer, initialState) {
              const container = document.createElement("div");
              if (initialState && initialState.containerStyle) {
                applyStyles(container, initialState.containerStyle);
              }
              if (initialState && typeof initialState.html === "string") {
                container.innerHTML = initialState.html;
              }
              if (initialState && typeof initialState.initialOpacity === "number") {
                container.style.opacity = String(initialState.initialOpacity);
              }
              layer.appendChild(container);
              return { container };
            },
            update(handle, state) {
              if (!handle || !handle.container || !state) {
                return;
              }
              if (typeof state.opacity === "number") {
                handle.container.style.opacity = String(state.opacity);
              }
            }
          },
          "lyrics-by-line": {
              mount(layer, initialState) {
                const wrapper = document.createElement("div");
                if (initialState && initialState.containerStyle) {
                  applyStyles(wrapper, initialState.containerStyle);
                }
                applyStyles(wrapper, {
                  display: "flex",
                  justifyContent: "center",
                  boxSizing: "border-box",
                  contain: "layout style",
                  alignItems: initialState.alignItems,
                  padding: initialState.padding,
                  color: initialState.color,
                  fontFamily: initialState.fontFamily
                });

                const text = document.createElement("div");
                applyStyles(text, {
                  display: "inline-block",
                  maxWidth: "100%",
                  textAlign: "center",
                  fontWeight: "700",
                  lineHeight: "1.15",
                  letterSpacing: "-0.03em",
                  whiteSpace: initialState.whiteSpace,
                  willChange: "opacity",
                  contain: "layout style",
                  opacity: "0"
                });

              wrapper.appendChild(text);
              layer.appendChild(wrapper);
              return { wrapper, text };
            },
            update(handle, state) {
              if (!handle) {
                return;
              }

              if (typeof state.text === "string" && handle.text.textContent !== state.text) {
                handle.text.textContent = state.text;
              }

                if (state.fontSize !== undefined) {
                  handle.text.style.fontSize = String(state.fontSize) + "px";
                }

                handle.text.style.padding = state.padding ? String(state.padding) : "0px";
                handle.text.style.textShadow = state.textShadow ? String(state.textShadow) : "none";
                handle.text.style.webkitTextStroke = state.webkitTextStroke ? String(state.webkitTextStroke) : "";
                handle.text.style.opacity = String(state.opacity ?? 0);
              }
          },
          "equalizer": {
            mount(layer, initialState) {
              const wrapper = document.createElement("div");
              applyStyles(wrapper, initialState.wrapperStyle);
              wrapper.style.pointerEvents = "none";
              layer.appendChild(wrapper);

              if (initialState.plateStyle) {
                const plate = document.createElement("div");
                plate.dataset.equalizerPlate = "";
                applyStyles(plate, initialState.plateStyle);
                wrapper.appendChild(plate);
              }

              const track = document.createElement("div");
              track.dataset.equalizerTrack = "";
              applyStyles(track, initialState.trackStyle);
              wrapper.appendChild(track);

              const handle = {
                wrapper,
                track,
                graphMode: initialState.graphMode || "bars",
                barDescriptors: [],
                lineDescriptor: null
              };

              if (initialState.graphMode === "line") {
                handle.lineDescriptor = createEqualizerLineDescriptor(initialState, track);
                applyEqualizerLineState(handle.lineDescriptor, {
                  values: initialState.values,
                  colors: initialState.colors,
                  baseline: initialState.baseline
                });
              } else {
                for (const entry of initialState.entries) {
                  const descriptor = createEqualizerBarDescriptor(handle, entry, initialState, track);
                  if (descriptor && entry.type === "bar") {
                    applyEqualizerValue(descriptor, entry.value, entry.color);
                  }
                }
              }

              return handle;
            },
            update(handle, state) {
              if (!handle || !state || !Array.isArray(state.values)) {
                return;
              }

              if (handle.graphMode === "line") {
                if (handle.lineDescriptor) {
                  applyEqualizerLineState(handle.lineDescriptor, state);
                }
                return;
              }

              for (let index = 0; index < handle.barDescriptors.length; index += 1) {
                applyEqualizerValue(
                  handle.barDescriptors[index],
                  state.values[index] ?? 0,
                  state.colors?.[index]
                );
              }
            }
          }
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
