import { availableParallelism } from "node:os";
import { normalizePositiveInteger } from "../constants";

export function resolveRenderParallelism({
  parallelism,
  totalFrames
}: {
  parallelism?: number;
  totalFrames: number;
}) {
  const requested =
    normalizePositiveInteger(parallelism) ??
    normalizePositiveInteger(process.env.LYRIC_VIDEO_RENDER_WORKERS) ??
    Math.min(8, Math.max(1, Math.floor(availableParallelism() - 1)));
  const maxWorkersFromFrames = Math.max(1, Math.floor(totalFrames / 2));

  return Math.max(1, Math.min(requested, totalFrames, maxWorkersFromFrames));
}
