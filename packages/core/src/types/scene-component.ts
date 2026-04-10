import type React from "react";
import type { BrowserLyricRuntime, LyricRuntime } from "./lyric";
import type {
  SceneAudioAnalysisRequest,
  SceneAudioAnalysisResult
} from "./scene-audio";
import type { SceneOptionEntry } from "./scene-options";
import type { VideoSettings } from "./video";

export interface SceneAssetAccessor {
  getPath(instanceId: string, optionId: string): string | null;
  getUrl(instanceId: string, optionId: string): string | null;
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
