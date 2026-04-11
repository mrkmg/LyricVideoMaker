import type { TimingOptions } from "../../shared";
import type { VideoComponentOptions, VideoPlaybackMode } from "./options";

/**
 * Output of the per-frame playback math (cavekit-video-component R7).
 */
export interface VideoPlaybackState {
  /** Desired playback position in the video file, in seconds. */
  targetTimeSeconds: number;
  /** When true the component should render nothing this frame. */
  hidden: boolean;
}

export interface VideoPlaybackInputs {
  options: Pick<
    VideoComponentOptions,
    "playbackMode" | "videoStartOffsetMs" | "playbackSpeed"
  > & {
    startTime: TimingOptions["startTime"];
  };
  durationMs: number;
  timeMs: number;
}

/**
 * Compute the desired video playback position given the current song
 * time and component options. Pure function — playback math uses the
 * pre-probed duration and never re-probes per frame.
 *
 * Modes:
 *   - sync-with-song: linear advance from videoStartOffset, scaled by
 *                     playback speed, clamped to duration.
 *   - loop:           same value modulo duration so it wraps.
 *   - play-once-clamp: plays once, holds the last frame after end.
 *   - play-once-hide:  plays once, hides after end.
 *
 * Before component start time the timing helper has already hidden the
 * component (the runtime will not call this function in that case).
 */
export function computeVideoPlaybackState(inputs: VideoPlaybackInputs): VideoPlaybackState {
  const { options, durationMs, timeMs } = inputs;
  const elapsedSinceStart = Math.max(0, timeMs - options.startTime);
  const offsetSeconds = options.videoStartOffsetMs / 1000;
  const durationSeconds = durationMs / 1000;
  const advanced = (elapsedSinceStart / 1000) * options.playbackSpeed + offsetSeconds;

  switch (options.playbackMode) {
    case "sync-with-song": {
      return {
        targetTimeSeconds: clamp(advanced, 0, Math.max(0, durationSeconds)),
        hidden: false
      };
    }
    case "loop": {
      const span = durationSeconds - offsetSeconds;
      if (span <= 0) {
        return { targetTimeSeconds: offsetSeconds, hidden: false };
      }
      const wrapped = ((elapsedSinceStart / 1000) * options.playbackSpeed) % span;
      return {
        targetTimeSeconds: offsetSeconds + (wrapped < 0 ? wrapped + span : wrapped),
        hidden: false
      };
    }
    case "play-once-clamp": {
      if (advanced >= durationSeconds) {
        // Hold last frame.
        return { targetTimeSeconds: Math.max(0, durationSeconds - 1 / 60), hidden: false };
      }
      return { targetTimeSeconds: clamp(advanced, 0, durationSeconds), hidden: false };
    }
    case "play-once-hide": {
      if (advanced >= durationSeconds) {
        return { targetTimeSeconds: 0, hidden: true };
      }
      return { targetTimeSeconds: clamp(advanced, 0, durationSeconds), hidden: false };
    }
    default: {
      return { targetTimeSeconds: 0, hidden: false };
    }
  }
}

function clamp(value: number, lo: number, hi: number): number {
  if (value <= lo) return lo;
  if (value >= hi) return hi;
  return value;
}

export const VIDEO_PLAYBACK_MODES = [
  "sync-with-song",
  "loop",
  "play-once-clamp",
  "play-once-hide"
] satisfies VideoPlaybackMode[];
