import type { RenderProgressEvent, RenderStatus } from "@lyric-video-maker/core";
import type { ProgressEmitter } from "../types";

export function createProgressEmitter(
  onProgress: ((event: RenderProgressEvent) => void) | undefined
): ProgressEmitter {
  let lastStatus: RenderStatus | null = null;
  let lastProgress = Number.NaN;
  let lastOutputPath: string | undefined;
  let lastError: string | undefined;
  let lastEtaMs: number | undefined;
  let lastRenderFps: number | undefined;
  let lastLogKey: string | undefined;

  return {
    emit(event) {
      const nextLogKey = event.logEntry
        ? `${event.logEntry.timestamp}|${event.logEntry.level}|${event.logEntry.message}`
        : undefined;

      if (
        event.status === lastStatus &&
        numbersMatch(event.progress, lastProgress) &&
        event.outputPath === lastOutputPath &&
        event.error === lastError &&
        numbersMatch(event.etaMs, lastEtaMs) &&
        numbersMatch(event.renderFps, lastRenderFps) &&
        nextLogKey === lastLogKey
      ) {
        return;
      }

      lastStatus = event.status;
      lastProgress = event.progress;
      lastOutputPath = event.outputPath;
      lastError = event.error;
      lastEtaMs = event.etaMs;
      lastRenderFps = event.renderFps;
      lastLogKey = nextLogKey;
      onProgress?.(event);
    }
  };
}

function numbersMatch(left: number | undefined, right: number | undefined) {
  return left === right || (Number.isNaN(left) && Number.isNaN(right));
}
