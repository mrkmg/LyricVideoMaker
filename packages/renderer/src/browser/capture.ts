import type { CDPSession } from "playwright";
import type { RenderLogger } from "../types";

export async function captureFrameBuffer({
  cdpSession,
  fps,
  preferBeginFrame,
  logger,
  beginFrameFallbackLogged
}: {
  cdpSession: CDPSession;
  fps: number;
  preferBeginFrame: boolean;
  logger: RenderLogger;
  beginFrameFallbackLogged: boolean;
}): Promise<{ buffer: Buffer; beginFrameFallbackLogged: boolean }> {
  if (preferBeginFrame) {
    try {
      const frame = await cdpSession.send("HeadlessExperimental.beginFrame", {
        interval: 1000 / Math.max(fps, 1),
        noDisplayUpdates: false,
        screenshot: {
          format: "png",
          optimizeForSpeed: true
        }
      });

      if (frame?.screenshotData) {
        return {
          buffer: Buffer.from(frame.screenshotData, "base64"),
          beginFrameFallbackLogged
        };
      }
    } catch (error) {
      if (!beginFrameFallbackLogged) {
        logger.warn(
          `HeadlessExperimental.beginFrame failed; falling back to Page.captureScreenshot. ${error instanceof Error ? error.message : String(error)}`
        );
        beginFrameFallbackLogged = true;
      }
    }
  }

  const screenshot = await cdpSession.send("Page.captureScreenshot", {
    format: "png",
    fromSurface: true,
    captureBeyondViewport: false,
    optimizeForSpeed: true
  });

  return {
    buffer: Buffer.from(screenshot.data, "base64"),
    beginFrameFallbackLogged
  };
}
