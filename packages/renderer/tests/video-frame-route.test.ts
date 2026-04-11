import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Route } from "playwright";
import { fulfillVideoFrameRoute } from "../src/browser/asset-routes";
import { VIDEO_FRAME_URL_PREFIX } from "../src/constants";
import type { VideoFrameExtractionEntry } from "../src/video-frame-extraction";

const logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
const tempDirs: string[] = [];

afterEach(async () => {
  await Promise.allSettled(tempDirs.map((dir) => rm(dir, { recursive: true, force: true })));
  tempDirs.length = 0;
  vi.clearAllMocks();
});

function makeRoute(url: string, fulfill: (args: Record<string, unknown>) => void): Route {
  return {
    request: () => ({ url: () => url, headers: () => ({}) }),
    fulfill: async (args: unknown) => fulfill(args as Record<string, unknown>)
  } as unknown as Route;
}

describe("video frame route", () => {
  it("serves registered JPEG frame files by extraction id and frame name", async () => {
    const tempDir = await mkdtemp(join(tmpdir(), "video-frame-route-"));
    tempDirs.push(tempDir);
    await writeFile(join(tempDir, "frame-00000001.jpg"), Buffer.from([1, 2, 3]));
    const entry: VideoFrameExtractionEntry = {
      instanceId: "video-1",
      extractionId: "extract-a",
      tempDir,
      frameCount: 1,
      outputFps: 30
    };
    let captured: Record<string, unknown> = {};

    await fulfillVideoFrameRoute(
      makeRoute(`${VIDEO_FRAME_URL_PREFIX}extract-a/frame-00000001.jpg`, (args) => {
        captured = args;
      }),
      [entry],
      logger
    );

    expect(captured.status).toBe(200);
    expect(captured.path).toBe(join(tempDir, "frame-00000001.jpg"));
    expect((captured.headers as Record<string, string>)["Content-Type"]).toBe("image/jpeg");
  });

  it("rejects unknown ids, out-of-range frames, and traversal attempts", async () => {
    const entry: VideoFrameExtractionEntry = {
      instanceId: "video-1",
      extractionId: "extract-a",
      tempDir: "C:/tmp/extract-a",
      frameCount: 1,
      outputFps: 30
    };
    for (const url of [
      `${VIDEO_FRAME_URL_PREFIX}missing/frame-00000001.jpg`,
      `${VIDEO_FRAME_URL_PREFIX}extract-a/frame-00000002.jpg`,
      `${VIDEO_FRAME_URL_PREFIX}extract-a/..%2Fsecret.jpg`
    ]) {
      let status = 0;
      await fulfillVideoFrameRoute(
        makeRoute(url, (args) => {
          status = args.status as number;
        }),
        [entry],
        logger
      );
      expect(status).toBe(404);
    }
  });
});
