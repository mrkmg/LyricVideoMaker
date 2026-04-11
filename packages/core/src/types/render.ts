import type { LyricCue } from "./lyric";
import type {
  SceneComponentDefinition,
  SerializedSceneDefinition,
  ValidatedSceneComponentInstance
} from "./scene-component";
import type { SceneValidationContext } from "./scene-options";
import type { VideoSettings } from "./video";

export type RenderEncoding = "x264" | "x265" | "webm";
export type RenderQuality = "speed" | "balanced" | "quality";

export interface RenderOutputSettings {
  threads: number;
  encoding: RenderEncoding;
  quality: RenderQuality;
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
  render: RenderOutputSettings;
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
  render?: Partial<RenderOutputSettings>;
  validationContext?: SceneValidationContext;
}
