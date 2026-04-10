import type { SharedAudioAnalysisCache, DecodedAudioData } from "../audio-analysis";
import type { SceneAudioAnalysisResult } from "@lyric-video-maker/core";
import type {
  CachedAssetBody,
  PreviewAssetCache,
  PreviewComputationCache
} from "../types";

export function createPreviewAssetCache(): PreviewAssetCache {
  return new Map<string, Promise<CachedAssetBody>>();
}

export function createPreviewComputationCache(): PreviewComputationCache {
  return {
    assetBodies: createPreviewAssetCache(),
    audioAnalysis: {
      decodedAudio: new Map<string, Promise<DecodedAudioData>>(),
      spectrum: new Map<string, Promise<SceneAudioAnalysisResult>>()
    } satisfies SharedAudioAnalysisCache,
    prepareResults: new Map<string, Promise<Record<string, unknown>>>()
  };
}
