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

/**
 * Build the Video component browser-side initial state. Mounts an inner
 * <video> element preloaded for programmatic playback (muted, preload
 * auto), wraps it in a positioned/clipped/effect-filtered container.
 *
 * The video element starts paused — the per-frame state handler in
 * live-dom.ts seeks it to the desired position each frame via the
 * shared __syncVideoElement helper, blocking capture until the seek
 * settles (T-044 / video-frame-sync R3).
 */
export function buildVideoInitialState(
  options: VideoComponentOptions,
  video: VideoSettings,
  resolvedUrl: string | null
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

  const html = resolvedUrl ? buildInnerMarkup(options, resolvedUrl) : "";
  const initialOpacity = (options.opacity / 100) * computeTimingOpacity(0, options);

  return {
    html,
    containerStyle,
    initialOpacity,
    sourceUrl: resolvedUrl
  };
}

function buildInnerMarkup(options: VideoComponentOptions, url: string): string {
  const fitMode = options.fitMode;
  const filter = buildVideoFilter(options);
  const muted = options.muted ? " muted" : "";
  const video = `<video src="${escapeAttr(url)}" preload="auto" playsinline${muted} style="position:absolute;inset:0;width:100%;height:100%;object-fit:${fitMode};${filter ? `filter:${filter};` : ""}"></video>`;
  const tint = options.tintEnabled
    ? `<div style="position:absolute;inset:0;background:${withAlpha(options.tintColor, options.tintStrength / 100)};mix-blend-mode:multiply;"></div>`
    : "";
  return `${video}${tint}`;
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

function escapeAttr(value: string): string {
  return value.replace(/"/g, "&quot;");
}
