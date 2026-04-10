import type { RenderHistoryEntry } from "@lyric-video-maker/core";

export function mergeRenderEntry(
  current: RenderHistoryEntry | null,
  event: {
    jobId: string;
    status: RenderHistoryEntry["status"];
    progress: number;
    message: string;
    etaMs?: number;
    renderFps?: number;
    outputPath?: string;
    error?: string;
  }
) {
  if (!current || current.id !== event.jobId) {
    return current;
  }

  return {
    ...current,
    outputPath: event.outputPath ?? current.outputPath,
    status: Number.isFinite(event.progress) ? event.status : current.status,
    progress: Number.isFinite(event.progress) ? event.progress : current.progress,
    message: event.message,
    etaMs: Number.isFinite(event.progress) ? event.etaMs : current.etaMs,
    renderFps: Number.isFinite(event.progress) ? event.renderFps : current.renderFps,
    error: event.error ?? current.error
  } satisfies RenderHistoryEntry;
}
