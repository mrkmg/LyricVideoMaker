import React from "react";
import type { RenderHistoryEntry } from "@lyric-video-maker/core";
import { formatEta } from "../../lib/format";
import { getFileName } from "../../lib/path-utils";

const ACTIVE_STATUSES = new Set(["queued", "preparing", "rendering", "muxing"]);

export function RenderProgressDialog({
  entry,
  isOpen,
  onCancelRender,
  onDismiss
}: {
  entry: RenderHistoryEntry | null;
  isOpen: boolean;
  onCancelRender: (jobId: string) => void | Promise<void>;
  onDismiss: () => void;
}) {
  if (!isOpen || !entry) {
    return null;
  }

  const isActive = ACTIVE_STATUSES.has(entry.status);

  return (
    <div className="dialog-backdrop" role="presentation">
      <div className="dialog-card" role="dialog" aria-modal="true" aria-labelledby="render-dialog-title">
        <div className="panel-header">
          <div>
            <p className="eyebrow">Render Progress</p>
            <h2 id="render-dialog-title">
              {isActive ? "Rendering MP4" : entry.status === "completed" ? "Render Complete" : "Render Status"}
            </h2>
          </div>
          <span className={`status status-${entry.status}`}>{entry.status}</span>
        </div>

        <div className="dialog-body">
          <div className="scene-status-card">
            <span className="eyebrow">Output</span>
            <strong>{getFileName(entry.outputPath) || "lyric-video.mp4"}</strong>
            <p>{entry.message}</p>
          </div>

          <div className="progress-track dialog-progress-track">
            <div
              className="progress-value"
              style={{ width: `${Math.max(0, Math.min(100, entry.progress))}%` }}
            />
          </div>

          <div className="history-stats">
            <span>{Math.round(entry.progress)}% complete</span>
            {entry.renderFps ? <span>{entry.renderFps.toFixed(2)} fps</span> : null}
            {entry.etaMs !== undefined ? <span>ETA {formatEta(entry.etaMs)}</span> : null}
          </div>

          {entry.error ? <p className="history-error">{entry.error}</p> : null}
        </div>

        <div className="dialog-actions">
          {isActive ? (
            <button type="button" className="secondary danger" onClick={() => onCancelRender(entry.id)}>
              Cancel Render
            </button>
          ) : (
            <button type="button" className="secondary" onClick={onDismiss}>
              Close
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
