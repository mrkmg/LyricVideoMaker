import type {
  SceneBrowserFrameStateContext,
  SceneBrowserInitialStateContext
} from "@lyric-video-maker/core";
import { getLyricBlockStyles, getScaledLyricLayout } from "./layout";
import { getLyricOpacity } from "./fade";
import {
  createTextShadow,
  getLyricPaintPadding,
  getRenderedLyricFontSize,
  getRenderedLyricText
} from "./typography";
import type { LyricsByLineOptions } from "./types";

export function getLyricsByLineInitialBrowserState({
  options,
  video
}: SceneBrowserInitialStateContext<LyricsByLineOptions>) {
  const scaledLayout = getScaledLyricLayout(video, options);
  const lyricBlockStyles = getLyricBlockStyles(
    options.lyricPosition,
    scaledLayout.horizontalPadding,
    scaledLayout.verticalInset
  );

  return {
    alignItems: lyricBlockStyles.alignItems,
    padding: lyricBlockStyles.padding,
    horizontalPadding: lyricBlockStyles.horizontalPadding,
    color: options.lyricColor,
    fontFamily: `"${options.lyricFont}", sans-serif`,
    whiteSpace: options.forceSingleLine ? "nowrap" : "pre-wrap"
  };
}

export function getLyricsByLineFrameBrowserState({
  options,
  lyrics,
  timeMs,
  video
}: SceneBrowserFrameStateContext<LyricsByLineOptions>) {
  const activeCue = lyrics.current;
  const scaledLayout = getScaledLyricLayout(video, options);
  const activeText = getRenderedLyricText(
    activeCue?.lines ?? [],
    activeCue?.text ?? "",
    options.forceSingleLine
  );
  const lyricBlockStyles = getLyricBlockStyles(
    options.lyricPosition,
    scaledLayout.horizontalPadding,
    scaledLayout.verticalInset
  );
  const paintPadding = getLyricPaintPadding(scaledLayout.lyricSize, {
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
    video.width,
    lyricBlockStyles.horizontalPadding,
    paintPadding
  );
  const lyricOpacity = activeCue ? getLyricOpacity(activeCue.startMs, activeCue.endMs, timeMs, options) : 0;
  const renderedPaintPadding = getLyricPaintPadding(lyricFontSize, {
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
      : "";

  return {
    text: activeText,
    opacity: lyricOpacity,
    fontSize: lyricFontSize,
    padding: `${renderedPaintPadding}px`,
    textShadow: letterShadow,
    webkitTextStroke: letterStroke
  };
}
