import { readFile } from "node:fs/promises";
import type { RenderJob } from "@lyric-video-maker/core";
import { runBinaryCommand } from "../ffmpeg/run-command";
import type { CachedAssetBody, PreviewAssetCache, RenderLogger } from "../types";
import { getMimeType } from "./mime";

/**
 * Asset kinds the cache understands. The cache-key format is stable across
 * kinds so the same path-plus-dimensions key is reused whether the asset is
 * an image (which goes through ffmpeg normalization) or a video (which is
 * read from disk as-is and served with its detected MIME type).
 */
export type CachedAssetKind = "image" | "video";

export async function loadCachedAssetBody(
  path: string,
  video: RenderJob["video"],
  signal: AbortSignal | undefined,
  logger: RenderLogger,
  assetCache?: PreviewAssetCache,
  kind: CachedAssetKind = "image"
): Promise<CachedAssetBody> {
  const cacheKey = `${path}::${video.width}x${video.height}`;
  if (!assetCache) {
    return await createCachedAssetBody(path, video, signal, logger, kind);
  }

  const cached = assetCache.get(cacheKey);
  if (cached) {
    return await cached;
  }

  const pending = createCachedAssetBody(path, video, signal, logger, kind).catch((error) => {
    assetCache.delete(cacheKey);
    throw error;
  });
  assetCache.set(cacheKey, pending);
  return await pending;
}

export async function createCachedAssetBody(
  path: string,
  video: RenderJob["video"],
  signal: AbortSignal | undefined,
  logger: RenderLogger,
  kind: CachedAssetKind = "image"
): Promise<CachedAssetBody> {
  if (kind === "video") {
    // Video bodies are served straight from disk without normalization. The
    // content-type is taken from MIME detection so the headless browser can
    // play the response via a <video> element.
    return {
      body: await readFile(path),
      contentType: getMimeType(path),
      normalized: false
    };
  }

  const normalizedBody = await normalizeImageAsset(path, video, signal, logger);
  if (normalizedBody) {
    return {
      body: normalizedBody,
      contentType: "image/png",
      normalized: true
    };
  }

  return {
    body: await readFile(path),
    contentType: getMimeType(path),
    normalized: false
  };
}

export async function normalizeImageAsset(
  path: string,
  video: RenderJob["video"],
  signal: AbortSignal | undefined,
  logger: RenderLogger
): Promise<Buffer | null> {
  try {
    return await runBinaryCommand(
      "ffmpeg",
      [
        "-v",
        "error",
        "-i",
        path,
        "-vf",
        `scale=${video.width}:${video.height}:force_original_aspect_ratio=increase,crop=${video.width}:${video.height}`,
        "-frames:v",
        "1",
        "-f",
        "image2pipe",
        "-vcodec",
        "png",
        "-"
      ],
      signal
    );
  } catch (error) {
    logger.warn(
      `Image normalization failed for ${path}; falling back to original asset. ${error instanceof Error ? error.message : String(error)}`
    );
    return null;
  }
}
