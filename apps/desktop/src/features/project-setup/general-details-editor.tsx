import React from "react";
import type { ComposerState } from "../../state/composer-types";
import type { FilePickKind } from "../../electron-api";
import { FileField, InfoTip, NumberField, SelectField } from "../../components/ui/form-fields";

export function GeneralDetailsEditor({
  composer,
  selectedVideoSizePresetId,
  selectedFpsPresetId,
  eyebrow = "General",
  className = "",
  error,
  isSubmitting,
  hasActiveRender,
  onPickPath,
  onOpenSubtitleGenerator,
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
  eyebrow?: string;
  className?: string;
  error: string;
  isSubmitting: boolean;
  hasActiveRender: boolean;
  onPickPath: (kind: FilePickKind) => void;
  onOpenSubtitleGenerator: () => void;
  onVideoSizePresetChange: (presetId: string) => void;
  onFpsPresetChange: (presetId: string) => void;
  onWidthChange: (value: number) => void;
  onHeightChange: (value: number) => void;
  onFpsChange: (value: number) => void;
  onSubmit: () => void | Promise<void>;
}) {
  return (
    <section className={`panel inspector-panel ${className}`.trim()}>
      <div className="panel-header">
        <div>
          <p className="eyebrow">{eyebrow}</p>
          <div className="panel-title-row">
            <h2>Project Setup</h2>
            <InfoTip text="Pick source files, set the output format, and start renders." />
          </div>
        </div>
      </div>

      <div className="general-editor-body">
        <div className="inspector-layout">
          <section className="inspector-section general-files-section">
            <div className="inspector-section-header">
              <div className="section-title-row">
                <h3>Files</h3>
                <InfoTip text="Choose the song, subtitles, and output target for this render." />
              </div>
            </div>

            <div className="inspector-grid inspector-grid-three general-files-grid">
              <FileField
                label="Song audio"
                helpText="Select the source MP3 for the lyric video."
                value={composer.audioPath}
                buttonLabel="Pick MP3"
                compact
                onPick={() => onPickPath("audio")}
              />
              <div className="field file-field file-field-compact subtitle-field">
                <span className="field-label">Lyric subtitles</span>
                <div
                  className={`file-pill${composer.subtitlePath.trim() ? "" : " is-empty"}`}
                  title={composer.subtitlePath.trim() ? composer.subtitlePath : "Not selected"}
                >
                  {composer.subtitlePath || "Not selected"}
                </div>
                <div className="subtitle-field-actions">
                  <button
                    type="button"
                    className="secondary"
                    onClick={() => onPickPath("subtitle")}
                  >
                    Pick SRT
                  </button>
                  <button
                    type="button"
                    className="secondary"
                    disabled={!composer.audioPath || isSubmitting || hasActiveRender}
                    onClick={onOpenSubtitleGenerator}
                  >
                    Generate SRT
                  </button>
                </div>
              </div>
              <FileField
                label="Output MP4"
                helpText="Choose where the rendered MP4 will be written."
                value={composer.outputPath}
                buttonLabel="Save As"
                compact
                onPick={() => onPickPath("output")}
              />
            </div>
          </section>

          <section className="inspector-section general-video-section">
            <div className="inspector-section-header">
              <div className="section-title-row">
                <h3>Video</h3>
                <InfoTip text="Set the render size and frame rate for the final MP4." />
              </div>
            </div>

            <div className="inspector-grid general-video-grid">
              <SelectField
                label="Size preset"
                helpText="Use a preset size or switch to custom dimensions."
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
                helpText="Use a common frame rate or switch to a custom value."
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
                helpText="Output video width in pixels."
                value={composer.video.width}
                min={16}
                step={1}
                onChange={onWidthChange}
              />
              <NumberField
                label="Height"
                helpText="Output video height in pixels."
                value={composer.video.height}
                min={16}
                step={1}
                onChange={onHeightChange}
              />
              <NumberField
                label="Frame rate"
                helpText="Frames rendered per second."
                value={composer.video.fps}
                min={1}
                step={1}
                onChange={onFpsChange}
              />
            </div>
          </section>
        </div>
      </div>

      <section className="inspector-section render-action-section general-render-section">
        <div className="inspector-section-header">
          <div className="section-title-row">
            <h3>Render</h3>
            <InfoTip text="Start the MP4 render with the current files, scene, and video settings." />
          </div>
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
    </section>
  );
}
