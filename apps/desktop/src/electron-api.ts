import type {
  LyricCue,
  RenderEncoding,
  RenderHistoryEntry,
  RenderOutputSettings,
  RenderProgressEvent,
  SerializedSceneComponentDefinition,
  SerializedSceneDefinition,
  VideoSettings
} from "@lyric-video-maker/core";

export interface AppBootstrapData {
  scenes: SerializedSceneDefinition[];
  components: SerializedSceneComponentDefinition[];
  fonts: string[];
  history: RenderHistoryEntry[];
  previewProfilerEnabled: boolean;
  layoutPreferences?: {
    panes?: PaneLayoutPreferences;
  };
}

export interface PaneLayoutPreferences {
  generalPaneWidth: number;
  sidebarWidth: number;
  inspectorHeight: number;
}

export type FilePickKind = "audio" | "subtitle" | "lyrics-text" | "image" | "video" | "output";

export type SubtitleGenerationMode = "transcribe" | "align";

export interface StartSubtitleGenerationRequest {
  mode: SubtitleGenerationMode;
  audioPath: string;
  outputPath: string;
  language: string;
  lyricsTextPath?: string;
}

export interface SubtitleGenerationResult {
  outputPath: string;
}

export interface SubtitleGenerationProgressEvent {
  status: "starting" | "running" | "completed" | "failed" | "cancelled";
  progress: number;
  message: string;
  stage?: string;
  outputPath?: string;
  error?: string;
}

export interface StartRenderRequest {
  audioPath: string;
  subtitlePath: string;
  outputPath: string;
  scene: SerializedSceneDefinition;
  video?: Partial<Pick<VideoSettings, "width" | "height" | "fps">>;
  render?: Partial<RenderOutputSettings>;
}

export interface RenderPreviewRequest {
  audioPath: string;
  subtitlePath: string;
  scene: SerializedSceneDefinition;
  video?: Partial<Pick<VideoSettings, "width" | "height" | "fps">>;
  timeMs: number;
}

export interface RenderPreviewResponse {
  imageBytes: Uint8Array;
  imageMimeType: string;
  frame: number;
  timeMs: number;
  durationMs: number;
  currentCue: LyricCue | null;
  previousCue: LyricCue | null;
  nextCue: LyricCue | null;
}

export interface ElectronApi {
  getBootstrapData(): Promise<AppBootstrapData>;
  pickPath(
    kind: FilePickKind,
    suggestedName?: string,
    outputEncoding?: RenderEncoding
  ): Promise<string | null>;
  startRender(request: StartRenderRequest): Promise<RenderHistoryEntry>;
  renderPreviewFrame(request: RenderPreviewRequest): Promise<RenderPreviewResponse>;
  startSubtitleGeneration(request: StartSubtitleGenerationRequest): Promise<SubtitleGenerationResult>;
  cancelSubtitleGeneration(): Promise<void>;
  saveScene(scene: SerializedSceneDefinition): Promise<SerializedSceneDefinition>;
  deleteScene(sceneId: string): Promise<void>;
  importScene(): Promise<SerializedSceneDefinition | null>;
  exportScene(scene: SerializedSceneDefinition): Promise<string | null>;
  savePaneLayout(panes: PaneLayoutPreferences): Promise<void>;
  disposePreview(): Promise<void>;
  cancelRender(jobId: string): Promise<void>;
  onRenderProgress(callback: (event: RenderProgressEvent) => void): () => void;
  onSubtitleGenerationProgress(
    callback: (event: SubtitleGenerationProgressEvent) => void
  ): () => void;
}

declare global {
  interface Window {
    lyricVideoApp: ElectronApi;
  }
}
