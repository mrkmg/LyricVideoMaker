import { describe, expect, it } from "vitest";
import type {
  SceneBrowserFrameStateContext,
  SceneBrowserInitialStateContext,
  SceneBrowserRuntimeDefinition,
  SceneComponentDefinition,
  SceneRenderProps
} from "@lyric-video-maker/core";

/**
 * Public scene-component definition
 * interface and the public render-prop interface must have the SAME shape
 * remains unchanged by internal frame-readiness state.
 *
 * Strategy: pin the keys of each interface with compile-time type guards
 * plus a runtime shape check against a declared reference. If a future
 * change adds or removes a public key, this file fails to type-check.
 * No fields related to "video" or "readiness" should leak into the public
 * contract — those live in the live-DOM runtime (live-dom.ts) internals.
 */

describe("frame-sync does not alter public scene-component interface (T-046)", () => {
  it("SceneComponentDefinition keys are exactly the pre-kit set", () => {
    // Declare a full definition so any missing required key breaks the type.
    const def: SceneComponentDefinition<Record<string, unknown>> = {
      id: "x",
      name: "X",
      description: undefined,
      staticWhenMarkupUnchanged: undefined,
      options: [],
      defaultOptions: {},
      validate: undefined,
      getPrepareCacheKey: undefined,
      prepare: undefined,
      browserRuntime: undefined,
      Component: () => null
    };
    const keys = Object.keys(def).sort();
    expect(keys).toEqual(
      [
        "id",
        "name",
        "description",
        "staticWhenMarkupUnchanged",
        "options",
        "defaultOptions",
        "validate",
        "getPrepareCacheKey",
        "prepare",
        "browserRuntime",
        "Component"
      ].sort()
    );
  });

  it("SceneRenderProps keys are exactly the pre-kit set", () => {
    const props: SceneRenderProps<Record<string, unknown>> = {
      instance: {
        id: "i",
        componentId: "x",
        componentName: "X",
        enabled: true,
        options: {}
      },
      options: {},
      frame: 0,
      timeMs: 0,
      video: { width: 0, height: 0, fps: 0, durationMs: 0, durationInFrames: 0 },
      lyrics: { current: null, next: null, all: [] },
      assets: { getUrl: () => null },
      prepared: {}
    };
    const keys = Object.keys(props).sort();
    expect(keys).toEqual(
      ["instance", "options", "frame", "timeMs", "video", "lyrics", "assets", "prepared"].sort()
    );
  });

  it("SceneBrowserRuntimeDefinition surface is unchanged (runtimeId/getInitialState/getFrameState)", () => {
    const runtime: SceneBrowserRuntimeDefinition<Record<string, unknown>> = {
      runtimeId: "x",
      getInitialState: (_ctx: SceneBrowserInitialStateContext<Record<string, unknown>>) => null,
      getFrameState: (_ctx: SceneBrowserFrameStateContext<Record<string, unknown>>) => null
    };
    expect(Object.keys(runtime).sort()).toEqual(
      ["runtimeId", "getInitialState", "getFrameState"].sort()
    );
  });
});
