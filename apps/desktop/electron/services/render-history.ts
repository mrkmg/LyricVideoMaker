import type { RenderHistoryEntry } from "@lyric-video-maker/core";

export interface RenderHistory {
  get(jobId: string): RenderHistoryEntry | undefined;
  upsert(entry: RenderHistoryEntry): void;
  list(): RenderHistoryEntry[];
}

export function createRenderHistory(): RenderHistory {
  const history = new Map<string, RenderHistoryEntry>();
  return {
    get(jobId) {
      return history.get(jobId);
    },
    upsert(entry) {
      history.set(entry.id, entry);
    },
    list() {
      return [...history.values()].sort((left, right) =>
        right.createdAt.localeCompare(left.createdAt)
      );
    }
  };
}
