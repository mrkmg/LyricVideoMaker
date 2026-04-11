import { stat } from "node:fs/promises";
import { join } from "node:path";
import type { Page, Route } from "playwright";
import { ASSET_URL_PREFIX, VIDEO_FRAME_URL_PREFIX } from "../constants";
import type { PreloadedAsset, RenderLogger } from "../types";
import type { VideoFrameExtractionEntry } from "../video-frame-extraction";

/**
 * Asset route handler (cavekit-video-field-type R6 / T-012).
 *
 * The route fulfills preloaded asset bodies — both image and video — using
 * the content-type that was populated during preload. For images this is
 * either "image/png" (normalized) or the original MIME type. For videos
 * this is the MIME type detected from the file extension (video/mp4,
 * video/webm, video/quicktime, video/x-matroska).
 *
 * Video assets are legacy/test-only for this route. Built-in Video uses
 * extracted JPEG frames served by fulfillVideoFrameRoute below.
 */
export async function registerAssetRoutes(
  page: Page,
  assets: Map<string, PreloadedAsset>,
  logger: RenderLogger,
  videoFrameExtractions: VideoFrameExtractionEntry[] = []
) {
  await page.route(`${ASSET_URL_PREFIX}**`, async (route) => {
    await fulfillAssetRoute(route, assets, logger);
  });
  await page.route(`${VIDEO_FRAME_URL_PREFIX}**`, async (route) => {
    await fulfillVideoFrameRoute(route, videoFrameExtractions, logger);
  });
}

export async function fulfillAssetRoute(
  route: Route,
  assets: Map<string, PreloadedAsset>,
  logger: RenderLogger
) {
  const url = route.request().url();
  const asset = [...assets.values()].find((candidate) => candidate.url === url);

  if (!asset) {
    logger.warn(`Asset request had no registered payload: ${url}`);
    await route.fulfill({
      status: 404,
      body: "Not found",
      headers: {
        "Content-Type": "text/plain"
      }
    });
    return;
  }

  const request = route.request();
  const headers = typeof request.headers === "function" ? request.headers() : {};
  const rangeHeader = headers["range"];
  if (rangeHeader && asset.contentType.startsWith("video/")) {
    const range = parseByteRange(rangeHeader, asset.body.byteLength);
    if (!range) {
      await route.fulfill({
        status: 416,
        body: "",
        headers: {
          "Content-Range": `bytes */${asset.body.byteLength}`,
          "Accept-Ranges": "bytes"
        }
      });
      return;
    }

    const chunk = asset.body.subarray(range.start, range.end + 1);
    await route.fulfill({
      status: 206,
      body: chunk,
      headers: {
        "Content-Type": asset.contentType,
        "Content-Length": String(chunk.byteLength),
        "Content-Range": `bytes ${range.start}-${range.end}/${asset.body.byteLength}`,
        "Accept-Ranges": "bytes",
        "Cache-Control": "public, max-age=31536000, immutable"
      }
    });
    return;
  }

  await route.fulfill({
    status: 200,
    body: asset.body,
    headers: {
      "Content-Type": asset.contentType,
      "Content-Length": String(asset.body.byteLength),
      ...(asset.contentType.startsWith("video/") ? { "Accept-Ranges": "bytes" } : {}),
      "Cache-Control": "public, max-age=31536000, immutable"
    }
  });
}

export async function fulfillVideoFrameRoute(
  route: Route,
  entries: VideoFrameExtractionEntry[],
  logger: RenderLogger
) {
  const url = route.request().url();
  const resolved = resolveVideoFrameRequest(url, entries);
  const canServe = resolved ? await canServeVideoFrameRequest(url, entries) : false;
  if (!resolved || !canServe) {
    logger.warn(`Video frame request had no registered file: ${url}`);
    await route.fulfill({
      status: 404,
      body: "Not found",
      headers: {
        "Content-Type": "text/plain"
      }
    });
    return;
  }

  await route.fulfill({
    status: 200,
    path: resolved.path,
    headers: {
      "Content-Type": "image/jpeg",
      "Cache-Control": "public, max-age=31536000, immutable"
    }
  });
}

export async function canServeVideoFrameRequest(
  url: string,
  entries: VideoFrameExtractionEntry[]
) {
  const resolved = resolveVideoFrameRequest(url, entries);
  if (!resolved) {
    return false;
  }

  try {
    const result = await stat(resolved.path);
    return result.isFile();
  } catch {
    return false;
  }
}

function resolveVideoFrameRequest(
  url: string,
  entries: VideoFrameExtractionEntry[]
): { path: string } | null {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }

  const prefix = new URL(VIDEO_FRAME_URL_PREFIX);
  if (parsed.origin !== prefix.origin || !parsed.pathname.startsWith(prefix.pathname)) {
    return null;
  }

  const tail = parsed.pathname.slice(prefix.pathname.length);
  const parts = tail.split("/");
  if (parts.length !== 2) {
    return null;
  }

  const [encodedExtractionId, encodedFrameName] = parts;
  const extractionId = decodeUrlPathPart(encodedExtractionId);
  const frameName = decodeUrlPathPart(encodedFrameName);
  if (
    !extractionId ||
    !frameName ||
    !/^[a-zA-Z0-9_-]+$/.test(extractionId) ||
    !/^frame-\d{8}\.jpg$/.test(frameName)
  ) {
    return null;
  }

  const entry = entries.find((candidate) => candidate.extractionId === extractionId);
  if (!entry) {
    return null;
  }

  const match = /^frame-(\d{8})\.jpg$/.exec(frameName);
  const frameNumber = match ? Number(match[1]) : 0;
  if (!Number.isInteger(frameNumber) || frameNumber < 1 || frameNumber > entry.frameCount) {
    return null;
  }

  return {
    path: join(entry.tempDir, frameName)
  };
}

function decodeUrlPathPart(value: string) {
  try {
    return decodeURIComponent(value);
  } catch {
    return null;
  }
}

function parseByteRange(
  rangeHeader: string,
  size: number
): { start: number; end: number } | null {
  const match = /^bytes=(\d*)-(\d*)$/.exec(rangeHeader.trim());
  if (!match || size <= 0) {
    return null;
  }

  const [, rawStart, rawEnd] = match;
  if (!rawStart && !rawEnd) {
    return null;
  }

  if (!rawStart) {
    const suffixLength = Number(rawEnd);
    if (!Number.isInteger(suffixLength) || suffixLength <= 0) {
      return null;
    }
    const start = Math.max(size - suffixLength, 0);
    return { start, end: size - 1 };
  }

  const start = Number(rawStart);
  const end = rawEnd ? Number(rawEnd) : size - 1;
  if (
    !Number.isInteger(start) ||
    !Number.isInteger(end) ||
    start < 0 ||
    end < start ||
    start >= size
  ) {
    return null;
  }

  return {
    start,
    end: Math.min(end, size - 1)
  };
}
