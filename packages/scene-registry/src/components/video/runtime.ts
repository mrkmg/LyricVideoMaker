import type { VideoSettings } from "@lyric-video-maker/core";
import { computeTransformStyle } from "../../shared/transform-runtime";
import { computeTimingOpacity } from "../../shared/timing-runtime";
import { withAlpha } from "../../shared/color";
import type { VideoComponentOptions } from "./options";

export interface VideoInitialState {
  html: string;
  containerStyle: Record<string, string>;
  initialOpacity: number;
  sourceUrl: string | null;
}

export interface VideoFrameExtractionMetadata {
  mode: "image-sequence";
  urlPrefix: string;
  outputFps: number;
  frameCount: number;
}

/**
 * Build Video component browser-side initial state. Runtime uses extracted
 * JPEG frame files, not HTMLVideoElement seeking.
 */
export function buildVideoInitialState(
  options: VideoComponentOptions,
  video: VideoSettings,
  _resolvedUrl: string | null,
  frameExtraction?: VideoFrameExtractionMetadata | null
): VideoInitialState {
  const transformStyle = computeTransformStyle(options, {
    width: video.width,
    height: video.height
  });
  const containerStyle: Record<string, string> = {};
  for (const [key, value] of Object.entries(transformStyle)) {
    if (value !== undefined && value !== null) {
      containerStyle[key] = String(value);
    }
  }
  containerStyle.borderRadius = `${options.cornerRadius}px`;
  containerStyle.overflow = "hidden";
  if (options.borderEnabled && options.borderThickness > 0) {
    containerStyle.border = `${options.borderThickness}px solid ${options.borderColor}`;
    containerStyle.boxSizing = "border-box";
  }
  const shadowFilter = buildShadowGlow(options);
  if (shadowFilter !== "none") {
    containerStyle.filter = shadowFilter;
  }

  const html = frameExtraction ? buildImageSequenceMarkup(options) : "";
  const initialOpacity = (options.opacity / 100) * computeTimingOpacity(0, options);

  return {
    html,
    containerStyle,
    initialOpacity,
    sourceUrl: frameExtraction ? frameExtraction.urlPrefix : null
  };
}

function buildImageSequenceMarkup(options: VideoComponentOptions): string {
  const fitMode = options.fitMode;
  const filter = buildVideoFilter(options);
  const image = `<img data-video-frame="" alt="" style="position:absolute;inset:0;width:100%;height:100%;object-fit:${fitMode};${filter ? `filter:${filter};` : ""}" />`;
  const tint = options.tintEnabled
    ? `<div style="position:absolute;inset:0;background:${withAlpha(options.tintColor, options.tintStrength / 100)};mix-blend-mode:multiply;"></div>`
    : "";
  return `${image}${tint}`;
}

function buildVideoFilter(options: VideoComponentOptions): string {
  const parts: string[] = [];
  if (options.grayscale > 0) parts.push(`grayscale(${options.grayscale / 100})`);
  if (options.blur > 0) parts.push(`blur(${options.blur}px)`);
  if (options.brightness !== 100) parts.push(`brightness(${options.brightness / 100})`);
  if (options.contrast !== 100) parts.push(`contrast(${options.contrast / 100})`);
  if (options.saturation !== 100) parts.push(`saturate(${options.saturation / 100})`);
  return parts.join(" ");
}

function buildShadowGlow(options: VideoComponentOptions): string {
  const parts: string[] = [];
  if (options.shadowEnabled) {
    parts.push(
      `drop-shadow(${options.shadowOffsetX}px ${options.shadowOffsetY}px ${options.shadowBlur}px ${options.shadowColor})`
    );
  }
  if (options.glowEnabled) {
    parts.push(`drop-shadow(0 0 ${options.glowStrength}px ${options.glowColor})`);
  }
  return parts.join(" ") || "none";
}
