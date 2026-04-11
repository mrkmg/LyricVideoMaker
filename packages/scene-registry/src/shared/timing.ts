import type { SceneOptionCategory } from "@lyric-video-maker/core";

/**
 * Easing curves supported by the shared timing runtime helper.
 */
export type TimingEasing = "linear" | "ease-in" | "ease-out" | "ease-in-out";

export const TIMING_EASING_VALUES: readonly TimingEasing[] = [
  "linear",
  "ease-in",
  "ease-out",
  "ease-in-out"
] as const;

/**
 * Reusable timing options contract. All times are in milliseconds. An
 * `endTime` of zero is a sentinel meaning "run to the end of the song" — the
 * runtime helper treats the song as infinite in length when it encounters the
 * sentinel. This keeps defaults meaningful without knowing the song duration.
 */
export interface TimingOptions {
  /** Start time of visibility window, in milliseconds. */
  startTime: number;
  /** End time of visibility window, in milliseconds. Zero = run to end of song. */
  endTime: number;
  /** Fade-in duration, in milliseconds. */
  fadeInDuration: number;
  /** Fade-out duration, in milliseconds. */
  fadeOutDuration: number;
  /** Easing curve applied to fade-in and fade-out. */
  easing: TimingEasing;
}

/**
 * Default timing values produce an always-visible component with no fades:
 * start at song beginning, run to end of song, linear easing.
 */
export const DEFAULT_TIMING_OPTIONS: TimingOptions = {
  startTime: 0,
  endTime: 0,
  fadeInDuration: 0,
  fadeOutDuration: 0,
  easing: "linear"
};

/**
 * Reusable Timing option category exposing the five timing fields to the
 * component editor, collapsed by default so the editor stays uncluttered for
 * the common always-visible case.
 */
export const timingCategory: SceneOptionCategory = {
  type: "category",
  id: "timing",
  label: "Timing",
  defaultExpanded: false,
  options: [
    {
      type: "number",
      id: "startTime",
      label: "Start Time (ms)",
      defaultValue: 0,
      min: 0,
      step: 10
    },
    {
      type: "number",
      id: "endTime",
      label: "End Time (ms, 0 = end of song)",
      defaultValue: 0,
      min: 0,
      step: 10
    },
    {
      type: "number",
      id: "fadeInDuration",
      label: "Fade In (ms)",
      defaultValue: 0,
      min: 0,
      step: 10
    },
    {
      type: "number",
      id: "fadeOutDuration",
      label: "Fade Out (ms)",
      defaultValue: 0,
      min: 0,
      step: 10
    },
    {
      type: "select",
      id: "easing",
      label: "Easing",
      defaultValue: "linear",
      options: [
        { label: "Linear", value: "linear" },
        { label: "Ease In", value: "ease-in" },
        { label: "Ease Out", value: "ease-out" },
        { label: "Ease In Out", value: "ease-in-out" }
      ]
    }
  ]
};
