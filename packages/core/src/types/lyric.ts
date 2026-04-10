export interface LyricCue {
  index: number;
  startMs: number;
  endMs: number;
  text: string;
  lines: string[];
}

export interface LyricRuntime {
  cues: LyricCue[];
  current: LyricCue | null;
  next: LyricCue | null;
  getCueAt(ms: number): LyricCue | null;
  getNextCue(ms: number): LyricCue | null;
  getCuesInRange(startMs: number, endMs: number): LyricCue[];
  getCueProgress(cue: LyricCue, ms: number): number;
}

export interface BrowserLyricRuntime {
  current: LyricCue | null;
  next: LyricCue | null;
}
