import type { SceneComponentDefinition } from "@lyric-video-maker/core";
import {
  getLyricsByLineFrameBrowserState,
  getLyricsByLineInitialBrowserState
} from "./browser-state";
import { lyricsByLineDefaultOptions, lyricsByLineOptionsSchema } from "./options-schema";
import { LyricsByLineRenderComponent } from "./react/component";
import type { LyricsByLineOptions } from "./types";

export const lyricsByLineComponent: SceneComponentDefinition<LyricsByLineOptions> = {
  id: "lyrics-by-line",
  name: "Lyrics by Line",
  description: "Shows the current subtitle line with timing-aware fades and typography.",
  staticWhenMarkupUnchanged: false,
  browserRuntime: {
    runtimeId: "lyrics-by-line",
    getInitialState: getLyricsByLineInitialBrowserState,
    getFrameState: getLyricsByLineFrameBrowserState
  },
  options: lyricsByLineOptionsSchema,
  defaultOptions: lyricsByLineDefaultOptions,
  Component: LyricsByLineRenderComponent
};
