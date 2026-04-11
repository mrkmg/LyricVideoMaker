import {
  DEFAULT_VIDEO_FPS,
  DEFAULT_VIDEO_HEIGHT,
  DEFAULT_VIDEO_WIDTH,
  DEFAULT_RENDER_ENCODING,
  DEFAULT_RENDER_QUALITY,
  DEFAULT_RENDER_THREADS
} from "../constants";
import { createLyricRuntime } from "../timeline/runtime";
import { durationMsToFrameCount } from "../timeline/frame-time";
import type { CreateRenderJobInput, RenderJob } from "../types/render";
import { validateSceneComponents } from "./option-validation";

export function createRenderJob({
  audioPath,
  subtitlePath,
  outputPath,
  scene,
  componentDefinitions,
  cues,
  durationMs,
  createdAt = new Date(),
  video,
  render,
  validationContext
}: CreateRenderJobInput): RenderJob {
  const fps = video?.fps ?? DEFAULT_VIDEO_FPS;
  const width = video?.width ?? DEFAULT_VIDEO_WIDTH;
  const height = video?.height ?? DEFAULT_VIDEO_HEIGHT;
  const validatedComponents = validateSceneComponents(scene, componentDefinitions, validationContext);

  return {
    id: `job-${createdAt.getTime()}`,
    audioPath,
    subtitlePath,
    outputPath,
    sceneId: scene.id,
    sceneName: scene.name,
    components: validatedComponents,
    lyrics: cues,
    createdAt: createdAt.toISOString(),
    video: {
      width,
      height,
      fps,
      durationMs,
      durationInFrames: durationMsToFrameCount(durationMs, fps)
    },
    render: {
      threads: render?.threads ?? DEFAULT_RENDER_THREADS,
      encoding: render?.encoding ?? DEFAULT_RENDER_ENCODING,
      quality: render?.quality ?? DEFAULT_RENDER_QUALITY
    }
  };
}

export function createSceneFrameContext(job: RenderJob, frame: number) {
  const timeMs = Math.min(job.video.durationMs, Math.round((frame / job.video.fps) * 1000));
  return {
    timeMs,
    lyrics: createLyricRuntime(job.lyrics, timeMs)
  };
}
