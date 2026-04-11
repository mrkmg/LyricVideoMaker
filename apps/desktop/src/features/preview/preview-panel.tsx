import React, { type CSSProperties } from "react";
import { durationMsToFrameCount } from "@lyric-video-maker/core";
import type { ComposerState } from "../../state/composer-types";
import { InfoTip } from "../../components/ui/form-fields";
import { useFramePreview } from "../../hooks/use-frame-preview";

export function PreviewPanel({
  paused,
  composer,
  profilerEnabled = false
}: {
  composer: ComposerState;
  paused: boolean;
  profilerEnabled?: boolean;
}) {
  const { enabled, preview, updatePreviewTime, noteImagePainted } = useFramePreview({
    composer,
    paused,
    profilerEnabled
  });
  const video = composer.video;
  const frameCount = preview.result
    ? durationMsToFrameCount(preview.result.durationMs, video.fps)
    : 0;
  const rangeMax = Math.max(preview.result?.durationMs ?? 0, 0);
  const sliderValue = Math.min(preview.requestedTimeMs, rangeMax || preview.requestedTimeMs);
  const emptyStateMessage = !enabled
    ? "Pick audio and subtitle files to enable frame preview."
    : paused
      ? "Preview paused while a full render is active."
      : preview.isLoading
        ? "Rendering preview frame..."
        : "Preview will appear here.";

  return (
    <section className="panel preview-panel">
      <div className="panel-header">
        <div>
          <p className="eyebrow">Preview</p>
          <div className="panel-title-row">
            <h2>Frame Preview</h2>
            <InfoTip text="Scrub a single rendered frame before starting a full render." />
          </div>
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

      <div className="preview-main">
        <div
          className={`preview-stage-shell${preview.result?.imageUrl ? "" : " is-empty"}`}
          style={
            {
              "--preview-aspect-ratio": `${video.width} / ${video.height}`
            } as CSSProperties
          }
        >
          {preview.result?.imageUrl ? (
            <img
              className="preview-image"
              src={preview.result.imageUrl}
              alt="Single-frame scene preview"
              onLoad={noteImagePainted}
            />
          ) : (
            <div className="preview-empty">{emptyStateMessage}</div>
          )}
          {preview.isLoading && enabled ? (
            <div className="preview-loading">Refreshing preview...</div>
          ) : null}
        </div>

        <div className="preview-jump-rail">
          <button
            className="secondary"
            disabled={paused || !enabled}
            onClick={() => updatePreviewTime(0)}
          >
            Start
          </button>
          <button
            className="secondary"
            disabled={paused || !preview.result?.previousCue}
            onClick={() => updatePreviewTime(preview.result?.previousCue?.startMs ?? 0)}
          >
            Previous Cue
          </button>
          <button
            className="secondary"
            disabled={paused || !preview.result?.currentCue}
            onClick={() => updatePreviewTime(preview.result?.currentCue?.startMs ?? 0)}
          >
            Current Cue
          </button>
          <button
            className="secondary"
            disabled={paused || !preview.result?.nextCue}
            onClick={() => updatePreviewTime(preview.result?.nextCue?.startMs ?? 0)}
          >
            Next Cue
          </button>
          <button
            className="secondary"
            disabled={paused || !preview.result}
            onClick={() => updatePreviewTime(preview.result?.durationMs ?? 0)}
          >
            End
          </button>
        </div>
      </div>

      <div className="preview-controls">
        {paused ? (
          <p className="video-param-hint">Preview is paused while the render is running.</p>
        ) : null}
        {preview.error ? <p className="error-banner">{preview.error}</p> : null}

        <label className="field preview-scrubber">
          <input
            type="range"
            min={0}
            max={rangeMax}
            step={Math.max(1, Math.round(1000 / video.fps))}
            value={sliderValue}
            disabled={!enabled || paused || rangeMax <= 0}
            onChange={(event) => updatePreviewTime(Number(event.target.value))}
          />
        </label>
      </div>
    </section>
  );
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
