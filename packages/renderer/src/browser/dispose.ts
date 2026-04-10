import type { Browser, BrowserContext, CDPSession, Page } from "playwright";
import { ASSET_URL_PREFIX } from "../constants";

export async function disposePreviewBrowserResources({
  page,
  cdpSession,
  browserContext,
  browser
}: {
  page: Page | null;
  cdpSession: CDPSession | null;
  browserContext: BrowserContext | null;
  browser: Browser | null;
}) {
  if (page) {
    await page.unroute(`${ASSET_URL_PREFIX}**`);
  }

  if (cdpSession) {
    await cdpSession.detach();
  }

  if (browserContext) {
    await browserContext.close();
  }

  if (browser) {
    await browser.close();
  }
}
