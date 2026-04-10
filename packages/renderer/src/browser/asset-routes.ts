import type { Page, Route } from "playwright";
import { ASSET_URL_PREFIX } from "../constants";
import type { PreloadedAsset, RenderLogger } from "../types";

export async function registerAssetRoutes(
  page: Page,
  assets: Map<string, PreloadedAsset>,
  logger: RenderLogger
) {
  await page.route(`${ASSET_URL_PREFIX}**`, async (route) => {
    await fulfillAssetRoute(route, assets, logger);
  });
}

export async function fulfillAssetRoute(
  route: Route,
  assets: Map<string, PreloadedAsset>,
  logger: RenderLogger
) {
  const url = route.request().url();
  const asset = [...assets.values()].find((candidate) => candidate.url === url);

  if (!asset) {
    logger.warn(`Asset request had no registered payload: ${url}`);
    await route.fulfill({
      status: 404,
      body: "Not found",
      headers: {
        "Content-Type": "text/plain"
      }
    });
    return;
  }

  await route.fulfill({
    status: 200,
    body: asset.body,
    headers: {
      "Content-Type": asset.contentType,
      "Cache-Control": "public, max-age=31536000, immutable"
    }
  });
}
