export function msToFrame(ms: number, fps: number): number {
  return Math.max(0, Math.floor((ms / 1000) * fps));
}

export function frameToMs(frame: number, fps: number): number {
  return (frame / fps) * 1000;
}

export function durationMsToFrameCount(durationMs: number, fps: number): number {
  return Math.max(1, Math.ceil((durationMs / 1000) * fps));
}
