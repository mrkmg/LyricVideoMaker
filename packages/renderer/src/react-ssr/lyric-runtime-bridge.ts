import type { BrowserLyricRuntime } from "@lyric-video-maker/core";

export function toBrowserLyricRuntime(
  lyrics: Pick<BrowserLyricRuntime, "current" | "next">
): BrowserLyricRuntime {
  return {
    current: lyrics.current,
    next: lyrics.next
  };
}
