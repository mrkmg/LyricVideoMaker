import {
  DEFAULT_VIDEO_FPS,
  DEFAULT_VIDEO_HEIGHT,
  DEFAULT_VIDEO_WIDTH
} from "@lyric-video-maker/core";
import type { ComposerState } from "../composer-types";
import { FPS_PRESETS, VIDEO_SIZE_PRESETS } from "../app-utils";
import { NumberField, SelectField } from "./form-fields";

export function VideoSettingsPanel({
  video,
  selectedVideoSizePresetId,
  selectedFpsPresetId,
  onVideoSizePresetChange,
  onFpsPresetChange,
  onWidthChange,
  onHeightChange,
  onFpsChange
}: {
  video: ComposerState["video"];
  selectedVideoSizePresetId: string;
  selectedFpsPresetId: string;
  onVideoSizePresetChange: (presetId: string) => void;
  onFpsPresetChange: (presetId: string) => void;
  onWidthChange: (value: number) => void;
  onHeightChange: (value: number) => void;
  onFpsChange: (value: number) => void;
}) {
  return (
    <section className="panel">
      <div className="panel-header">
        <div>
          <p className="eyebrow">Video</p>
          <h2>Video parameters</h2>
        </div>
      </div>

      <div className="video-param-grid">
        <SelectField
          label="Size preset"
          value={selectedVideoSizePresetId}
          options={[
            { value: "custom", label: "Custom" },
            ...VIDEO_SIZE_PRESETS.map((preset) => ({ value: preset.id, label: preset.label }))
          ]}
          onChange={onVideoSizePresetChange}
        />
        <SelectField
          label="FPS preset"
          value={selectedFpsPresetId}
          options={[
            { value: "custom", label: "Custom" },
            ...FPS_PRESETS.map((preset) => ({ value: preset.id, label: preset.label }))
          ]}
          onChange={onFpsPresetChange}
        />
        <NumberField
          label="Width"
          value={video.width}
          min={16}
          step={1}
          onChange={onWidthChange}
        />
        <NumberField
          label="Height"
          value={video.height}
          min={16}
          step={1}
          onChange={onHeightChange}
        />
        <NumberField
          label="Frame rate"
          value={video.fps}
          min={1}
          step={1}
          onChange={onFpsChange}
        />
      </div>

      <p className="video-param-hint">
        Default render target is {DEFAULT_VIDEO_WIDTH}x{DEFAULT_VIDEO_HEIGHT} at {DEFAULT_VIDEO_FPS}{" "}
        fps.
      </p>
    </section>
  );
}
