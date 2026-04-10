import { existsSync } from "node:fs";
import { join } from "node:path";

export async function loadChromium() {
  if (!process.env.PLAYWRIGHT_BROWSERS_PATH) {
    const localBrowsersPath = process.resourcesPath
      ? join(process.resourcesPath, "app", "node_modules", "playwright-core", ".local-browsers")
      : null;
    if (localBrowsersPath && existsSync(localBrowsersPath)) {
      process.env.PLAYWRIGHT_BROWSERS_PATH = "0";
    }
  }

  return (await import("playwright")).chromium;
}

export function shouldUseBeginFrame() {
  return process.env.LYRIC_VIDEO_RENDER_USE_BEGIN_FRAME !== "0";
}

export function getBeginFrameLaunchArgs(preferBeginFrame: boolean) {
  if (!preferBeginFrame) {
    return [];
  }

  return [
    "--enable-surface-synchronization",
    "--run-all-compositor-stages-before-draw",
    "--disable-threaded-animation",
    "--disable-threaded-scrolling",
    "--disable-checker-imaging"
  ];
}
