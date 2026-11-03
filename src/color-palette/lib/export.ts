/**
 * Export helpers. Each takes a Palette (array of "#RRGGBB") and returns a
 * ready-to-copy string.
 */

import type { Palette } from "./palette";
import { hexToRgb, rgbToHsl, getBestTextColor } from "./color";

/** CSS custom properties for the whole palette. */
export function paletteToCssVariables(palette: Palette): string {
  const lines = palette.map(
    (hex, i) => `  --color-${i + 1}: ${hex.toUpperCase()};`,
  );
  return `:root {\n${lines.join("\n")}\n}`;
}

/** A Tailwind `theme.extend.colors` snippet. */
export function paletteToTailwindConfig(palette: Palette): string {
  const colors = palette
    .map((hex, i) => `        ${i + 1}: '${hex.toUpperCase()}',`)
    .join("\n");
  return [
    "theme: {",
    "  extend: {",
    "    colors: {",
    "      palette: {",
    colors,
    "      }",
    "    }",
    "  }",
    "}",
  ].join("\n");
}

/** Structured JSON with HEX, RGB, and HSL for each color. */
export function paletteToJson(palette: Palette): string {
  const data = {
    palette: palette.map((hex, i) => {
      const { r, g, b } = hexToRgb(hex);
      const { h, s, l } = rgbToHsl(r, g, b);
      return {
        position: i + 1,
        hex: hex.toUpperCase(),
        rgb: { r, g, b },
        hsl: { h, s, l },
      };
    }),
  };
  return JSON.stringify(data, null, 2);
}

/**
 * A horizontal SVG swatch strip. Text labels use black or white automatically
 * based on each swatch's best-contrast text color.
 */
export function paletteToSvg(palette: Palette): string {
  const width = 1250;
  const height = 400;
  const swatchWidth = width / palette.length;
  const parts = palette.map((hex, i) => {
    const x = i * swatchWidth;
    const textColor = getBestTextColor(hex) === "white" ? "#ffffff" : "#000000";
    const cx = x + swatchWidth / 2;
    return [
      `    <rect x="${x}" y="0" width="${swatchWidth}" height="${height}" fill="${hex.toUpperCase()}"/>`,
      `    <text x="${cx}" y="${height / 2}" fill="${textColor}" font-family="system-ui, -apple-system, sans-serif" font-size="34" font-weight="600" text-anchor="middle" dominant-baseline="middle">${hex
        .toUpperCase()
        .slice(1)}</text>`,
    ].join("\n");
  });

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="Color palette swatch strip">`,
    ...parts,
    "</svg>",
  ].join("\n");
}

/**
 * Trigger a browser download of an SVG string. Returns false when the browser
 * cannot perform the action.
 */
export function downloadSvg(svg: string, filename = "palette.svg"): boolean {
  if (typeof document === "undefined") return false;
  try {
    const blob = new Blob([svg], { type: "image/svg+xml" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    // Give the browser a moment before revoking.
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    return true;
  } catch {
    return false;
  }
}
