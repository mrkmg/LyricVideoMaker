import { describe, expect, it, vi } from "vitest";
import { createAudioAnalysisAccessor, type DecodedAudioData } from "../src/audio-analysis";

describe("createAudioAnalysisAccessor", () => {
  it("reuses shared decoded audio and spectrum caches across accessors", async () => {
    const decodeAudio = vi.fn(async (): Promise<DecodedAudioData> => ({
      sampleRate: 22050,
      durationMs: 1000,
      samples: new Float32Array(22050)
    }));
    const logger = {
      info: vi.fn(),
      warn: vi.fn()
    };
    const sharedCache = {
      decodedAudio: new Map<string, Promise<DecodedAudioData>>(),
      spectrum: new Map()
    };
    const request = {
      bandCount: 8,
      minFrequency: 40,
      maxFrequency: 2400,
      analysisFps: 24,
      sensitivity: 1,
      smoothing: 30,
      attackMs: 30,
      releaseMs: 180,
      silenceFloor: 5,
      bandDistribution: "log" as const
    };

    const firstAccessor = createAudioAnalysisAccessor({
      audioPath: "song.mp3",
      video: {
        width: 1920,
        height: 1080,
        fps: 30,
        durationMs: 1000,
        durationInFrames: 30
      },
      logger,
      decodeAudio,
      sharedCache
    });
    const secondAccessor = createAudioAnalysisAccessor({
      audioPath: "song.mp3",
      video: {
        width: 1920,
        height: 1080,
        fps: 30,
        durationMs: 1000,
        durationInFrames: 30
      },
      logger,
      decodeAudio,
      sharedCache
    });

    const firstSpectrum = await firstAccessor.getSpectrum(request);
    const secondSpectrum = await secondAccessor.getSpectrum(request);

    expect(firstSpectrum).toBe(secondSpectrum);
    expect(decodeAudio).toHaveBeenCalledTimes(1);
    expect(logger.info).toHaveBeenCalledWith(
      "Reusing cached equalizer spectrum for 8 bands at 24fps."
    );
  });
});
