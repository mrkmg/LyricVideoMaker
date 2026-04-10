import { measureNaturalWidth, prepareWithSegments } from "@chenglou/pretext";
import { lyricMeasurementCache, setCachedValue } from "./caches";
import { LYRIC_FONT_WEIGHT, LYRIC_LETTER_SPACING_EM } from "./types";

export function measureSingleLineWidth(text: string, fontFamily: string, fontSize: number) {
  const cacheKey = `${fontFamily}:${fontSize}:${text}`;
  const cached = lyricMeasurementCache.get(cacheKey);
  if (cached !== undefined) {
    return cached;
  }

  const measuredWidth = measureSingleLineWidthUncached(text, fontFamily, fontSize);
  setCachedValue(lyricMeasurementCache, cacheKey, measuredWidth);
  return measuredWidth;
}

export function measureSingleLineWidthUncached(text: string, fontFamily: string, fontSize: number) {
  if (!canUsePretextMeasurement()) {
    return estimateSingleLineWidth(text, fontSize);
  }

  try {
    const prepared = prepareWithSegments(text, getMeasurementFont(fontFamily, fontSize));
    const naturalWidth = measureNaturalWidth(prepared);
    return naturalWidth + getLetterSpacingWidth(text, fontSize);
  } catch {
    return estimateSingleLineWidth(text, fontSize);
  }
}

export function getMeasurementFont(fontFamily: string, fontSize: number) {
  return `${LYRIC_FONT_WEIGHT} ${fontSize}px "${fontFamily}"`;
}

export function getLetterSpacingWidth(text: string, fontSize: number) {
  const graphemeCount = Array.from(text).length;
  if (graphemeCount <= 1) {
    return 0;
  }

  return (graphemeCount - 1) * fontSize * LYRIC_LETTER_SPACING_EM;
}

export function estimateSingleLineWidth(text: string, fontSize: number) {
  return Array.from(text).length * fontSize * 0.58;
}

export function canUsePretextMeasurement() {
  if (typeof document === "undefined") {
    return false;
  }

  return !/\bjsdom\b/i.test(globalThis.navigator?.userAgent ?? "");
}
