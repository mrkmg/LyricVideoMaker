import type React from "react";

export interface LyricCue {
  index: number;
  startMs: number;
  endMs: number;
  text: string;
  lines: string[];
}

export interface LyricRuntime {
  cues: LyricCue[];
  current: LyricCue | null;
  next: LyricCue | null;
  getCueAt(ms: number): LyricCue | null;
  getNextCue(ms: number): LyricCue | null;
  getCuesInRange(startMs: number, endMs: number): LyricCue[];
  getCueProgress(cue: LyricCue, ms: number): number;
}

export interface BrowserLyricRuntime {
  current: LyricCue | null;
  next: LyricCue | null;
}

export interface VideoSettings {
  width: number;
  height: number;
  fps: number;
  durationMs: number;
  durationInFrames: number;
}

interface SceneOptionFieldBase {
  id: string;
  label: string;
}

export type SceneOptionField =
  | ({
      type: "boolean";
      defaultValue?: boolean;
    } & SceneOptionFieldBase)
  | ({
      type: "number";
      defaultValue?: number;
      min?: number;
      max?: number;
      step?: number;
    } & SceneOptionFieldBase)
  | ({
      type: "text";
      defaultValue?: string;
      multiline?: boolean;
    } & SceneOptionFieldBase)
  | ({
      type: "color";
      defaultValue?: string;
    } & SceneOptionFieldBase)
  | ({
      type: "font";
      defaultValue?: string;
    } & SceneOptionFieldBase)
  | ({
      type: "image";
      required?: boolean;
    } & SceneOptionFieldBase)
  | ({
      type: "select";
      defaultValue?: string;
      options: { label: string; value: string }[];
    } & SceneOptionFieldBase);

export interface SceneOptionCategory {
  type: "category";
  id: string;
  label: string;
  defaultExpanded?: boolean;
  options: SceneOptionField[];
}

export type SceneOptionEntry = SceneOptionField | SceneOptionCategory;

export interface SceneAssetAccessor {
  getPath(instanceId: string, optionId: string): string | null;
  getUrl(instanceId: string, optionId: string): string | null;
}

export type SceneAudioBandDistribution = "linear" | "log";

export interface SceneAudioAnalysisRequest {
  bandCount: number;
  minFrequency: number;
  maxFrequency: number;
  analysisFps: number;
  sensitivity: number;
  smoothing: number;
  attackMs: number;
  releaseMs: number;
  silenceFloor: number;
  bandDistribution: SceneAudioBandDistribution;
}

export interface SceneAudioAnalysisResult {
  fps: number;
  frameCount: number;
  bandCount: number;
  values: number[][];
}

export type PreparedSceneComponentData = Record<string, unknown>;
export type PreparedSceneStackData = Record<string, PreparedSceneComponentData>;
export type SceneSource = "built-in" | "user";

export interface SceneComponentInstance {
  id: string;
  componentId: string;
  enabled: boolean;
  options: Record<string, unknown>;
}

export interface ValidatedSceneComponentInstance extends SceneComponentInstance {
  componentName: string;
}

export interface ScenePrepareContext<TOptions> {
  instance: ValidatedSceneComponentInstance;
  options: TOptions;
  video: VideoSettings;
  lyrics: LyricRuntime;
  assets: SceneAssetAccessor;
  audio: {
    path: string;
    getSpectrum(request: SceneAudioAnalysisRequest): Promise<SceneAudioAnalysisResult>;
  };
  signal?: AbortSignal;
}

export interface ScenePrepareCacheKeyContext<TOptions> {
  instance: ValidatedSceneComponentInstance;
  options: TOptions;
  video: VideoSettings;
  audioPath: string;
}

export interface SceneRenderProps<TOptions> {
  instance: ValidatedSceneComponentInstance;
  options: TOptions;
  frame: number;
  timeMs: number;
  video: VideoSettings;
  lyrics: LyricRuntime;
  assets: Pick<SceneAssetAccessor, "getUrl">;
  prepared: PreparedSceneComponentData;
}

