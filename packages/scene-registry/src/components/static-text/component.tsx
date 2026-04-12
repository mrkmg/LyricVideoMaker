import React from "react";
import type { SceneComponentDefinition } from "@lyric-video-maker/core";
import { staticFxLayerBrowserScript } from "../../shared/static-fx-layer.browser-runtime";
import { computeTimingOpacity } from "../../shared/timing-runtime";
import {
  DEFAULT_STATIC_TEXT_OPTIONS,
  staticTextOptionsSchema,
  type StaticTextComponentOptions
} from "./options";
import { buildStaticTextInitialState, type StaticTextTokenMetadata } from "./runtime";

/**
 * Static Text component (cavekit-static-text-component).
 *
 * Text tokens are resolved once at mount time using the render context's
 * available lyric/song metadata (T-029). Per-frame state only updates
 * opacity — the markup is declared static-when-markup-unchanged so the
 * render pipeline reuses the mounted layer.
 *
 * The Lyrics runtime currently exposes song metadata at
 * lyrics.songTitle / lyrics.songArtist when present — tokens for any
 * other key are left literal without crashing.
 */
export const staticTextComponent: SceneComponentDefinition<StaticTextComponentOptions> = {
  id: "static-text",
  name: "Static Text",
  description: "Positioned typographic text with styling, color modes, and effects.",
  staticWhenMarkupUnchanged: true,
  options: staticTextOptionsSchema,
  defaultOptions: DEFAULT_STATIC_TEXT_OPTIONS,
  browserRuntime: {
    runtimeId: "static-fx-layer",
    browserScript: staticFxLayerBrowserScript,
    getInitialState({ options, video, lyrics }) {
      const metadata = extractMetadata(lyrics);
      return buildStaticTextInitialState(options, video, 0, metadata) as unknown as Record<
        string,
        unknown
      >;
    },
    getFrameState({ options, timeMs }) {
      return { opacity: computeTimingOpacity(timeMs, options) };
    }
  },
  Component: ({ options, video, timeMs, lyrics }) => {
    const metadata = extractMetadata(lyrics);
    const initial = buildStaticTextInitialState(options, video, timeMs, metadata);
    return (
      <div
        style={initial.containerStyle as React.CSSProperties}
        data-static-text-component=""
        dangerouslySetInnerHTML={{ __html: initial.html }}
      />
    );
  }
};

function extractMetadata(lyrics: unknown): StaticTextTokenMetadata {
  // Render context lyric runtimes expose song metadata variably; guard
  // and pass through only the keys we understand. New keys require an
  // explicit revision to StaticTextTokenMetadata (documented follow-up).
  if (!lyrics || typeof lyrics !== "object") {
    return {};
  }
  const record = lyrics as Record<string, unknown>;
  return {
    songTitle: typeof record.songTitle === "string" ? record.songTitle : undefined,
    songArtist: typeof record.songArtist === "string" ? record.songArtist : undefined
  };
}
