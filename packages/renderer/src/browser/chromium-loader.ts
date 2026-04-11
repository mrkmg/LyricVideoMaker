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
