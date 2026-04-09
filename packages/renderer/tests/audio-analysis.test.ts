import { describe, expect, it, vi } from "vitest";
import type { SceneAudioAnalysisRequest, VideoSettings } from "@lyric-video-maker/core";
import { analyzeAudioSpectrum, createAudioAnalysisAccessor, type DecodedAudioData } from "../src/audio-analysis";

describe("audio analysis", () => {
  it("returns frame-aligned spectrum values for the target video", async () => {
    const video: VideoSettings = {
      width: 1920,
      height: 1080,
      fps: 30,
      durationMs: 1000,
      durationInFrames: 30
    };
    const request: SceneAudioAnalysisRequest = {
      bandCount: 8,
      minFrequency: 40,
      maxFrequency: 2400,
      analysisFps: 48,
      sensitivity: 1.3,
      smoothing: 25,
      attackMs: 20,
      releaseMs: 180,
      silenceFloor: 5,
      bandDistribution: "log"
    };

    const result = await analyzeAudioSpectrum({
      audioPath: "song.mp3",
      request,
      video,
      logger: createLogger(),
      decodeAudio: vi.fn().mockResolvedValue(createDecodedAudio())
    });

    expect(result.frameCount).toBe(30);
    expect(result.fps).toBe(30);
    expect(result.bandCount).toBe(8);
    expect(result.values).toHaveLength(30);
    expect(result.values[0]).toHaveLength(8);
    expect(Math.max(...result.values.flat())).toBeGreaterThan(0);
  });

  it("caches repeated spectrum requests per accessor", async () => {
    const decodeAudio = vi.fn().mockResolvedValue(createDecodedAudio());
    const request: SceneAudioAnalysisRequest = {
      bandCount: 12,
      minFrequency: 60,
      maxFrequency: 3600,
      analysisFps: 60,
      sensitivity: 1.2,
      smoothing: 40,
      attackMs: 15,
      releaseMs: 250,
      silenceFloor: 6,
      bandDistribution: "log"
    };
    const accessor = createAudioAnalysisAccessor({
      audioPath: "song.mp3",
      video: {
        width: 1920,
        height: 1080,
        fps: 30,
        durationMs: 1000,
        durationInFrames: 30
      },
      logger: createLogger(),
      decodeAudio
    });

    const first = await accessor.getSpectrum(request);
    const second = await accessor.getSpectrum(request);

    expect(first).toBe(second);
    expect(decodeAudio).toHaveBeenCalledTimes(1);
  });
});

function createDecodedAudio(): DecodedAudioData {
  const sampleRate = 22_050;
  const durationSeconds = 1;
  const sampleCount = sampleRate * durationSeconds;
  const samples = new Float32Array(sampleCount);

  for (let index = 0; index < sampleCount; index += 1) {
    const time = index / sampleRate;
    samples[index] =
      Math.sin(2 * Math.PI * 220 * time) * 0.7 +
      Math.sin(2 * Math.PI * 880 * time) * 0.3;
  }

  return {
    sampleRate,
    durationMs: 1000,
    samples
  };
}

function createLogger() {
  return {
    info: vi.fn(),
    warn: vi.fn()
  };
}
