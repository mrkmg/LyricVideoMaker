import { existsSync } from "node:fs";
import type { BrowserWindow } from "electron";
import {
  createRenderJob,
  type LyricCue,
  type RenderHistoryEntry,
  type RenderProgressEvent
} from "@lyric-video-maker/core";
import { renderLyricVideo } from "@lyric-video-maker/renderer";
import { builtInSceneComponents } from "@lyric-video-maker/scene-registry";
import type { StartRenderRequest } from "../../src/electron-api";
import type { RenderHistory } from "./render-history";

export type RenderJob = ReturnType<typeof createRenderJob>;

export interface AbortRegistry {
  set(jobId: string, controller: AbortController): void;
  get(jobId: string): AbortController | undefined;
  delete(jobId: string): void;
}

export function createAbortRegistry(): AbortRegistry {
  const controllers = new Map<string, AbortController>();
  return {
    set(jobId, controller) {
      controllers.set(jobId, controller);
    },
    get(jobId) {
      return controllers.get(jobId);
    },
    delete(jobId) {
      controllers.delete(jobId);
    }
  };
}

export interface BuildRenderJobOptions {
  request: StartRenderRequest;
  cues: LyricCue[];
  durationMs: number;
}

export function buildRenderJob({ request, cues, durationMs }: BuildRenderJobOptions): RenderJob {
  return createRenderJob({
    audioPath: request.audioPath,
    subtitlePath: request.subtitlePath,
    outputPath: request.outputPath,
    scene: request.scene,
    componentDefinitions: builtInSceneComponents,
    cues,
    durationMs,
    video: request.video,
    validationContext: {
      isFileAccessible: existsSync
    }
  });
}

export function buildInitialRenderHistoryEntry(job: RenderJob): RenderHistoryEntry {
  return {
    id: job.id,
    sceneId: job.sceneId,
    sceneName: job.sceneName,
    outputPath: job.outputPath,
    createdAt: job.createdAt,
    status: "queued",
    progress: 0,
    message: "Queued",
    logs: []
  };
}

export interface RunRenderJobDeps {
  job: RenderJob;
  controller: AbortController;
  renderHistory: RenderHistory;
  abortRegistry: AbortRegistry;
  getMainWindow(): BrowserWindow | null;
}

export async function runRenderJob({
  job,
  controller,
  renderHistory,
  abortRegistry,
  getMainWindow
}: RunRenderJobDeps) {
  try {
    await renderLyricVideo({
      job,
      componentDefinitions: builtInSceneComponents,
      signal: controller.signal,
      onProgress: (event) => handleProgress({ job, event, renderHistory, getMainWindow })
    });
  } catch (error) {
    if (controller.signal.aborted) {
      return;
    }

    handleProgress({
      job,
      event: {
        jobId: job.id,
        status: "failed",
        progress: 0,
        message: "Render failed",
        error: error instanceof Error ? error.message : String(error)
      },
      renderHistory,
      getMainWindow
    });
  } finally {
    abortRegistry.delete(job.id);
  }
}

interface HandleProgressDeps {
  job: RenderJob;
  event: RenderProgressEvent;
  renderHistory: RenderHistory;
  getMainWindow(): BrowserWindow | null;
}

function handleProgress({ job, event, renderHistory, getMainWindow }: HandleProgressDeps) {
  const current = renderHistory.get(job.id);
  const nextLogs = event.logEntry ? [...(current?.logs ?? []), event.logEntry] : current?.logs;
  const hasFiniteProgress = Number.isFinite(event.progress);
  const entry: RenderHistoryEntry = {
    id: job.id,
    sceneId: job.sceneId,
    sceneName: job.sceneName,
    outputPath: job.outputPath,
    createdAt: job.createdAt,
    status: hasFiniteProgress ? event.status : current?.status ?? event.status,
    progress: hasFiniteProgress ? event.progress : current?.progress ?? 0,
    message:
      event.logEntry && !hasFiniteProgress ? current?.message ?? event.message : event.message,
    etaMs: hasFiniteProgress ? event.etaMs : current?.etaMs,
    renderFps: hasFiniteProgress ? event.renderFps : current?.renderFps,
    error: event.error ?? current?.error,
    logs: nextLogs
  };

  renderHistory.upsert({
    ...current,
    ...entry
  });

  getMainWindow()?.webContents.send("render:progress", event);
}
