import { writeFile, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type {
  RenderJob,
  SceneComponentDefinition,
  ValidatedSceneComponentInstance
} from "@lyric-video-maker/core";
import { preloadSceneAssets } from "../src/assets/preload";
import type { RenderLogger } from "../src/types";

const logger: RenderLogger = { info: () => {}, warn: () => {}, error: () => {} };

const video: RenderJob["video"] = {
  width: 640,
  height: 360,
  fps: 30,
  durationMs: 5000,
  durationInFrames: 150
};

let tempDir: string;
let videoPath: string;

const videoComponent: SceneComponentDefinition<Record<string, unknown>> = {
  id: "video-preload-under-test",
  name: "Video Preload Under Test",
  options: [
    {
      type: "category",
      id: "source",
      label: "Source",
      options: [{ type: "video", id: "clip", label: "Clip", required: true }]
    },
    { type: "text", id: "note", label: "Note" }
  ],
  defaultOptions: {},
  Component: () => null
};

beforeAll(async () => {
  tempDir = await mkdtemp(join(tmpdir(), "preload-video-"));
  videoPath = join(tempDir, "clip.mp4");
  await writeFile(videoPath, Buffer.from([1, 2, 3, 4, 5]));
});

afterAll(async () => {
  await rm(tempDir, { recursive: true, force: true });
});

function instance(path: string): ValidatedSceneComponentInstance {
  return {
    id: "vid-1",
    componentId: "video-preload-under-test",
    componentName: "Video Preload Under Test",
    enabled: true,
    options: { clip: path, note: "hello" }
  };
}

describe("preloadSceneAssets — video field support (T-011)", () => {
  it("preloads video fields into the asset cache with content-type", async () => {
    const lookup = new Map([["video-preload-under-test", videoComponent]]);
    const assets = await preloadSceneAssets([instance(videoPath)], lookup, video, logger);
    expect(assets.size).toBe(1);
    const asset = assets.get("vid-1:clip");
    expect(asset).toBeDefined();
    expect(asset!.contentType).toBe("video/mp4");
    expect(asset!.body.equals(Buffer.from([1, 2, 3, 4, 5]))).toBe(true);
  });

  it("iterates category-nested fields to find videos", async () => {
    // The video field is declared inside a category — this test confirms
    // the preload loop flattens categories before looking for asset kinds.
    const lookup = new Map([["video-preload-under-test", videoComponent]]);
    const assets = await preloadSceneAssets([instance(videoPath)], lookup, video, logger);
    expect(assets.get("vid-1:clip")).toBeDefined();
  });

  it("skips non-asset fields (text, number, etc)", async () => {
    const lookup = new Map([["video-preload-under-test", videoComponent]]);
    const assets = await preloadSceneAssets([instance(videoPath)], lookup, video, logger);
    expect(assets.get("vid-1:note")).toBeUndefined();
  });
});
