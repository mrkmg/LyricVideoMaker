import { spawn } from "node:child_process";
import type {
  SceneAudioAnalysisRequest,
  SceneAudioAnalysisResult,
  VideoSettings
} from "@lyric-video-maker/core";

const DEFAULT_SAMPLE_RATE = 22_050;

export interface DecodedAudioData {
  sampleRate: number;
  durationMs: number;
  samples: Float32Array;
}

export interface AudioAnalysisLogger {
  info(message: string): void;
  warn(message: string): void;
}

export interface AudioDecodeFunction {
  (audioPath: string, sampleRate: number, signal?: AbortSignal): Promise<DecodedAudioData>;
}

export interface SharedAudioAnalysisCache {
  decodedAudio: Map<string, Promise<DecodedAudioData>>;
  spectrum: Map<string, Promise<SceneAudioAnalysisResult>>;
}

export function createAudioAnalysisAccessor({
  audioPath,
  video,
  signal,
  logger,
  decodeAudio = decodeAudioFileToMono,
  sharedCache
}: {
  audioPath: string;
  video: VideoSettings;
  signal?: AbortSignal;
  logger: AudioAnalysisLogger;
  decodeAudio?: AudioDecodeFunction;
  sharedCache?: SharedAudioAnalysisCache;
}) {
  const decodedAudioCache = sharedCache?.decodedAudio ?? new Map<string, Promise<DecodedAudioData>>();
  const spectrumCache = sharedCache?.spectrum ?? new Map<string, Promise<SceneAudioAnalysisResult>>();

  return {
    path: audioPath,
    async getSpectrum(request: SceneAudioAnalysisRequest): Promise<SceneAudioAnalysisResult> {
      const cacheKey = JSON.stringify({
        audioPath,
        request,
        videoFps: video.fps,
        durationMs: video.durationMs,
        durationInFrames: video.durationInFrames
      });

      const cached = spectrumCache.get(cacheKey);
      if (cached) {
        logger.info(`Reusing cached equalizer spectrum for ${request.bandCount} bands at ${request.analysisFps}fps.`);
        return await cached;
      }

      const nextAnalysis = analyzeAudioSpectrum({
        audioPath,
        request,
        video,
        signal,
        logger,
        decodeAudio: async (path, sampleRate, analysisSignal) => {
          const decodedAudioKey = `${path}::${sampleRate}`;
          let decodedAudio = decodedAudioCache.get(decodedAudioKey);
          if (!decodedAudio) {
            decodedAudio = decodeAudio(path, sampleRate, analysisSignal);
            decodedAudioCache.set(decodedAudioKey, decodedAudio);
          }

          return await decodedAudio;
        }
      });

      spectrumCache.set(cacheKey, nextAnalysis);
      return await nextAnalysis;
    }
  };
}

export async function analyzeAudioSpectrum({
  audioPath,
  request,
  video,
  signal,
  logger,
  decodeAudio = decodeAudioFileToMono
}: {
  audioPath: string;
  request: SceneAudioAnalysisRequest;
  video: VideoSettings;
  signal?: AbortSignal;
  logger: AudioAnalysisLogger;
  decodeAudio?: AudioDecodeFunction;
}): Promise<SceneAudioAnalysisResult> {
  const decodedAudio = await decodeAudio(audioPath, DEFAULT_SAMPLE_RATE, signal);
  const analysisFrames = computeSpectrumFrames(decodedAudio, request, video.durationMs);
  const frameAlignedValues = resampleSpectrumFrames(analysisFrames, request.analysisFps, video);

  logger.info(
    `Computed equalizer spectrum with ${request.bandCount} bands across ${frameAlignedValues.length} render frames.`
  );

  return {
    fps: video.fps,
    frameCount: video.durationInFrames,
    bandCount: request.bandCount,
    values: frameAlignedValues
  };
}

export async function decodeAudioFileToMono(
  audioPath: string,
  sampleRate: number,
  signal?: AbortSignal
): Promise<DecodedAudioData> {
  const pcmBody = await runBinaryCommand(
    "ffmpeg",
    [
      "-v",
      "error",
      "-i",
      audioPath,
      "-ac",
      "1",
      "-ar",
      String(sampleRate),
      "-f",
      "f32le",
      "-"
    ],
    signal
  );

  const byteOffset = pcmBody.byteOffset;
  const byteLength = pcmBody.byteLength;
  const samples = new Float32Array(
    pcmBody.buffer.slice(byteOffset, byteOffset + byteLength)
  );

  return {
    sampleRate,
    durationMs: Math.round((samples.length / sampleRate) * 1000),
    samples
  };
}

