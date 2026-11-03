/**
 * Palette generation.
 *
 * Every generator returns a `Palette` — an array of exactly 5 colors, each a
 * 6-character uppercase HEX value with a leading "#". All math is local to the
 * browser; there is no network or API dependency.
 *
 * Design notes:
 * - A "seed" is the anchor color for a harmony mode. If none is supplied (or it
 *   is invalid), a pleasant random seed is generated.
 * - "random" mode ignores the seed and produces fully random colors.
 * - Harmony modes intentionally spread hues so a palette is never all-near-
 *   identical (monochromatic is the deliberate exception).
 */

import {
  hslToHex,
  hexToRgb,
  rgbToHsl,
  normalizeHex,
  wrapHue,
  type Hsl,
} from "./color";

export type HarmonyMode =
  | "random"
  | "monochromatic"
  | "analogous"
  | "complementary"
  | "triadic"
  | "tetradic"
  | "pastel"
  | "vibrant"
  | "dark";

export interface PaletteOptions {
  mode: HarmonyMode;
  /** Optional anchor color (with or without "#"). Ignored by random mode. */
  seed?: string;
}

/** Exactly five colors, each "#RRGGBB". */
export type Palette = string[];

export interface HarmonyOption {
  value: HarmonyMode;
  label: string;
}

export const HARMONY_MODES: HarmonyOption[] = [
  { value: "random", label: "Random" },
  { value: "monochromatic", label: "Monochromatic" },
  { value: "analogous", label: "Analogous" },
  { value: "complementary", label: "Complementary" },
  { value: "triadic", label: "Triadic" },
  { value: "tetradic", label: "Tetradic" },
  { value: "pastel", label: "Pastel" },
  { value: "vibrant", label: "Vibrant" },
  { value: "dark", label: "Dark" },
];

/** A pleasant default palette used for the initial (server-rendered) state. */
export const DEFAULT_PALETTE: Palette = [
  "#264653",
  "#2A9D8F",
  "#E9C46A",
  "#F4A261",
  "#E76F51",
];

const SIZE = 5;

