import React, { type CSSProperties } from "react";
import type { LyricCue, VideoSettings } from "@lyric-video-maker/core";
import { durationMsToFrameCount } from "@lyric-video-maker/core";
import type { FramePreviewState } from "../use-frame-preview";

export function PreviewPanel({
  video,
  preview,
  enabled,
  paused,
  onTimeChange
}: {
  video: Pick<VideoSettings, "width" | "height" | "fps">;
  preview: FramePreviewState;
  enabled: boolean;
  paused: boolean;
  onTimeChange: (timeMs: number) => void;
}) {
  const frameCount = preview.result
    ? durationMsToFrameCount(preview.result.durationMs, video.fps)
    : 0;
  const rangeMax = Math.max(preview.result?.durationMs ?? 0, 0);
  const sliderValue = Math.min(preview.requestedTimeMs, rangeMax || preview.requestedTimeMs);

  return (
    <section className="panel">
      <div className="panel-header">
        <div>
          <p className="eyebrow">Preview</p>
          <h2>Single-frame preview</h2>
        </div>
        <div className="preview-status-block">
          <span className="preview-timestamp">
            {formatTimestamp(preview.result?.timeMs ?? preview.requestedTimeMs)}
          </span>
          {preview.result ? (
            <span className="preview-frame-label">
              Frame {preview.result.frame + 1} of {frameCount}
            </span>
          ) : null}
        </div>
      </div>

      {!enabled ? (
        <div className="preview-empty">Pick audio and subtitle files to enable frame preview.</div>
      ) : (
        <>
          <div
            className="preview-stage"
            style={
              {
                "--preview-aspect-ratio": `${video.width} / ${video.height}`
              } as CSSProperties
            }
          >
            {preview.result?.imageDataUrl ? (
              <img
                className="preview-image"
                src={preview.result.imageDataUrl}
                alt="Single-frame scene preview"
              />
            ) : (
              <div className="preview-empty">
                {paused
                  ? "Preview paused while a full render is active."
                  : preview.isLoading
                    ? "Rendering preview frame..."
                    : "Preview will appear here."}
              </div>
            )}
            {preview.isLoading ? <div className="preview-loading">Refreshing preview...</div> : null}
          </div>

          {paused ? (
            <p className="video-param-hint">Preview is paused while the MP4 render is running.</p>
          ) : null}
          {preview.error ? <p className="error-banner">{preview.error}</p> : null}

          <div className="preview-controls">
            <label className="field preview-scrubber">
              <span>Timeline</span>
              <input
                type="range"
                min={0}
                max={rangeMax}
                step={Math.max(1, Math.round(1000 / video.fps))}
                value={sliderValue}
                disabled={!enabled || paused || rangeMax <= 0}
                onChange={(event) => onTimeChange(Number(event.target.value))}
              />
            </label>

            <div className="button-row preview-jumps">
              <button className="secondary" disabled={paused} onClick={() => onTimeChange(0)}>
                Start
              </button>
              <button
                className="secondary"
                disabled={paused || !preview.result?.previousCue}
                onClick={() => onTimeChange(preview.result?.previousCue?.startMs ?? 0)}
              >
                Previous Cue
              </button>
              <button
                className="secondary"
                disabled={paused || !preview.result?.currentCue}
                onClick={() => onTimeChange(preview.result?.currentCue?.startMs ?? 0)}
              >
                Current Cue
              </button>
              <button
                className="secondary"
                disabled={paused || !preview.result?.nextCue}
                onClick={() => onTimeChange(preview.result?.nextCue?.startMs ?? 0)}
              >
                Next Cue
              </button>
              <button
                className="secondary"
                disabled={paused || !preview.result}
                onClick={() => onTimeChange(preview.result?.durationMs ?? 0)}
              >
                End
              </button>
            </div>
          </div>

          <div className="preview-meta-grid">
            <PreviewCueCard label="Current Cue" cue={preview.result?.currentCue ?? null} />
            <PreviewCueCard label="Previous Cue" cue={preview.result?.previousCue ?? null} />
            <PreviewCueCard label="Next Cue" cue={preview.result?.nextCue ?? null} />
          </div>
        </>
      )}
    </section>
  );
}

function PreviewCueCard({
  label,
  cue
}: {
  label: string;
  cue: LyricCue | null;
}) {
  return (
    <div className="preview-meta-card">
      <span className="eyebrow">{label}</span>
      <strong>{getCueLabel(cue)}</strong>
      <p>{formatCueTimeRange(cue)}</p>
    </div>
  );
}

function getCueLabel(cue: LyricCue | null) {
  if (!cue) {
    return "No cue";
  }

  return cue.text.trim() || `Cue ${cue.index}`;
}

function formatCueTimeRange(cue: LyricCue | null) {
  if (!cue) {
    return "No lyric line at this position.";
  }

  return `${formatTimestamp(cue.startMs)} - ${formatTimestamp(cue.endMs)}`;
}

function formatTimestamp(timeMs: number) {
  const safeMs = Math.max(0, Math.round(timeMs));
  const totalSeconds = Math.floor(safeMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  const milliseconds = safeMs % 1000;
  return `${minutes}:${seconds.toString().padStart(2, "0")}.${Math.floor(milliseconds / 10)
    .toString()
    .padStart(2, "0")}`;
}
