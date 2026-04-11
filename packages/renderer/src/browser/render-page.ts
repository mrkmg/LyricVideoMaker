import type { Browser, BrowserContext, Page } from "playwright";

export async function createRenderPage({
  browser,
  width,
  height
}: {
  browser: Browser;
  width: number;
  height: number;
}): Promise<{ context: BrowserContext; page: Page }> {
  const context = await browser.newContext({
    viewport: {
      width,
      height
    },
    deviceScaleFactor: 1
  });

  const page = await context.newPage();
  return { context, page };
}