function clampPct(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

/** A pleasant random "#RRGGBB" used as a fallback seed. */
export function randomSeed(): string {
  const h = Math.random() * 360;
  const s = 50 + Math.random() * 30; // 50-80
  const l = 45 + Math.random() * 20; // 45-65
  return "#" + hslToHex(h, s, l);
}

/** Resolve a seed (or a random one) into an HSL triple. */
function seedToHsl(seed?: string): Hsl {
  const normalized = seed ? normalizeHex(seed) : null;
  const hex = normalized ? "#" + normalized : randomSeed();
  const { r, g, b } = hexToRgb(hex);
  return rgbToHsl(r, g, b);
}

/**
 * Normalize a raw color list into a valid 5-color Palette:
 * - coerces each entry to "#RRGGBB" (invalid entries become black)
 * - drops exact duplicates
 * - tops up with random colors so the result is always exactly 5 colors
 */
export function ensureFiveDistinct(colors: string[]): Palette {
  const out: string[] = [];
  for (const c of colors) {
    const n = "#" + (normalizeHex(c) ?? "000000");
    if (!out.includes(n)) out.push(n);
    if (out.length === SIZE) break;
  }
  while (out.length < SIZE) {
    out.push(randomSeed());
  }
  return out.slice(0, SIZE);
}

/** Full random palette (5 pleasant, varied colors). */
export function generateRandomPalette(): Palette {
  const colors: string[] = [];
  for (let i = 0; i < SIZE; i++) {
    const h = Math.random() * 360;
    const s = 45 + Math.random() * 40; // 45-85
    const l = 35 + Math.random() * 45; // 35-80
    colors.push("#" + hslToHex(h, s, l));
  }
  return ensureFiveDistinct(colors);
}

/** Same hue, varied saturation and lightness. */
export function generateMonochromatic(seed?: string): Palette {
  const { h, s } = seedToHsl(seed);
  const baseSat = clampPct(s, 30, 90);
  const lightnesses = [15, 35, 50, 65, 85];
  return ensureFiveDistinct(
    lightnesses.map((l, i) => {
      const sat = clampPct(baseSat + (i - 2) * 5, 15, 95);
      return "#" + hslToHex(h, sat, l);
    }),
  );
}

/** Seed hue plus/minus ~30° steps. */
export function generateAnalogous(seed?: string): Palette {
  const { h, s, l } = seedToHsl(seed);
  const offsets = [-60, -30, 0, 30, 60];
  return ensureFiveDistinct(
    offsets.map((o, i) => {
      const hue = wrapHue(h + o);
      const sat = clampPct(s + (i - 2) * 3, 25, 95);
      const light = clampPct(l + (i - 2) * 4, 25, 85);
      return "#" + hslToHex(hue, sat, light);
    }),
  );
}

/** Seed hue and its opposite, with small variations. */
export function generateComplementary(seed?: string): Palette {
  const { h, s, l } = seedToHsl(seed);
  const c = wrapHue(h + 180);
  const sat = clampPct(s, 40, 95);
  return ensureFiveDistinct([
    "#" + hslToHex(h, sat, clampPct(l, 30, 70)),
    "#" + hslToHex(wrapHue(h + 20), sat, clampPct(l + 12, 40, 80)),
    "#" + hslToHex(c, sat, clampPct(l, 45, 75)),
    "#" + hslToHex(wrapHue(c + 20), sat, clampPct(l + 10, 50, 82)),
    "#" + hslToHex(h, clampPct(sat - 20, 20, 85), clampPct(l + 25, 60, 90)),
  ]);
}

/** Seed hue plus 120° and 240°. */
export function generateTriadic(seed?: string): Palette {
  const { h, s, l } = seedToHsl(seed);
  const sat = clampPct(s, 45, 90);
  return ensureFiveDistinct([
    "#" + hslToHex(h, sat, clampPct(l, 35, 70)),
    "#" + hslToHex(wrapHue(h + 120), sat, clampPct(l, 45, 75)),
    "#" + hslToHex(wrapHue(h + 240), sat, clampPct(l, 45, 75)),
    "#" + hslToHex(wrapHue(h + 60), clampPct(sat - 15, 25, 85), clampPct(l + 15, 50, 85)),
    "#" + hslToHex(wrapHue(h + 180), clampPct(sat - 20, 20, 85), clampPct(l - 10, 25, 65)),
  ]);
}

/** Seed hue plus 90°, 180°, and 270°. */
export function generateTetradic(seed?: string): Palette {
  const { h, s, l } = seedToHsl(seed);
  const sat = clampPct(s, 45, 90);
  return ensureFiveDistinct([
    "#" + hslToHex(h, sat, clampPct(l, 35, 70)),
    "#" + hslToHex(wrapHue(h + 90), sat, clampPct(l, 45, 75)),
    "#" + hslToHex(wrapHue(h + 180), sat, clampPct(l, 45, 75)),
    "#" + hslToHex(wrapHue(h + 270), sat, clampPct(l, 45, 75)),
    "#" + hslToHex(wrapHue(h + 45), clampPct(sat - 25, 20, 80), clampPct(l + 20, 55, 88)),
  ]);
}

/** Soft, light, low-saturation hues around the seed. */
export function generatePastel(seed?: string): Palette {
  const { h } = seedToHsl(seed);
  const offsets = [-30, -15, 0, 15, 30];
  return ensureFiveDistinct(
    offsets.map((o) => {
      const hue = wrapHue(h + o);
      const sat = clampPct(38 + Math.random() * 22, 28, 65);
      const light = clampPct(78 + Math.random() * 12, 74, 92);
      return "#" + hslToHex(hue, sat, light);
    }),
  );
}

/** Saturated, energetic hues anchored on the seed. */
export function generateVibrant(seed?: string): Palette {
  const { h } = seedToHsl(seed);
  const offsets = [-20, 0, 40, 160, 200];
  return ensureFiveDistinct(
    offsets.map((o, i) => {
      const hue = wrapHue(h + o);
      const sat = clampPct(75 + Math.random() * 20, 70, 95);
      const light = clampPct(50 + (i - 2) * 6, 40, 65);
      return "#" + hslToHex(hue, sat, light);
    }),
  );
}

/** Deep, low-lightness hues anchored on the seed. */
export function generateDark(seed?: string): Palette {
  const { h } = seedToHsl(seed);
  const offsets = [0, 20, 40, 180, 200];
  return ensureFiveDistinct(
    offsets.map((o, i) => {
      const hue = wrapHue(h + o);
      const sat = clampPct(35 + Math.random() * 30, 25, 70);
      const light = clampPct(14 + i * 5, 10, 35);
      return "#" + hslToHex(hue, sat, light);
    }),
  );
}

/**
 * Dispatcher used by the UI. Chooses the right generator for the mode.
 */
export function generatePalette(
  options: PaletteOptions = { mode: "random" },
): Palette {
  const { mode, seed } = options;
  switch (mode) {
    case "monochromatic":
      return generateMonochromatic(seed);
    case "analogous":
      return generateAnalogous(seed);
    case "complementary":
      return generateComplementary(seed);
    case "triadic":
      return generateTriadic(seed);
    case "tetradic":
      return generateTetradic(seed);
    case "pastel":
      return generatePastel(seed);
    case "vibrant":
      return generateVibrant(seed);
    case "dark":
      return generateDark(seed);
    case "random":
    default:
      return generateRandomPalette();
  }
}

/**
 * Merge a freshly generated palette with the user's locked colors.
 *
 * `lockedMap` is a boolean array aligned to palette indices; when a slot is
 * locked, the value from `existingPalette` is kept, otherwise the new value is
 * used. The result is always the same length as the inputs.
 */
export function applyLocks(
  existingPalette: Palette,
  newPalette: Palette,
  lockedMap: boolean[],
): Palette {
  return newPalette.map((color, i) => {
    const locked = lockedMap[i] === true;
    return locked && existingPalette[i] ? existingPalette[i] : color;
  });
}
