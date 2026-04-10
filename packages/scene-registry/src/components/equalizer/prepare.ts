import type { ScenePrepareCacheKeyContext, ScenePrepareContext } from "@lyric-video-maker/core";
import type { EqualizerOptions, PreparedEqualizerData } from "./types";

export function getEqualizerPrepareCacheKey({
  options,
  video,
  audioPath
}: ScenePrepareCacheKeyContext<EqualizerOptions>) {
  return JSON.stringify({
    audioPath,
    video: {
      fps: video.fps,
      durationMs: video.durationMs,
      durationInFrames: video.durationInFrames
    },
    spectrum: {
      barCount: options.barCount,
      minFrequency: options.minFrequency,
      maxFrequency: options.maxFrequency,
      analysisFps: options.analysisFps,
      sensitivity: options.sensitivity,
      smoothing: options.smoothing,
      attackMs: options.attackMs,
      releaseMs: options.releaseMs,
      silenceFloor: options.silenceFloor,
      bandDistribution: options.bandDistribution
    }
  });
}

export async function prepareEqualizer({ audio, options }: ScenePrepareContext<EqualizerOptions>) {
  const spectrum = await audio.getSpectrum({
    bandCount: options.barCount,
    minFrequency: options.minFrequency,
    maxFrequency: options.maxFrequency,
    analysisFps: options.analysisFps,
    sensitivity: options.sensitivity,
    smoothing: options.smoothing,
    attackMs: options.attackMs,
    releaseMs: options.releaseMs,
    silenceFloor: options.silenceFloor,
    bandDistribution: options.bandDistribution
  });

  return {
    frames: spectrum.values
  } satisfies PreparedEqualizerData;
}
