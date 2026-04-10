import type { StartSubtitleGenerationRequest } from "../electron-api";

export function createInitialSubtitleGenerationRequest(): StartSubtitleGenerationRequest {
  return {
    mode: "transcribe",
    audioPath: "",
    outputPath: "",
    language: "auto"
  };
}

export function canStartSubtitleGeneration(
  audioPath: string,
  request: StartSubtitleGenerationRequest
) {
  if (!audioPath) {
    return false;
  }

  if (request.mode === "align") {
    return Boolean(request.lyricsTextPath && request.language && request.language !== "auto");
  }

  return true;
}
