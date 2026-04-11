import type {
  RenderOutputSettings,
  SerializedSceneDefinition,
  VideoSettings
} from "@lyric-video-maker/core";

export interface ComposerState {
  audioPath: string;
  subtitlePath: string;
  outputPath: string;
  scene: SerializedSceneDefinition | null;
  video: Pick<VideoSettings, "width" | "height" | "fps">;
  render: RenderOutputSettings;
}
