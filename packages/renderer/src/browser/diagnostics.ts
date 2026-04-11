import type { Page } from "playwright";
import { ASSET_URL_PREFIX } from "../constants";
import type { RenderLogger } from "../types";

export function wirePageDiagnostics(page: Page, logger: RenderLogger) {
  page.on("console", (msg) => {
    if (msg.type() === "error" || msg.type() === "warning") {
      const log = msg.text().trim();
      if (log) {
        if (msg.type() === "error") {
          logger.error(`Browser console: ${log}`);
        } else {
          logger.warn(`Browser console: ${log}`);
        }
      }
    }
  });

  page.on("pageerror", (error) => {
    logger.error(`Page error: ${error.message}`);
  });

  page.on("requestfailed", (request) => {
    const url = request.url();
    const errorText = request.failure()?.errorText;
    if (isBenignAbortedVideoAssetRequest(url, errorText)) {
      return;
    }

    logger.warn(`Request failed: ${url}${errorText ? ` (${errorText})` : ""}`);
  });
}

export function isBenignAbortedVideoAssetRequest(
  url: string,
  errorText: string | undefined | null
) {
  if (errorText !== "net::ERR_ABORTED" || !url.startsWith(ASSET_URL_PREFIX)) {
    return false;
  }

  const lowerUrl = url.toLowerCase();
  return (
    lowerUrl.endsWith(".mp4") ||
    lowerUrl.endsWith(".webm") ||
    lowerUrl.endsWith(".mov") ||
    lowerUrl.endsWith(".mkv")
  );
}
