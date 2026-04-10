import type { LyricCue } from "../types/lyric";

export function getCueAt(cues: LyricCue[], ms: number): LyricCue | null {
  return cues.find((cue) => ms >= cue.startMs && ms < cue.endMs) ?? null;
}

export function getNextCue(cues: LyricCue[], ms: number): LyricCue | null {
  return cues.find((cue) => cue.startMs > ms) ?? null;
}

export function getCuesInRange(cues: LyricCue[], startMs: number, endMs: number): LyricCue[] {
  return cues.filter((cue) => cue.endMs > startMs && cue.startMs < endMs);
}

export function getCueProgress(cue: LyricCue, ms: number): number {
  if (ms <= cue.startMs) {
    return 0;
  }

  if (ms >= cue.endMs) {
    return 1;
  }

  return (ms - cue.startMs) / (cue.endMs - cue.startMs);
}
