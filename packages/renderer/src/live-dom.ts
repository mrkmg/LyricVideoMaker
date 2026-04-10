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
          const pendingImages = Array.from(root.querySelectorAll("img"));

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
          "lyrics-by-line": {
              mount(layer, initialState) {
                const wrapper = document.createElement("div");
                applyStyles(wrapper, {
                  position: "absolute",
                  inset: "0",
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
            root.appendChild(layer);
            const handle = runtime.mount(layer, component.initialState || {});
            mountedComponents.set(component.instanceId, { runtime, handle });
          }

          const warnings = await waitForAssets(root);
          return { warnings };
        };

        window.__renderLiveDomFrame = async function renderLiveDomFrame(payload) {
          for (const component of payload.components) {
            const mounted = mountedComponents.get(component.instanceId);
            if (!mounted) {
              continue;
            }

            mounted.runtime.update(mounted.handle, component.state || {});
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
