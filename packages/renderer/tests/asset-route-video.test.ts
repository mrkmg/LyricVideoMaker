import { describe, expect, it, vi } from "vitest";
import type { Route } from "playwright";
import { fulfillAssetRoute } from "../src/browser/asset-routes";
import type { PreloadedAsset, RenderLogger } from "../src/types";

const logger: RenderLogger = { info: () => {}, warn: () => {}, error: () => {} };

function makeRoute(
  url: string,
  fulfill: (args: unknown) => void,
  headers: Record<string, string> = {}
): Route {
  return {
    request: () => ({ url: () => url, headers: () => headers }),
    fulfill: async (args: unknown) => fulfill(args)
  } as unknown as Route;
}

describe("asset route serves video bodies with content-type (T-012)", () => {
  it("fulfills a preloaded video asset with its detected content-type", async () => {
    const asset: PreloadedAsset = {
      instanceId: "v1",
      optionId: "clip",
      path: "/tmp/clip.mp4",
      url: "https://asset.lyric-video/v1-clip.mp4",
      contentType: "video/mp4",
      body: Buffer.from([0, 1, 2, 3, 4])
    };
    const assets = new Map([["v1:clip", asset]]);

    let captured: Record<string, unknown> = {};
    const route = makeRoute(asset.url, (args) => {
      captured = args as Record<string, unknown>;
    });
    await fulfillAssetRoute(route, assets, logger);

    expect(captured.status).toBe(200);
    const headers = captured.headers as Record<string, string>;
    expect(headers["Content-Type"]).toBe("video/mp4");
    expect(headers["Accept-Ranges"]).toBe("bytes");
    expect(captured.body).toBe(asset.body);
  });

  it("fulfills video byte-range requests with 206 partial content", async () => {
    const asset: PreloadedAsset = {
      instanceId: "v1",
      optionId: "clip",
      path: "/tmp/clip.mp4",
      url: "https://asset.lyric-video/v1-clip.mp4",
      contentType: "video/mp4",
      body: Buffer.from([0, 1, 2, 3, 4])
    };
    const assets = new Map([["v1:clip", asset]]);

    let captured: Record<string, unknown> = {};
    const route = makeRoute(
      asset.url,
      (args) => {
        captured = args as Record<string, unknown>;
      },
      { range: "bytes=1-3" }
    );
    await fulfillAssetRoute(route, assets, logger);

    expect(captured.status).toBe(206);
    expect(captured.body).toEqual(Buffer.from([1, 2, 3]));
    const headers = captured.headers as Record<string, string>;
    expect(headers["Content-Range"]).toBe("bytes 1-3/5");
    expect(headers["Accept-Ranges"]).toBe("bytes");
    expect(headers["Content-Length"]).toBe("3");
  });

  it("also serves webm/mov/mkv content-types without modification", async () => {
    const kinds = [
      { ext: "webm", mime: "video/webm" },
      { ext: "mov", mime: "video/quicktime" },
      { ext: "mkv", mime: "video/x-matroska" }
    ];
    for (const { ext, mime } of kinds) {
      const url = `https://asset.lyric-video/v2-clip.${ext}`;
      const asset: PreloadedAsset = {
        instanceId: "v2",
        optionId: "clip",
        path: `/tmp/clip.${ext}`,
        url,
        contentType: mime,
        body: Buffer.from([5, 6, 7])
      };
      const assets = new Map([["v2:clip", asset]]);
      let captured: Record<string, unknown> = {};
      const route = makeRoute(url, (args) => {
        captured = args as Record<string, unknown>;
      });
      await fulfillAssetRoute(route, assets, logger);
      expect((captured.headers as Record<string, string>)["Content-Type"]).toBe(mime);
    }
  });

  it("image route behavior is unchanged", async () => {
    const asset: PreloadedAsset = {
      instanceId: "i1",
      optionId: "img",
      path: "/tmp/pic.png",
      url: "https://asset.lyric-video/i1-img.png",
      contentType: "image/png",
      body: Buffer.from([0xff])
    };
    const assets = new Map([["i1:img", asset]]);
    let captured: Record<string, unknown> = {};
    const route = makeRoute(asset.url, (args) => {
      captured = args as Record<string, unknown>;
    });
    await fulfillAssetRoute(route, assets, logger);
    expect((captured.headers as Record<string, string>)["Content-Type"]).toBe("image/png");
  });

  it("unknown asset returns 404", async () => {
    const warn = vi.fn();
    const route = makeRoute("https://asset.lyric-video/missing", () => {});
    let status: number | undefined;
    const r2 = makeRoute("https://asset.lyric-video/missing", (args) => {
      status = (args as { status: number }).status;
    });
    await fulfillAssetRoute(r2, new Map(), { ...logger, warn });
    expect(status).toBe(404);
    expect(warn).toHaveBeenCalled();
    void route;
  });
});