function computeSpectrumFrames(
  decodedAudio: DecodedAudioData,
  request: SceneAudioAnalysisRequest,
  durationMs: number
) {
  const analysisFrameCount = Math.max(1, Math.ceil((durationMs / 1000) * request.analysisFps));
  const windowSize = getWindowSize(decodedAudio.sampleRate, request.analysisFps);
  const window = createHannWindow(windowSize);
  const frequencies = createBandFrequencies(
    request.bandCount,
    request.minFrequency,
    request.maxFrequency,
    request.bandDistribution
  );
  const windowSamples = new Float32Array(windowSize);
  const rawFrames = new Array<number[]>(analysisFrameCount);

  for (let frameIndex = 0; frameIndex < analysisFrameCount; frameIndex += 1) {
    const centerSample = Math.round((frameIndex / request.analysisFps) * decodedAudio.sampleRate);
    copyWindowSamples(decodedAudio.samples, centerSample, window, windowSamples);

    rawFrames[frameIndex] = frequencies.map((frequency) =>
      getGoertzelMagnitude(windowSamples, frequency, decodedAudio.sampleRate)
    );
  }

  return normalizeSpectrumFrames(rawFrames, request);
}

function normalizeSpectrumFrames(
  rawFrames: number[][],
  request: SceneAudioAnalysisRequest
) {
  const globalMax = rawFrames.reduce(
    (currentMax, frame) => Math.max(currentMax, ...frame),
    0
  );
  const floorRatio = clamp01(request.silenceFloor / 100);
  const floorValue = globalMax * floorRatio;
  const range = Math.max(globalMax - floorValue, Number.EPSILON);
  const smoothingRatio = clamp01(request.smoothing / 100);
  const frameDurationMs = 1000 / request.analysisFps;
  const nextFrames = new Array<number[]>(rawFrames.length);
  const previous = new Array<number>(request.bandCount).fill(0);

  for (let frameIndex = 0; frameIndex < rawFrames.length; frameIndex += 1) {
    const frame = rawFrames[frameIndex];
    const normalizedFrame = new Array<number>(frame.length);

    for (let bandIndex = 0; bandIndex < frame.length; bandIndex += 1) {
      const normalized = clamp01(((frame[bandIndex] - floorValue) / range) * request.sensitivity);
      const previousValue = previous[bandIndex];
      const responseFactor = normalized >= previousValue
        ? getResponseFactor(frameDurationMs, request.attackMs)
        : getResponseFactor(frameDurationMs, request.releaseMs);
      const combinedFactor = Math.max(responseFactor, 1 - smoothingRatio);
      const value = previousValue + (normalized - previousValue) * combinedFactor;

      normalizedFrame[bandIndex] = clamp01(value);
      previous[bandIndex] = normalizedFrame[bandIndex];
    }

    nextFrames[frameIndex] = normalizedFrame;
  }

  return nextFrames;
}

function resampleSpectrumFrames(
  analysisFrames: number[][],
  analysisFps: number,
  video: VideoSettings
) {
  const resampledFrames = new Array<number[]>(video.durationInFrames);

  for (let frameIndex = 0; frameIndex < video.durationInFrames; frameIndex += 1) {
    const analysisPosition = (frameIndex / video.fps) * analysisFps;
    const leftIndex = Math.max(0, Math.min(analysisFrames.length - 1, Math.floor(analysisPosition)));
    const rightIndex = Math.max(0, Math.min(analysisFrames.length - 1, Math.ceil(analysisPosition)));
    const blend = analysisPosition - leftIndex;
    const leftFrame = analysisFrames[leftIndex];
    const rightFrame = analysisFrames[rightIndex];
    const nextFrame = new Array<number>(leftFrame.length);

    for (let bandIndex = 0; bandIndex < leftFrame.length; bandIndex += 1) {
      nextFrame[bandIndex] = interpolate(leftFrame[bandIndex], rightFrame[bandIndex], blend);
    }

    resampledFrames[frameIndex] = nextFrame;
  }

  return resampledFrames;
}

