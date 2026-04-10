export type SceneAudioBandDistribution = "linear" | "log";

export interface SceneAudioAnalysisRequest {
  bandCount: number;
  minFrequency: number;
  maxFrequency: number;
  analysisFps: number;
  sensitivity: number;
  smoothing: number;
  attackMs: number;
  releaseMs: number;
  silenceFloor: number;
  bandDistribution: SceneAudioBandDistribution;
}

export interface SceneAudioAnalysisResult {
  fps: number;
  frameCount: number;
  bandCount: number;
  values: number[][];
}
