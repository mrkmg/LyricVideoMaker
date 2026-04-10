import type { ScaledLyricLayout } from "./types";
import type { createLyricBlockStyles } from "./layout";

export const LYRIC_LAYOUT_CACHE_LIMIT = 200;

export const lyricScaledLayoutCache = new Map<string, ScaledLyricLayout>();
export const lyricBlockStyleCache = new Map<string, ReturnType<typeof createLyricBlockStyles>>();
export const lyricMeasurementCache = new Map<string, number>();

export function setCachedValue<T>(cache: Map<string, T>, key: string, value: T) {
  cache.set(key, value);
  if (cache.size <= LYRIC_LAYOUT_CACHE_LIMIT) {
    return;
  }

  const firstKey = cache.keys().next().value;
  if (firstKey) {
    cache.delete(firstKey);
  }
}

export function clearAllCaches() {
  lyricScaledLayoutCache.clear();
  lyricBlockStyleCache.clear();
  lyricMeasurementCache.clear();
}

export function getMeasurementCacheSize() {
  return lyricMeasurementCache.size;
}
