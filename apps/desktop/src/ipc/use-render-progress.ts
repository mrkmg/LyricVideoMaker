import { useEffect } from "react";
import type { RenderProgressEvent } from "@lyric-video-maker/core";
import { lyricVideoApp } from "./lyric-video-app";

export function useRenderProgress(callback: (event: RenderProgressEvent) => void) {
  useEffect(() => lyricVideoApp.onRenderProgress(callback), [callback]);
}
