export function msToFrame(ms: number, fps: number): number {
  const raw = (ms / 1000) * fps;
  const rounded = Math.round(raw);
  // Snap to nearest integer when within floating-point epsilon to prevent
  // round-trip drift (frameToMs → msToFrame returning frame - 1).
  // Otherwise floor, preserving "frame at time T" semantics for arbitrary ms.
  const frame = Math.abs(raw - rounded) < 1e-9 ? rounded : Math.floor(raw);
  return Math.max(0, frame);
}

export function frameToMs(frame: number, fps: number): number {
  return (frame / fps) * 1000;
}

export function durationMsToFrameCount(durationMs: number, fps: number): number {
  return Math.max(1, Math.ceil((durationMs / 1000) * fps));
}
