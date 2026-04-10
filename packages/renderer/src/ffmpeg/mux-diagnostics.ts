import type { MuxPipelineDiagnostics, RenderLogger } from "../types";

export function createMuxPipelineDiagnostics(): MuxPipelineDiagnostics {
  const nowMs = Date.now();
  return {
    orderedPendingFrames: 0,
    orderedNextFrameToWrite: 0,
    orderedLastFlushedFrame: -1,
    frameQueueBufferedFrames: 0,
    frameQueueLastCompletedFrame: -1,
    ffmpegFramesWritten: 0,
    ffmpegLastWriteStartedAtMs: nowMs,
    ffmpegLastWriteCompletedAtMs: nowMs,
    ffmpegPid: undefined
  };
}

export function traceMuxState(
  logger: RenderLogger | undefined,
  diagnostics: MuxPipelineDiagnostics | undefined,
  reason: string
) {
  if (!logger || process.env.LYRIC_VIDEO_RENDER_MUX_TRACE !== "1") {
    return;
  }

  logger.info(`[mux-trace:${reason}] ${formatMuxDiagnostics(diagnostics)}`);
}

export function formatMuxDiagnostics(diagnostics: MuxPipelineDiagnostics | undefined) {
  if (!diagnostics) {
    return "mux diagnostics unavailable.";
  }

  const nowMs = Date.now();
  const elapsedSinceLastWriteMs = Math.max(0, nowMs - diagnostics.ffmpegLastWriteCompletedAtMs);
  return [
    `orderedPending=${diagnostics.orderedPendingFrames}`,
    `nextExpected=${diagnostics.orderedNextFrameToWrite}`,
    `lastFlushed=${diagnostics.orderedLastFlushedFrame}`,
    `frameQueueBuffered=${diagnostics.frameQueueBufferedFrames}`,
    `lastFrameCompleted=${diagnostics.frameQueueLastCompletedFrame}`,
    `ffmpegFramesWritten=${diagnostics.ffmpegFramesWritten}`,
    `ffmpegPid=${diagnostics.ffmpegPid ?? "unknown"}`,
    `lastWriteAgeMs=${elapsedSinceLastWriteMs}`
  ].join(" ");
}
