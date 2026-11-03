/**
 * Color math utilities.
 *
 * All conversion helpers operate on plain numbers and are pure, so they can be
 * unit tested and shared between the browser and (if ever needed) server code.
 * HEX values are represented as 6-character strings with the leading "#"
 * omitted internally; the public API is tolerant of "#", lowercase, and the
 * 3-character short form.
 */

export type Rgb = { r: number; g: number; b: number };
export type Hsl = { h: number; s: number; l: number };

export const BLACK = "000000";
export const WHITE = "FFFFFF";

/** Wrap a hue into the canonical [0, 360) range. */
export function wrapHue(h: number): number {
  return ((h % 360) + 360) % 360;
}

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}

function clamp255(n: number): number {
  return Math.max(0, Math.min(255, Math.round(n)));
}

/**
 * Normalize arbitrary input into a canonical 6-character uppercase HEX string
 * (no "#"), or `null` when the input is not a valid color.
 *
 * Accepts:
 * - "#1F2937" -> "1F2937"
 * - "1f2937"  -> "1F2937"
 * - "#ABC"    -> "AABBCC"
 * - "ABC"     -> "AABBCC"
 * - "not a color" -> null
 */
export function normalizeHex(
  input: string | null | undefined,
): string | null {
  if (typeof input !== "string") return null;
  let value = input.trim();
  if (value.length === 0) return null;
  if (value.startsWith("#")) value = value.slice(1);
  // Expand the 3-character short form (#ABC -> AABBCC).
  if (/^[0-9a-fA-F]{3}$/.test(value)) {
    value = value
      .split("")
      .map((c) => c + c)
      .join("");
  }
  if (!/^[0-9a-fA-F]{6}$/.test(value)) return null;
  return value.toUpperCase();
}

export function isValidHex(
  input: string | null | undefined,
): boolean {
  return normalizeHex(input) !== null;
}

/** Convert a HEX color to an RGB object. Falls back to black for bad input. */
export function hexToRgb(hex: string): Rgb {
  const normalized = normalizeHex(hex) ?? "000000";
  return {
    r: parseInt(normalized.slice(0, 2), 16),
    g: parseInt(normalized.slice(2, 4), 16),
    b: parseInt(normalized.slice(4, 6), 16),
  };
}

function toHexPair(n: number): string {
  return clamp255(n).toString(16).padStart(2, "0");
}

/** Convert an RGB triple to a 6-character uppercase HEX string. */
export function rgbToHex(r: number, g: number, b: number): string {
  return (toHexPair(r) + toHexPair(g) + toHexPair(b)).toUpperCase();
}

/** Convert an RGB triple (0-255) to HSL (h 0-360, s 0-100, l 0-100). */
export function rgbToHsl(r: number, g: number, b: number): Hsl {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  let h = 0;
  let s = 0;
  const delta = max - min;
  if (delta !== 0) {
    s = l > 0.5 ? delta / (2 - max - min) : delta / (max + min);
    switch (max) {
      case rn:
        h = (gn - bn) / delta + (gn < bn ? 6 : 0);
        break;
      case gn:
        h = (bn - rn) / delta + 2;
        break;
      default:
        h = (rn - gn) / delta + 4;
        break;
    }
    h *= 60;
  }
  return {
    h: Math.round(wrapHue(h)),
    s: Math.round(clamp01(s) * 100),
    l: Math.round(clamp01(l) * 100),
  };
}

/** Convert HSL (h 0-360, s 0-100, l 0-100) to an RGB triple (0-255). */
export function hslToRgb(h: number, s: number, l: number): Rgb {
  const hn = wrapHue(h) / 360;
  const sn = clamp01(s / 100);
  const ln = clamp01(l / 100);
  if (sn === 0) {
    const v = Math.round(ln * 255);
    return { r: v, g: v, b: v };
  }
  const hue2rgb = (p: number, q: number, t: number) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  const q = ln < 0.5 ? ln * (1 + sn) : ln + sn - ln * sn;
  const p = 2 * ln - q;
  return {
    r: Math.round(hue2rgb(p, q, hn + 1 / 3) * 255),
    g: Math.round(hue2rgb(p, q, hn) * 255),
    b: Math.round(hue2rgb(p, q, hn - 1 / 3) * 255),
  };
}

/** Convert HSL directly to a 6-character uppercase HEX string. */
export function hslToHex(h: number, s: number, l: number): string {
  const { r, g, b } = hslToRgb(h, s, l);
  return rgbToHex(r, g, b);
}

/** Relative luminance per the WCAG definition. */
export function getRelativeLuminance(rgb: Rgb): number {
  const channel = (c: number) => {
    const cs = c / 255;
    return cs <= 0.03928 ? cs / 12.92 : Math.pow((cs + 0.055) / 1.055, 2.4);
  };
  const { r, g, b } = rgb;
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

/**
 * WCAG contrast ratio between two colors, as a number (1-21).
 * Each argument may be a HEX string or an RGB object.
 */
export function getContrastRatio(
  a: Rgb | string,
  b: Rgb | string,
): number {
  const ra = typeof a === "string" ? hexToRgb(a) : a;
  const rb = typeof b === "string" ? hexToRgb(b) : b;
  const la = getRelativeLuminance(ra);
  const lb = getRelativeLuminance(rb);
  const lighter = Math.max(la, lb);
  const darker = Math.min(la, lb);
  return (lighter + 0.05) / (darker + 0.05);
}

/**
 * Choose the more readable text color ("black" or "white") for a background.
 */
export function getBestTextColor(hex: string): "black" | "white" {
  const white = getContrastRatio(hex, WHITE);
  const black = getContrastRatio(hex, BLACK);
  return white >= black ? "white" : "black";
}

/** Format a HEX color as a CSS `rgb(...)` string. */
export function formatRgb(hex: string): string {
  const { r, g, b } = hexToRgb(hex);
  return `rgb(${r}, ${g}, ${b})`;
}

/** Format a HEX color as a CSS `hsl(...)` string. */
export function formatHsl(hex: string): string {
  const { r, g, b } = hexToRgb(hex);
  const { h, s, l } = rgbToHsl(r, g, b);
  return `hsl(${h}, ${s}%, ${l}%)`;
}

export type ContrastLabel =
  | "Good for text"
  | "Use carefully"
  | "Decorative only";

export interface ContrastInfo {
  /** Which text color is more readable on this background. */
  best: "black" | "white";
  /** Best achievable contrast ratio (against the best text color). */
  ratio: number;
  /** Contrast of white text on this background. */
  ratioWhite: number;
  /** Contrast of black text on this background. */
  ratioBlack: number;
  /** A short, human-readable WCAG-style guidance label. */
  label: ContrastLabel;
}

/**
 * Compute all the accessibility guidance the ColorCard needs in one pass.
 *
 * Thresholds follow WCAG: 4.5:1 is solid for body text, 3:1 is fine for large
 * text, and anything below 3:1 is best treated as decorative.
 */
export function getContrastInfo(hex: string): ContrastInfo {
  const ratioWhite = getContrastRatio(hex, WHITE);
  const ratioBlack = getContrastRatio(hex, BLACK);
  const best = ratioWhite >= ratioBlack ? "white" : "black";
  const ratio = best === "white" ? ratioWhite : ratioBlack;

  let label: ContrastLabel;
  if (ratio >= 4.5) label = "Good for text";
  else if (ratio >= 3) label = "Use carefully";
  else label = "Decorative only";

  return { best, ratio, ratioWhite, ratioBlack, label };
}
