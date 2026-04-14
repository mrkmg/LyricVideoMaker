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
  plugins: InstalledPluginSummary[];
  fonts: string[];
  history: RenderHistoryEntry[];
  previewProfilerEnabled: boolean;
  ffmpegAvailable: boolean;
  layoutPreferences?: {
    panes?: PaneLayoutPreferences;
  };
}

export interface InstalledPluginSummary {
  id: string;
  name: string;
  version: string;
  url: string;
  repoDir: string;
  componentCount: number;
  sceneCount: number;
}

export interface SetupFfmpegResult {
  available: boolean;
}

export interface PaneLayoutPreferences {
  generalPaneWidth: number;
  sidebarWidth: number;
  inspectorHeight: number;
}

export type FilePickKind = "audio" | "subtitle" | "lyrics-text" | "image" | "video" | "image-list" | "output";

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
  pickPaths(kind: FilePickKind): Promise<string[] | null>;
  startRender(request: StartRenderRequest): Promise<RenderHistoryEntry>;
  renderPreviewFrame(request: RenderPreviewRequest): Promise<RenderPreviewResponse>;
  startSubtitleGeneration(request: StartSubtitleGenerationRequest): Promise<SubtitleGenerationResult>;
  cancelSubtitleGeneration(): Promise<void>;
  saveScene(scene: SerializedSceneDefinition): Promise<SerializedSceneDefinition>;
  deleteScene(sceneId: string): Promise<void>;
  importScene(): Promise<SerializedSceneDefinition | null>;
  exportScene(scene: SerializedSceneDefinition): Promise<string | null>;
  listPlugins(): Promise<InstalledPluginSummary[]>;
  importPlugin(url: string): Promise<AppBootstrapData>;
  updatePlugin(pluginId: string): Promise<AppBootstrapData>;
  removePlugin(pluginId: string): Promise<AppBootstrapData>;
  savePaneLayout(panes: PaneLayoutPreferences): Promise<void>;
  setupFfmpeg(): Promise<SetupFfmpegResult>;
  readFileBytes(filePath: string): Promise<Uint8Array>;
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
