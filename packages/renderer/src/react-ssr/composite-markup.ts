import { createElement, type ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type {
  PreparedSceneStackData,
  RenderJob,
  SceneAssetAccessor,
  SceneComponentDefinition,
  ValidatedSceneComponentInstance,
  createLyricRuntime
} from "@lyric-video-maker/core";

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

export function renderFrameMarkup(markup: ReactElement): string {
  return renderToStaticMarkup(markup);
}
