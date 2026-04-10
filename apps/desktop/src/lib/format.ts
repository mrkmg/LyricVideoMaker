export function formatEta(etaMs: number) {
  const totalSeconds = Math.max(0, Math.round(etaMs / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}
