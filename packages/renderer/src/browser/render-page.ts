import type { Browser, BrowserContext, Page } from "playwright";

export async function createRenderPage({
  browser,
  width,
  height,
  preferBeginFrame
}: {
  browser: Browser;
  width: number;
  height: number;
  preferBeginFrame: boolean;
}): Promise<{ context: BrowserContext; page: Page }> {
  const context = await browser.newContext({
    viewport: {
      width,
      height
    },
    deviceScaleFactor: 1
  });

  if (!preferBeginFrame) {
    const page = await context.newPage();
    return { context, page };
  }

  const browserSession = await browser.newBrowserCDPSession();

  try {
    const internalContext = (context as BrowserContext & {
      _connection?: { toImpl?: (object: unknown) => { _browserContextId?: string } };
    })._connection?.toImpl?.(context);
    const browserContextId = internalContext?._browserContextId;
    if (!browserContextId) {
      throw new Error("Playwright did not expose the Chromium browserContextId required for BeginFrameControl.");
    }

    const pagePromise = context.waitForEvent("page");
    await browserSession.send("Target.createTarget", {
      url: "about:blank",
      browserContextId,
      enableBeginFrameControl: true
    });
    const page = await pagePromise;
    return { context, page };
  } finally {
    await browserSession.detach();
  }
}
