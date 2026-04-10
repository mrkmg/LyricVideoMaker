import type { Writable } from "node:stream";
import type { SharedAudioAnalysisCache } from "./audio-analysis";

export interface RenderLogger {
  info(message: string): void;
  warn(message: string): void;
  error(message: string): void;
}

export interface PreloadedAsset {
  instanceId: string;
  optionId: string;
  path: string;
  url: string;
  contentType: string;
  body: Buffer;
}

export interface CachedAssetBody {
  body: Buffer;
  contentType: string;
  normalized: boolean;
}

export type PreviewAssetCache = Map<string, Promise<CachedAssetBody>>;
export type PreviewPrepareCache = Map<string, Promise<Record<string, unknown>>>;

export interface PreviewComputationCache {
  assetBodies: PreviewAssetCache;
  audioAnalysis: SharedAudioAnalysisCache;
  prepareResults: PreviewPrepareCache;
}

export type RenderProfileStage =
  | "prepare"
  | "frameState"
  | "browserUpdate"
  | "capture"
  | "queueWait"
  | "muxWrite"
  | "muxFinalize";

export interface RenderProfiler {
  enabled: boolean;
  totalStartMs: number;
  stages: Record<RenderProfileStage, number>;
}

export type PreviewProfileStage =
  | "preloadSceneAssets"
  | "prepareSceneComponents"
  | "updateLiveDomScene"
  | "captureScreenshot";

export interface PreviewProfiler {
  enabled: boolean;
  jobId: string;
}

export interface FrameMuxer {
  writeFrame(frame: Buffer): Promise<void>;
  finish(): Promise<void>;
  abort(): Promise<void>;
}

export interface FrameWriteQueue {
  enqueue(frame: Buffer): Promise<void>;
  finish(): Promise<void>;
  abort(): Promise<void>;
}

export interface OrderedFrameWriteQueue {
  enqueue(frame: { frame: number; buffer: Buffer }): Promise<number>;
  finish(): Promise<void>;
  abort(): Promise<void>;
}

export interface FramePreviewResult {
  png: Buffer;
  frame: number;
  timeMs: number;
}

export interface FramePreviewSession {
  renderFrame(input: { frame: number }): Promise<FramePreviewResult>;
  dispose(): Promise<void>;
}

export interface FramePreviewWorkerHandle {
  current: FramePreviewSession;
}

export interface ProgressEmitter {
  emit(event: import("@lyric-video-maker/core").RenderProgressEvent): void;
}

export interface MuxPipelineDiagnostics {
  orderedPendingFrames: number;
  orderedNextFrameToWrite: number;
  orderedLastFlushedFrame: number;
  frameQueueBufferedFrames: number;
  frameQueueLastCompletedFrame: number;
  ffmpegFramesWritten: number;
  ffmpegLastWriteStartedAtMs: number;
  ffmpegLastWriteCompletedAtMs: number;
  ffmpegPid: number | undefined;
}

export const NOOP_PROGRESS_EMITTER: ProgressEmitter = {
  emit() {}
};
