export function clamp01(value: number) {
  return Math.max(0, Math.min(1, value));
}

export function safeScale(value: number, baseline: number) {
  return value > 0 && baseline > 0 ? value / baseline : 1;
}
