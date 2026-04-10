import { performance } from "node:perf_hooks";
import type { RenderJob } from "@lyric-video-maker/core";
import type {
  PreviewProfileStage,
  PreviewProfiler,
  RenderLogger,
  RenderProfileStage,
  RenderProfiler
} from "./types";

export function createRenderProfiler(): RenderProfiler {
  return {
    enabled: process.env.LYRIC_VIDEO_RENDER_DEBUG === "1",
    totalStartMs: performance.now(),
    stages: {
      prepare: 0,
      frameState: 0,
      browserUpdate: 0,
      capture: 0,
      queueWait: 0,
      muxWrite: 0,
      muxFinalize: 0
    }
  };
}

export function createPreviewProfiler(jobId: string): PreviewProfiler {
  return {
    enabled: process.env.LYRIC_VIDEO_PREVIEW_PROFILE === "1",
    jobId
  };
}

export async function measurePreviewStage<T>(
  profiler: PreviewProfiler | undefined,
  stage: PreviewProfileStage,
  run: () => Promise<T>,
  details: Record<string, unknown> = {}
): Promise<T> {
  if (!profiler?.enabled) {
    return await run();
  }

  const startMs = performance.now();
  try {
    return await run();
  } finally {
    console.info(
      `[preview-profile:renderer] ${JSON.stringify({
        jobId: profiler.jobId,
        stage,
        durationMs: roundMs(performance.now() - startMs),
        ...details
      })}`
    );
  }
}

export function maybeMeasureSync<T>(
  profiler: RenderProfiler | undefined,
  stage: RenderProfileStage,
  run: () => T
): T {
  if (!profiler) {
    return run();
  }

  return measureSync(profiler, stage, run);
}

export async function maybeMeasureAsync<T>(
  profiler: RenderProfiler | undefined,
  stage: RenderProfileStage,
  run: () => Promise<T>
): Promise<T> {
  if (!profiler) {
    return await run();
  }

  return await measureAsync(profiler, stage, run);
}

export function measureSync<T>(
  profiler: RenderProfiler,
  stage: RenderProfileStage,
  run: () => T
): T {
  if (!profiler.enabled) {
    return run();
  }

  const startMs = performance.now();
  try {
    return run();
  } finally {
    profiler.stages[stage] += performance.now() - startMs;
  }
}

export async function measureAsync<T>(
  profiler: RenderProfiler,
  stage: RenderProfileStage,
  run: () => Promise<T>
): Promise<T> {
  if (!profiler.enabled) {
    return await run();
  }

  const startMs = performance.now();
  try {
    return await run();
  } finally {
    profiler.stages[stage] += performance.now() - startMs;
  }
}

export function logRenderProfile(
  profiler: RenderProfiler,
  job: RenderJob,
  logger: RenderLogger
) {
  if (!profiler.enabled) {
    return;
  }

  const totalMs = performance.now() - profiler.totalStartMs;
  const renderedFps = job.video.durationInFrames / Math.max(totalMs / 1000, 0.001);
  logger.info(
    `Profile ${JSON.stringify(
      {
        jobId: job.id,
        frames: job.video.durationInFrames,
        totalMs: roundMs(totalMs),
        renderedFps: Number(renderedFps.toFixed(2)),
        stagesMs: {
          prepare: roundMs(profiler.stages.prepare),
          frameState: roundMs(profiler.stages.frameState),
          browserUpdate: roundMs(profiler.stages.browserUpdate),
          capture: roundMs(profiler.stages.capture),
          queueWait: roundMs(profiler.stages.queueWait),
          muxWrite: roundMs(profiler.stages.muxWrite),
          muxFinalize: roundMs(profiler.stages.muxFinalize)
        }
      },
      null,
      2
    )}`
  );
}

export function traceRenderStep(
  logger: RenderLogger,
  sessionLabel: string,
  frame: number,
  step: string
) {
  if (process.env.LYRIC_VIDEO_RENDER_TRACE !== "1") {
    return;
  }

  logger.info(`[trace:${sessionLabel}] frame=${frame} step=${step}`);
}

function roundMs(value: number): number {
  return Number(value.toFixed(2));
}