function copyWindowSamples(
  samples: Float32Array,
  centerSample: number,
  window: Float32Array,
  target: Float32Array
) {
  const halfWindow = Math.floor(window.length / 2);

  for (let index = 0; index < window.length; index += 1) {
    const sampleIndex = centerSample - halfWindow + index;
    const sampleValue =
      sampleIndex >= 0 && sampleIndex < samples.length ? samples[sampleIndex] : 0;
    target[index] = sampleValue * window[index];
  }
}

function getGoertzelMagnitude(
  samples: Float32Array,
  frequency: number,
  sampleRate: number
) {
  const bucket = Math.max(1, Math.round((samples.length * frequency) / sampleRate));
  const omega = (2 * Math.PI * bucket) / samples.length;
  const coefficient = 2 * Math.cos(omega);
  let previous = 0;
  let previousPrevious = 0;

  for (let index = 0; index < samples.length; index += 1) {
    const next = samples[index] + coefficient * previous - previousPrevious;
    previousPrevious = previous;
    previous = next;
  }

  const power =
    previousPrevious * previousPrevious +
    previous * previous -
    coefficient * previous * previousPrevious;

  return Math.sqrt(Math.max(power, 0)) / samples.length;
}

function createBandFrequencies(
  bandCount: number,
  minFrequency: number,
  maxFrequency: number,
  distribution: SceneAudioAnalysisRequest["bandDistribution"]
) {
  const safeMinFrequency = Math.max(20, minFrequency);
  const safeMaxFrequency = Math.max(safeMinFrequency + 1, maxFrequency);

  return Array.from({ length: bandCount }, (_, index) => {
    if (bandCount === 1) {
      return (safeMinFrequency + safeMaxFrequency) / 2;
    }

    const progress = index / (bandCount - 1);
    if (distribution === "log") {
      return safeMinFrequency * Math.pow(safeMaxFrequency / safeMinFrequency, progress);
    }

    return interpolate(safeMinFrequency, safeMaxFrequency, progress);
  });
}

function getWindowSize(sampleRate: number, analysisFps: number) {
  const targetSize = Math.max(256, Math.round((sampleRate / analysisFps) * 2));
  const nextPowerOfTwo = 2 ** Math.ceil(Math.log2(targetSize));
  return Math.max(256, Math.min(4096, nextPowerOfTwo));
}

function createHannWindow(size: number) {
  const window = new Float32Array(size);

  for (let index = 0; index < size; index += 1) {
    window[index] = 0.5 * (1 - Math.cos((2 * Math.PI * index) / (size - 1)));
  }

  return window;
}

function getResponseFactor(frameDurationMs: number, responseMs: number) {
  if (responseMs <= 0) {
    return 1;
  }

  return clamp01(frameDurationMs / responseMs);
}

function interpolate(left: number, right: number, blend: number) {
  return left + (right - left) * clamp01(blend);
}

function clamp01(value: number) {
  return Math.max(0, Math.min(1, value));
}

async function runBinaryCommand(
  command: string,
  args: string[],
  signal?: AbortSignal
): Promise<Buffer> {
  return await new Promise<Buffer>((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: ["ignore", "pipe", "pipe"]
    });

    const stdout: Buffer[] = [];
    const stderr: Buffer[] = [];

    const abortHandler = () => {
      child.kill();
      reject(createAbortError());
    };

    signal?.addEventListener("abort", abortHandler, { once: true });

    child.stdout.on("data", (chunk) => stdout.push(Buffer.from(chunk)));
    child.stderr.on("data", (chunk) => stderr.push(Buffer.from(chunk)));
    child.on("error", (error) => {
      signal?.removeEventListener("abort", abortHandler);
      reject(error);
    });
    child.on("close", (code) => {
      signal?.removeEventListener("abort", abortHandler);
      if (code === 0) {
        resolve(Buffer.concat(stdout));
        return;
      }

      reject(
        new Error(
          `${command} exited with code ${code}: ${Buffer.concat(stderr).toString("utf8").trim()}`
        )
      );
    });
  });
}

function createAbortError() {
  return new DOMException("The operation was aborted.", "AbortError");
}
