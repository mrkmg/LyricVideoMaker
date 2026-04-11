import React from "react";
import type { SceneComponentDefinition } from "@lyric-video-maker/core";
import { computeTimingOpacity } from "../../shared/timing-runtime";
import {
  DEFAULT_VIDEO_OPTIONS,
  videoOptionsSchema,
  type VideoComponentOptions
} from "./options";
import { buildVideoInitialState } from "./runtime";
import {
  computeVideoPlaybackState,
  formatVideoFrameName,
  mapVideoPlaybackTimeToFrameNumber
} from "./playback";
import { prepareVideoComponent, type VideoPrepared } from "./prepare";

const VIDEO_FRAME_EXTRACTION_PREPARED_KEY = "__videoFrameExtraction";

/**
 * Video component (cavekit-video-component).
 *
 * Architecture:
 *   - Renderer extracts source video to JPEG frame files before Chromium
 *     workers mount the scene.
 *   - prepare phase probes duration / dimensions / frame rate via
 *     ffprobe (R5) so the per-frame playback math never re-probes.
 *   - Per-frame state maps playback time to extracted frame URL and
 *     returns __imageFrameSync consumed by live DOM image readiness.
 */
export const videoComponent: SceneComponentDefinition<VideoComponentOptions> = {
  id: "video",
  name: "Video",
  description:
    "Positioned video playback synchronized to the song timeline via extracted image frames.",
  staticWhenMarkupUnchanged: false,
  options: videoOptionsSchema,
  defaultOptions: DEFAULT_VIDEO_OPTIONS,
  getPrepareCacheKey: ({ instance, options, video, audioPath }) => {
    return `${instance.id}|${options.source}|${video.width}x${video.height}|${audioPath}`;
  },
  prepare: async (ctx) => prepareVideoComponent(ctx),
  browserRuntime: {
    runtimeId: "static-fx-layer",
    getInitialState({ instance, options, video, assets, prepared }) {
      const url = assets.getUrl(instance.id, "source");
      return buildVideoInitialState(
        options,
        video,
        url,
        getVideoFrameExtraction(prepared)
      ) as unknown as Record<string, unknown>;
    },
    getFrameState({ options, timeMs, video, prepared }) {
      const opacity = (options.opacity / 100) * computeTimingOpacity(timeMs, options);
      const probed = prepared as VideoPrepared | undefined;
      if (!probed || !probed.durationMs) {
        return { opacity };
      }

      // Before the component's start time the timing helper already
      // returns 0 — playback math is not evaluated.
      if (timeMs < options.startTime) {
        return { opacity: 0 };
      }

      const playback = computeVideoPlaybackState({
        options,
        durationMs: probed.durationMs,
        timeMs
      });
      if (playback.hidden) {
        return { opacity: 0 };
      }
      const frameExtraction = getVideoFrameExtraction(prepared);
      if (frameExtraction) {
        const frameNumber = mapVideoPlaybackTimeToFrameNumber({
          targetTimeSeconds: playback.targetTimeSeconds,
          fps: video.fps,
          frameCount: frameExtraction.frameCount
        });
        return {
          opacity,
          __imageFrameSync: {
            src: `${frameExtraction.urlPrefix}${formatVideoFrameName(frameNumber)}`,
            label: "video-component"
          }
        };
      }
      return { opacity };
    }
  },
  Component: ({ instance, options, video, assets, prepared }) => {
    const url = assets.getUrl(instance.id, "source");
    const initial = buildVideoInitialState(options, video, url, getVideoFrameExtraction(prepared));
    if (!initial.sourceUrl) {
      return null;
    }
    return (
      <div
        style={initial.containerStyle as React.CSSProperties}
        data-video-component=""
        dangerouslySetInnerHTML={{ __html: initial.html }}
      />
    );
  }
};

function getVideoFrameExtraction(prepared: Record<string, unknown>) {
  const metadata = prepared[VIDEO_FRAME_EXTRACTION_PREPARED_KEY];
  if (!metadata || typeof metadata !== "object") {
    return null;
  }

  const value = metadata as {
    mode?: unknown;
    urlPrefix?: unknown;
    outputFps?: unknown;
    frameCount?: unknown;
  };
  if (
    value.mode !== "image-sequence" ||
    typeof value.urlPrefix !== "string" ||
    typeof value.outputFps !== "number" ||
    typeof value.frameCount !== "number" ||
    value.frameCount <= 0
  ) {
    return null;
  }

  return {
    mode: "image-sequence" as const,
    urlPrefix: value.urlPrefix,
    outputFps: value.outputFps,
    frameCount: value.frameCount
  };
}
