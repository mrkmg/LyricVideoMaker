import type { CDPSession } from "playwright";

export async function captureFrameBuffer({
  cdpSession
}: {
  cdpSession: CDPSession;
}): Promise<Buffer> {
  const screenshot = await cdpSession.send("Page.captureScreenshot", {
    format: "png",
    fromSurface: true,
    captureBeyondViewport: false,
    optimizeForSpeed: true
  });

  return Buffer.from(screenshot.data, "base64");
}
