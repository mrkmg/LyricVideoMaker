import type {
  RenderHistoryEntry,
  RenderProgressEvent,
  SceneComponentInstance,
  SerializedSceneComponentDefinition,
  SerializedSceneDefinition
} from "@lyric-video-maker/core";
import {
  DEFAULT_VIDEO_FPS,
  DEFAULT_VIDEO_HEIGHT,
  DEFAULT_VIDEO_WIDTH
} from "@lyric-video-maker/core";
import type { ComposerState } from "./composer-types";

export interface VideoSizePreset {
  id: string;
  label: string;
  width: number;
  height: number;
}

export interface FpsPreset {
  id: string;
  label: string;
  fps: number;
}

export const VIDEO_SIZE_PRESETS: VideoSizePreset[] = [
  { id: "4k", label: "4K (3840x2160)", width: 3840, height: 2160 },
  { id: "2k", label: "2K (2560x1440)", width: 2560, height: 1440 },
  { id: "1080", label: "1080p (1920x1080)", width: 1920, height: 1080 },
  { id: "720", label: "720p (1280x720)", width: 1280, height: 720 },
  { id: "1024-square", label: "1024 Square (1024x1024)", width: 1024, height: 1024 }
];

export const FPS_PRESETS: FpsPreset[] = [
  { id: "15", label: "15 fps", fps: 15 },
  { id: "20", label: "20 fps", fps: 20 },
  { id: "30", label: "30 fps", fps: 30 },
  { id: "60", label: "60 fps", fps: 60 }
];

export const emptyComposerState: ComposerState = {
  audioPath: "",
  subtitlePath: "",
  outputPath: "",
  scene: null,
  video: {
    width: DEFAULT_VIDEO_WIDTH,
    height: DEFAULT_VIDEO_HEIGHT,
    fps: DEFAULT_VIDEO_FPS
  }
};

export function upsertHistory(
  history: RenderHistoryEntry[],
  event: RenderProgressEvent | RenderHistoryEntry
) {
  const currentEntry =
    "sceneId" in event
      ? history.find((entry) => entry.id === event.id)
      : history.find((entry) => entry.id === event.jobId);
  const nextEntry: RenderHistoryEntry =
    "sceneId" in event
      ? event
      : {
          id: event.jobId,
          sceneId: currentEntry?.sceneId ?? "unknown-scene",
          sceneName: currentEntry?.sceneName ?? "Unknown Scene",
          outputPath: event.outputPath ?? currentEntry?.outputPath ?? "",
          createdAt: currentEntry?.createdAt ?? new Date().toISOString(),
          status: Number.isFinite(event.progress) ? event.status : currentEntry?.status ?? event.status,
          progress: Number.isFinite(event.progress) ? event.progress : currentEntry?.progress ?? 0,
          message:
            event.logEntry && !Number.isFinite(event.progress)
              ? currentEntry?.message ?? event.message
              : event.message,
          etaMs: Number.isFinite(event.progress) ? event.etaMs : currentEntry?.etaMs,
          renderFps: Number.isFinite(event.progress) ? event.renderFps : currentEntry?.renderFps,
          error: event.error ?? currentEntry?.error,
          logs: event.logEntry ? [...(currentEntry?.logs ?? []), event.logEntry] : currentEntry?.logs
        };

  const withoutEntry = history.filter((entry) => entry.id !== nextEntry.id);
  return [nextEntry, ...withoutEntry].sort((left, right) =>
    right.createdAt.localeCompare(left.createdAt)
  );
}

export function getFileName(path: string) {
  return path.split(/[\\/]/).pop() ?? path;
}

export function stripExtension(fileName: string) {
  return fileName.replace(/\.[^/.]+$/, "");
}

export function formatEta(etaMs: number) {
  const totalSeconds = Math.max(0, Math.round(etaMs / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

export function getCategoryStateKey(instanceId: string, categoryId: string) {
  return `${instanceId}:${categoryId}`;
}

export function upsertScene(
  scenes: SerializedSceneDefinition[],
  nextScene: SerializedSceneDefinition
) {
  const withoutScene = scenes.filter((scene) => scene.id !== nextScene.id);
  return [...withoutScene, nextScene].sort((left, right) => left.name.localeCompare(right.name));
}

export function cloneScene(scene: SerializedSceneDefinition): SerializedSceneDefinition {
  return structuredClone(scene);
}

export function cloneComponent(component: SceneComponentInstance): SceneComponentInstance {
  return structuredClone(component);
}

export function createSceneComponentInstance(
  component: SerializedSceneComponentDefinition
): SceneComponentInstance {
  return {
    id: createInstanceId(component.id),
    componentId: component.id,
    enabled: true,
    options: structuredClone(component.defaultOptions)
  };
}

export function createInstanceId(componentId: string) {
  return `${componentId}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}
