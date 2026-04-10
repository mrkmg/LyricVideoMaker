import type { LyricCue, LyricRuntime } from "../types/lyric";
import { getCueAt, getCueProgress, getCuesInRange, getNextCue } from "./cue-lookup";

export function createLyricRuntime(cues: LyricCue[], timeMs = 0): LyricRuntime {
  return {
    cues,
    current: getCueAt(cues, timeMs),
    next: getNextCue(cues, timeMs),
    getCueAt: (ms) => getCueAt(cues, ms),
    getNextCue: (ms) => getNextCue(cues, ms),
    getCuesInRange: (startMs, endMs) => getCuesInRange(cues, startMs, endMs),
    getCueProgress: (cue, ms) => getCueProgress(cue, ms)
  };
}

export interface LyricRuntimeCursor {
  getRuntimeAt(ms: number): LyricRuntime;
}

export function createLyricRuntimeCursor(
  cues: LyricCue[],
  initialMs = 0
): LyricRuntimeCursor {
  let lastMs = Number.NEGATIVE_INFINITY;
  let cursorIndex = 0;

  sync(initialMs);

  return {
    getRuntimeAt(ms) {
      sync(ms);

      const candidateCue = cursorIndex < cues.length ? cues[cursorIndex] : null;
      const currentCue =
        candidateCue && ms >= candidateCue.startMs && ms < candidateCue.endMs ? candidateCue : null;
      const nextIndex = currentCue ? cursorIndex + 1 : cursorIndex;
      const nextCue = nextIndex < cues.length ? cues[nextIndex] : null;

      return {
        cues,
        current: currentCue,
        next: nextCue,
        getCueAt: (targetMs) => getCueAt(cues, targetMs),
        getNextCue: (targetMs) => getNextCue(cues, targetMs),
        getCuesInRange: (startMs, endMs) => getCuesInRange(cues, startMs, endMs),
        getCueProgress: (cue, targetMs) => getCueProgress(cue, targetMs)
      };
    }
  };

  function sync(ms: number) {
    if (ms < lastMs) {
      cursorIndex = 0;
    }

    while (cursorIndex < cues.length && cues[cursorIndex].endMs <= ms) {
      cursorIndex += 1;
    }

    lastMs = ms;
  }
}
