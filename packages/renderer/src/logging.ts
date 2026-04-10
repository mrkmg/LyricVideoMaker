import type { RenderLogEntry, RenderLogLevel } from "@lyric-video-maker/core";
import type { ProgressEmitter, RenderLogger } from "./types";

export function createRenderLogger(jobId: string, progress: ProgressEmitter): RenderLogger {
  return {
    info(message) {
      emitLog("info", message);
    },
    warn(message) {
      emitLog("warning", message);
    },
    error(message) {
      emitLog("error", message);
    }
  };

  function emitLog(level: RenderLogLevel, message: string) {
    const entry = createLogEntry(level, message);
    const output =
      level === "error" ? console.error : level === "warning" ? console.warn : console.info;
    output(`[lyric-video-render:${jobId}] ${message}`);
    progress.emit({
      jobId,
      status: "rendering",
      progress: Number.NaN,
      message,
      logEntry: entry
    });
  }
}

export function createLogEntry(level: RenderLogLevel, message: string): RenderLogEntry {
  return {
    timestamp: new Date().toISOString(),
    level,
    message
  };
}
