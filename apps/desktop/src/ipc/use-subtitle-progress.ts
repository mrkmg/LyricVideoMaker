import { useEffect } from "react";
import type { SubtitleGenerationProgressEvent } from "../electron-api";
import { lyricVideoApp } from "./lyric-video-app";

export function useSubtitleProgress(
  callback: (event: SubtitleGenerationProgressEvent) => void
) {
  useEffect(() => lyricVideoApp.onSubtitleGenerationProgress(callback), [callback]);
}
