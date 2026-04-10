// Public types
export type {
  CachedAssetBody,
  FramePreviewResult,
  FramePreviewSession,
  PreloadedAsset,
  PreviewAssetCache,
  PreviewComputationCache,
  PreviewPrepareCache,
  RenderLogger
} from "./types";

// Public entry points
export { probeAudioDurationMs } from "./ffmpeg/probe";
export { renderLyricVideo, type RenderLyricVideoInput } from "./pipeline/render-lyric-video";
export {
  createFramePreviewSession,
  type CreateFramePreviewSessionInput
} from "./pipeline/preview-session";
export {
  createPreviewAssetCache,
  createPreviewComputationCache
} from "./assets/preview-cache";

// Exported for tests
export { buildCompositeFrameMarkup } from "./react-ssr/composite-markup";
export { preloadSceneAssets } from "./assets/preload";
export { areAllComponentsStaticWhenMarkupUnchanged } from "./pipeline/static-detection";
export { resolveRenderParallelism } from "./pipeline/parallelism";
export { createOrderedFrameWriteQueue } from "./pipeline/ordered-frame-queue";
export { renderFrameWithWorkerRecovery } from "./pipeline/worker-frames";
export { writeFrameToMuxerInput } from "./ffmpeg/frame-writer";
export { createBoundedOutputBuffer } from "./ffmpeg/bounded-output-buffer";
