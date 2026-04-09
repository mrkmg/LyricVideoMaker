import React from "react";
import type { ComposerState } from "../composer-types";
import type { FilePickKind } from "../electron-api";
import { FileField, NumberField, SelectField } from "./form-fields";

export function GeneralDetailsEditor({
  composer,
  selectedVideoSizePresetId,
  selectedFpsPresetId,
  error,
  isSubmitting,
  hasActiveRender,
  onPickPath,
  onVideoSizePresetChange,
  onFpsPresetChange,
  onWidthChange,
  onHeightChange,
  onFpsChange,
  onSubmit
}: {
  composer: ComposerState;
  selectedVideoSizePresetId: string;
  selectedFpsPresetId: string;
  error: string;
  isSubmitting: boolean;
  hasActiveRender: boolean;
  onPickPath: (kind: FilePickKind) => void;
  onVideoSizePresetChange: (presetId: string) => void;
  onFpsPresetChange: (presetId: string) => void;
  onWidthChange: (value: number) => void;
  onHeightChange: (value: number) => void;
  onFpsChange: (value: number) => void;
  onSubmit: () => void | Promise<void>;
}) {
  return (
    <section className="panel inspector-panel">
      <div className="panel-header">
        <div>
          <p className="eyebrow">Inspector</p>
          <h2>General</h2>
        </div>
      </div>

      <div className="inspector-layout">
        <section className="inspector-section">
          <div className="inspector-section-header">
            <h3>Files</h3>
            <p>Choose the song, subtitles, and output target for this render.</p>
          </div>

          <div className="inspector-grid inspector-grid-three">
            <FileField
              label="Song audio"
              value={composer.audioPath}
              buttonLabel="Pick MP3"
              onPick={() => onPickPath("audio")}
            />
            <FileField
              label="Lyric subtitles"
              value={composer.subtitlePath}
              buttonLabel="Pick SRT"
              onPick={() => onPickPath("subtitle")}
            />
            <FileField
              label="Output MP4"
              value={composer.outputPath}
              buttonLabel="Save As"
              onPick={() => onPickPath("output")}
            />
          </div>
        </section>

        <section className="inspector-section">
          <div className="inspector-section-header">
            <h3>Video Properties</h3>
            <p>Set the render size and frame rate for the final MP4.</p>
          </div>

          <div className="inspector-grid inspector-grid-five">
            <SelectField
              label="Size preset"
              value={selectedVideoSizePresetId}
              options={[
                { value: "custom", label: "Custom" },
                { value: "4k", label: "4K (3840x2160)" },
                { value: "2k", label: "2K (2560x1440)" },
                { value: "1080", label: "1080p (1920x1080)" },
                { value: "720", label: "720p (1280x720)" },
                { value: "1024-square", label: "1024 Square (1024x1024)" }
              ]}
              onChange={onVideoSizePresetChange}
            />
            <SelectField
              label="FPS preset"
              value={selectedFpsPresetId}
              options={[
                { value: "custom", label: "Custom" },
                { value: "15", label: "15 fps" },
                { value: "20", label: "20 fps" },
                { value: "30", label: "30 fps" },
                { value: "60", label: "60 fps" }
              ]}
              onChange={onFpsPresetChange}
            />
            <NumberField
              label="Width"
              value={composer.video.width}
              min={16}
              step={1}
              onChange={onWidthChange}
            />
            <NumberField
              label="Height"
              value={composer.video.height}
              min={16}
              step={1}
              onChange={onHeightChange}
            />
            <NumberField
              label="Frame rate"
              value={composer.video.fps}
              min={1}
              step={1}
              onChange={onFpsChange}
            />
          </div>
        </section>

        <section className="inspector-section render-action-section">
          <div className="inspector-section-header">
            <h3>Render</h3>
            <p>Start the MP4 render with the current files, scene, and video settings.</p>
          </div>

          {error ? <p className="error-banner">{error}</p> : null}

          <div className="render-action-row">
            <button
              type="button"
              className="primary render-submit-button"
              disabled={isSubmitting || hasActiveRender}
              onClick={onSubmit}
            >
              {isSubmitting || hasActiveRender ? "Rendering..." : "Render MP4"}
            </button>
          </div>
        </section>
      </div>
    </section>
  );
}