export interface SceneBrowserInitialStateContext<TOptions> {
  instance: ValidatedSceneComponentInstance;
  options: TOptions;
  video: VideoSettings;
  lyrics: BrowserLyricRuntime;
  assets: Pick<SceneAssetAccessor, "getUrl">;
  prepared: PreparedSceneComponentData;
}

export interface SceneBrowserFrameStateContext<TOptions> {
  instance: ValidatedSceneComponentInstance;
  options: TOptions;
  frame: number;
  timeMs: number;
  video: VideoSettings;
  lyrics: BrowserLyricRuntime;
  assets: Pick<SceneAssetAccessor, "getUrl">;
  prepared: PreparedSceneComponentData;
}

export interface SceneBrowserRuntimeDefinition<TOptions> {
  runtimeId: string;
  getInitialState?: (
    ctx: SceneBrowserInitialStateContext<TOptions>
  ) => Record<string, unknown> | null;
  getFrameState?: (
    ctx: SceneBrowserFrameStateContext<TOptions>
  ) => Record<string, unknown> | null;
}

export interface SceneComponentDefinition<TOptions> {
  id: string;
  name: string;
  description?: string;
  staticWhenMarkupUnchanged?: boolean;
  options: SceneOptionEntry[];
  defaultOptions: TOptions;
  validate?: (raw: unknown) => TOptions;
  getPrepareCacheKey?: (ctx: ScenePrepareCacheKeyContext<TOptions>) => string | null;
  prepare?: (ctx: ScenePrepareContext<TOptions>) => Promise<PreparedSceneComponentData>;
  browserRuntime?: SceneBrowserRuntimeDefinition<TOptions>;
  Component: (props: SceneRenderProps<TOptions>) => React.ReactElement | null;
}

export interface SceneDefinition {
  id: string;
  name: string;
  description?: string;
  source: SceneSource;
  readOnly: boolean;
  filePath?: string;
  components: SceneComponentInstance[];
}

export interface SerializedSceneComponentDefinition {
  id: string;
  name: string;
  description?: string;
  options: SceneOptionEntry[];
  defaultOptions: Record<string, unknown>;
}

export interface SerializedSceneDefinition {
  id: string;
  name: string;
  description?: string;
  source: SceneSource;
  readOnly: boolean;
  filePath?: string;
  components: SceneComponentInstance[];
}

export interface SceneFileData {
  version: number;
  scene: SerializedSceneDefinition;
}

export interface RenderJob {
  id: string;
  audioPath: string;
  subtitlePath: string;
  outputPath: string;
  sceneId: string;
  sceneName: string;
  components: ValidatedSceneComponentInstance[];
  video: VideoSettings;
  lyrics: LyricCue[];
  createdAt: string;
}

export type RenderStatus =
  | "queued"
  | "preparing"
  | "rendering"
  | "muxing"
  | "completed"
  | "failed"
  | "cancelled";

export type RenderLogLevel = "info" | "warning" | "error";

export interface RenderLogEntry {
  timestamp: string;
  level: RenderLogLevel;
  message: string;
}

export interface RenderHistoryEntry {
  id: string;
  sceneId: string;
  sceneName: string;
  outputPath: string;
  createdAt: string;
  status: RenderStatus;
  progress: number;
  message: string;
  etaMs?: number;
  renderFps?: number;
  error?: string;
  logs?: RenderLogEntry[];
}

export interface RenderProgressEvent {
  jobId: string;
  status: RenderStatus;
  progress: number;
  message: string;
  etaMs?: number;
  renderFps?: number;
  outputPath?: string;
  error?: string;
  logEntry?: RenderLogEntry;
}

export interface SceneValidationContext {
  isFileAccessible?: (path: string) => boolean;
  supportedFonts?: readonly string[];
}

export interface CreateRenderJobInput {
  audioPath: string;
  subtitlePath: string;
  outputPath: string;
  scene: SerializedSceneDefinition;
  componentDefinitions: SceneComponentDefinition<Record<string, unknown>>[];
  cues: LyricCue[];
  durationMs: number;
  createdAt?: Date;
  video?: Partial<Pick<VideoSettings, "width" | "height" | "fps">>;
  validationContext?: SceneValidationContext;
}
