import type { RenderHistoryEntry } from "@lyric-video-maker/core";
import { formatEta, getFileName } from "../app-utils";

export function RenderHistoryPanel({
  error,
  history,
  hasActiveRender,
  isSubmitting,
  onSubmit,
  onCancelRender
}: {
  error: string;
  history: RenderHistoryEntry[];
  hasActiveRender: boolean;
  isSubmitting: boolean;
  onSubmit: () => void | Promise<void>;
  onCancelRender: (jobId: string) => void | Promise<void>;
}) {
  return (
    <section className="panel">
      <div className="panel-header">
        <div>
          <p className="eyebrow">Render</p>
          <h2>Job control</h2>
        </div>
        <button className="primary" disabled={isSubmitting || hasActiveRender} onClick={onSubmit}>
          {isSubmitting || hasActiveRender ? "Rendering..." : "Render MP4"}
        </button>
      </div>

      {error ? <p className="error-banner">{error}</p> : null}

      <ul className="history-list">
        {history.length === 0 ? (
          <li className="history-empty">No renders yet.</li>
        ) : (
          history.map((entry) => {
            const active = ["queued", "preparing", "rendering", "muxing"].includes(entry.status);

            return (
              <li key={entry.id} className="history-item">
                <div className="history-meta">
                  <div>
                    <strong>{entry.sceneName}</strong>
                    <p>{getFileName(entry.outputPath)}</p>
                  </div>
                  <span className={`status status-${entry.status}`}>{entry.status}</span>
                </div>
                <p className="history-message">{entry.message}</p>
                <div className="progress-track">
                  <div
                    className="progress-value"
                    style={{ width: `${Math.max(0, Math.min(100, entry.progress))}%` }}
                  />
                </div>
                {entry.status === "rendering" ? (
                  <div className="history-stats">
                    <span>
                      {entry.renderFps ? `${entry.renderFps.toFixed(2)} fps` : "Measuring speed..."}
                    </span>
                    <span>
                      {entry.etaMs !== undefined
                        ? `ETA ${formatEta(entry.etaMs)}`
                        : "ETA calculating..."}
                    </span>
                  </div>
                ) : null}
                <div className="history-footer">
                  <span>{new Date(entry.createdAt).toLocaleString()}</span>
                  {active ? (
                    <button className="secondary danger" onClick={() => onCancelRender(entry.id)}>
                      Cancel
                    </button>
                  ) : null}
                </div>
                {entry.error ? <p className="history-error">{entry.error}</p> : null}
                {entry.logs && entry.logs.length > 0 ? (
                  <details className="history-logs">
                    <summary>Logs ({entry.logs.length})</summary>
                    <div className="history-log-list">
                      {entry.logs.map((log, index) => (
                        <div
                          key={`${log.timestamp}-${index}`}
                          className={`history-log history-log-${log.level}`}
                        >
                          <span>{new Date(log.timestamp).toLocaleTimeString()}</span>
                          <strong>{log.level}</strong>
                          <p>{log.message}</p>
                        </div>
                      ))}
                    </div>
                  </details>
                ) : null}
              </li>
            );
          })
        )}
      </ul>
    </section>
  );
}
