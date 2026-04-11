import React from "react";
import type { SceneRenderProps } from "@lyric-video-maker/core";
import {
  getLyricBlockStyles,
  getLyricContainerPixelWidth,
  getLyricContainerStyle,
  getScaledLyricLayout
} from "../layout";
import { getLyricOpacity } from "../fade";
import {
  createTextShadow,
  getLyricPaintPadding,
  getRenderedLyricFontSize,
  getRenderedLyricText
} from "../typography";
import {
  LYRIC_FONT_WEIGHT,
  LYRIC_LETTER_SPACING_EM,
  LYRIC_LINE_HEIGHT,
  type LyricsByLineOptions
} from "../types";

export function LyricsByLineRenderComponent({
  options,
  lyrics,
  timeMs,
  video
}: SceneRenderProps<LyricsByLineOptions>) {
  const activeCue = lyrics.current;
  const scaledLayout = getScaledLyricLayout(video, options);
  const activeText = getRenderedLyricText(activeCue?.lines ?? [], activeCue?.text ?? "", options.forceSingleLine);
  const lyricOpacity = activeCue ? getLyricOpacity(activeCue.startMs, activeCue.endMs, timeMs, options) : 0;
  const lyricBlockStyles = getLyricBlockStyles(
    options.lyricPosition,
    scaledLayout.horizontalPadding,
    scaledLayout.verticalInset
  );
  const containerStyle = getLyricContainerStyle(video, options);
  const containerWidth = getLyricContainerPixelWidth(video, options);
  const estimatedPaintPadding = getLyricPaintPadding(scaledLayout.lyricSize, {
    borderEnabled: options.borderEnabled,
    borderThickness: scaledLayout.borderThickness,
    shadowEnabled: options.shadowEnabled,
    shadowIntensity: options.shadowIntensity
  });
  const lyricFontSize = getRenderedLyricFontSize(
    activeText,
    {
      lyricSize: scaledLayout.lyricSize,
      forceSingleLine: options.forceSingleLine,
      lyricFont: options.lyricFont
    },
    containerWidth,
    lyricBlockStyles.horizontalPadding,
    estimatedPaintPadding
  );
  const paintPadding = getLyricPaintPadding(lyricFontSize, {
    borderEnabled: options.borderEnabled,
    borderThickness: scaledLayout.borderThickness,
    shadowEnabled: options.shadowEnabled,
    shadowIntensity: options.shadowIntensity
  });
  const letterShadow =
    options.shadowEnabled && options.shadowIntensity > 0
      ? createTextShadow(lyricFontSize, options.shadowColor, options.shadowIntensity)
      : "none";
  const letterStroke =
    options.borderEnabled && scaledLayout.borderThickness > 0
      ? `${scaledLayout.borderThickness}px ${options.borderColor}`
      : undefined;

  return (
    <div
      style={{
        ...containerStyle,
        display: "flex",
        alignItems: lyricBlockStyles.alignItems,
        justifyContent: "center",
        padding: lyricBlockStyles.padding,
        boxSizing: "border-box",
        color: options.lyricColor,
        fontFamily: `"${options.lyricFont}", sans-serif`
      }}
    >
      <div
        style={{
          display: "inline-block",
          maxWidth: "100%",
          textAlign: "center",
          fontSize: lyricFontSize,
          fontWeight: LYRIC_FONT_WEIGHT,
          lineHeight: LYRIC_LINE_HEIGHT,
          letterSpacing: `${LYRIC_LETTER_SPACING_EM}em`,
          padding: `${paintPadding}px`,
          textShadow: letterShadow,
          whiteSpace: options.forceSingleLine ? "nowrap" : "pre-wrap",
          opacity: lyricOpacity,
          WebkitTextStroke: letterStroke
        }}
      >
        {activeText}
      </div>
    </div>
  );
}
