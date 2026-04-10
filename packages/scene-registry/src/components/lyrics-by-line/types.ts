export type LyricFadeEasing = "linear" | "ease-in" | "ease-out" | "ease-in-out";
export type LyricVerticalPosition = "top" | "middle" | "bottom";

export interface LyricScale {
  horizontal: number;
  vertical: number;
  uniform: number;
}

export interface ScaledLyricLayout {
  lyricSize: number;
  horizontalPadding: number;
  verticalInset: number;
  borderThickness: number;
}

export interface LyricsByLineOptions {
  lyricSize: number;
  forceSingleLine: boolean;
  horizontalPadding: number;
  lyricFont: string;
  lyricColor: string;
  fadeInDurationMs: number;
  fadeInEasing: LyricFadeEasing;
  fadeOutDurationMs: number;
  fadeOutEasing: LyricFadeEasing;
  lyricPosition: LyricVerticalPosition;
  borderEnabled: boolean;
  borderColor: string;
  borderThickness: number;
  shadowEnabled: boolean;
  shadowColor: string;
  shadowIntensity: number;
}

export const LYRIC_FONT_WEIGHT = 700;
export const LYRIC_LINE_HEIGHT = 1.15;
export const LYRIC_LETTER_SPACING_EM = -0.03;
export const LYRIC_VERTICAL_INSET = 110;
