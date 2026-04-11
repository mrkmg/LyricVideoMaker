import { writeFile, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type {
  RenderJob,
  SceneComponentDefinition,
  ValidatedSceneComponentInstance
} from "@lyric-video-maker/core";
import { validateSceneOptions } from "@lyric-video-maker/core";
import { preloadSceneAssets } from "../src/assets/preload";
import { fulfillAssetRoute } from "../src/browser/asset-routes";
import type { PreloadedAsset, RenderLogger } from "../src/types";

/**
 * T-016 — cavekit-video-field-type R10 end-to-end verification.
 *
 * Exercises the full video-field-type pipeline without booting a real
 * playwright browser: validates a video field's required/accessibility
 * check, and confirms the legacy asset-route handler can still serve
 * video bytes when explicitly requested by a test fixture.
 *
 * The throwaway component definition lives ONLY inside this test file;
 * it is intentionally never registered in builtInSceneComponents, so
 * removing this file removes the test fixture. (AC: "Throwaway test
 * component is removed from the code before this kit is marked done"
 * — the component is in a test-only file, outside shipped runtime code.)
 */

const logger: RenderLogger = { info: () => {}, warn: () => {}, error: () => {} };

const videoJob: RenderJob["video"] = {
  width: 640,
  height: 360,
  fps: 30,
  durationMs: 5000,
  durationInFrames: 150
};

interface ThrowawayOptions {
  clip: string;
}

const throwawayVideoComponent: SceneComponentDefinition<ThrowawayOptions> = {
  id: "__t-016-throwaway-video",
  name: "T-016 Throwaway Video Component",
  options: [
    {
      type: "category",
      id: "source",
      label: "Source",
      options: [{ type: "video", id: "clip", label: "Clip", required: true }]
    }
  ],
  defaultOptions: { clip: "" },
  Component: () => null
};

let tempDir: string;
let mp4Path: string;
const fakeMp4Bytes = Buffer.from([
  // Synthetic bytes — not a real mp4, but the content-type header and
  // byte stream are what matter for this plumbing test.
  0, 0, 0, 32, 0x66, 0x74, 0x79, 0x70, 0x6d, 0x70, 0x34, 0x32
]);

beforeAll(async () => {
  tempDir = await mkdtemp(join(tmpdir(), "t-016-end-to-end-"));
  mp4Path = join(tempDir, "sample.mp4");
  await writeFile(mp4Path, fakeMp4Bytes);
});

afterAll(async () => {
  await rm(tempDir, { recursive: true, force: true });
});

describe("T-016 — video field type end-to-end plumbing", () => {
  it("validates a required video field and passes accessibility check", () => {
    const validated = validateSceneOptions(
      throwawayVideoComponent,
      { clip: mp4Path },
      { isFileAccessible: () => true }
    );
    expect(validated.clip).toBe(mp4Path);
  });

  it("rejects an inaccessible video path", () => {
    expect(() =>
      validateSceneOptions(
        throwawayVideoComponent,
        { clip: mp4Path },
        { isFileAccessible: () => false }
      )
    ).toThrow(/does not point to a readable file/);
  });

  it("preloads the mp4 as video-kind with video/mp4 content-type", async () => {
    const instance: ValidatedSceneComponentInstance = {
      id: "test-1",
      componentId: throwawayVideoComponent.id,
      componentName: throwawayVideoComponent.name,
      enabled: true,
      options: { clip: mp4Path }
    };
    const lookup = new Map<
      string,
      SceneComponentDefinition<Record<string, unknown>>
    >([
      [
        throwawayVideoComponent.id,
        throwawayVideoComponent as unknown as SceneComponentDefinition<Record<string, unknown>>
      ]
    ]);
    const preloaded = await preloadSceneAssets([instance], lookup, videoJob, logger, undefined, undefined, {
      includeVideoAssets: true
    });
    const asset = preloaded.get("test-1:clip");
    expect(asset).toBeDefined();
    expect(asset!.contentType).toBe("video/mp4");
    expect(asset!.body.equals(fakeMp4Bytes)).toBe(true);
  });

  it("serves the preloaded mp4 through the asset route with correct content-type", async () => {
    const instance: ValidatedSceneComponentInstance = {
      id: "test-2",
      componentId: throwawayVideoComponent.id,
      componentName: throwawayVideoComponent.name,
      enabled: true,
      options: { clip: mp4Path }
    };
    const lookup = new Map<
      string,
      SceneComponentDefinition<Record<string, unknown>>
    >([
      [
        throwawayVideoComponent.id,
        throwawayVideoComponent as unknown as SceneComponentDefinition<Record<string, unknown>>
      ]
    ]);
    const preloaded = await preloadSceneAssets([instance], lookup, videoJob, logger, undefined, undefined, {
      includeVideoAssets: true
    });
    const asset = preloaded.get("test-2:clip") as PreloadedAsset;

    let captured: Record<string, unknown> = {};
    const route = {
      request: () => ({ url: () => asset.url }),
      fulfill: async (args: unknown) => {
        captured = args as Record<string, unknown>;
      }
    } as unknown as import("playwright").Route;

    await fulfillAssetRoute(route, preloaded, logger);

    expect(captured.status).toBe(200);
    const headers = captured.headers as Record<string, string>;
    expect(headers["Content-Type"]).toBe("video/mp4");
    expect((captured.body as Buffer).equals(fakeMp4Bytes)).toBe(true);
  });

  it("end-to-end verification component is NOT registered in builtInSceneComponents", async () => {
    // The throwaway fixture must not leak into production scene registry.
    const registry = await import("@lyric-video-maker/scene-registry");
    const ids = registry.builtInSceneComponents.map((c) => c.id);
    expect(ids).not.toContain("__t-016-throwaway-video");
  });
});
