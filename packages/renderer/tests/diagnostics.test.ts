import { describe, expect, it } from "vitest";
import { ASSET_URL_PREFIX } from "../src/constants";
import { isBenignAbortedVideoAssetRequest } from "../src/browser/diagnostics";

describe("browser diagnostics", () => {
  it("suppresses Chromium-aborted local video asset requests", () => {
    expect(
      isBenignAbortedVideoAssetRequest(
        `${ASSET_URL_PREFIX}video-1-source.mp4`,
        "net::ERR_ABORTED"
      )
    ).toBe(true);
  });

  it("keeps non-aborted video failures visible", () => {
    expect(
      isBenignAbortedVideoAssetRequest(
        `${ASSET_URL_PREFIX}video-1-source.mp4`,
        "net::ERR_FAILED"
      )
    ).toBe(false);
  });

  it("keeps image aborts visible", () => {
    expect(
      isBenignAbortedVideoAssetRequest(
        `${ASSET_URL_PREFIX}background-image-source.png`,
        "net::ERR_ABORTED"
      )
    ).toBe(false);
  });
});
