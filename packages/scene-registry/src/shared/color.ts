import { clamp01 } from "./math";

export interface RgbColor {
  red: number;
  green: number;
  blue: number;
}

export function parseHexColor(hexColor: string): RgbColor | null {
  const normalized = hexColor.replace("#", "");
  const expanded =
    normalized.length === 3
      ? normalized
          .split("")
          .map((char) => char + char)
          .join("")
      : normalized;

  if (!/^[\da-fA-F]{6}$/.test(expanded)) {
    return null;
  }

  return {
    red: Number.parseInt(expanded.slice(0, 2), 16),
    green: Number.parseInt(expanded.slice(2, 4), 16),
    blue: Number.parseInt(expanded.slice(4, 6), 16)
  };
}

export function rgbToHex({ red, green, blue }: RgbColor) {
  return `#${[red, green, blue]
    .map((value) => value.toString(16).padStart(2, "0"))
    .join("")}`;
}

export function withAlpha(hexColor: string, alpha: number) {
  const rgb = parseHexColor(hexColor);
  if (!rgb) {
    return hexColor;
  }

  return `rgba(${rgb.red}, ${rgb.green}, ${rgb.blue}, ${clamp01(alpha)})`;
}

export function mixHex(left: string, right: string, blend: number) {
  const leftRgb = parseHexColor(left);
  const rightRgb = parseHexColor(right);
  if (!leftRgb || !rightRgb) {
    return left;
  }

  const safeBlend = clamp01(blend);
  return rgbToHex({
    red: Math.round(leftRgb.red + (rightRgb.red - leftRgb.red) * safeBlend),
    green: Math.round(leftRgb.green + (rightRgb.green - leftRgb.green) * safeBlend),
    blue: Math.round(leftRgb.blue + (rightRgb.blue - leftRgb.blue) * safeBlend)
  });
}
