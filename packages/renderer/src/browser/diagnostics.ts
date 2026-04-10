import type { Page } from "playwright";
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
    logger.warn(`Request failed: ${request.url()}${request.failure()?.errorText ? ` (${request.failure()?.errorText})` : ""}`);
  });
}
