// The owner's own brand colors, used on the post templates they download.
// These are NOT the app's design tokens: they're content the owner picks, so they live here
// as data (like the demo's sample brand) and never style the app itself.

import type { Business } from "./store";

export const DEFAULT_BRAND = { primary: "#1F5C55", accent: "#E8C79A" } as const; // sea green + warm sand

/** Ready-made pairs for the Settings picker. */
export const BRAND_SWATCHES: { name: string; primary: string; accent: string }[] = [
  { name: "Sea and sand", primary: "#1F5C55", accent: "#E8C79A" },
  { name: "Navy and coral", primary: "#1E3557", accent: "#F28C6B" },
  { name: "Plum and blush", primary: "#5B2A4E", accent: "#F2C4CE" },
  { name: "Forest and cream", primary: "#2F4A2E", accent: "#F1E7CF" },
  { name: "Charcoal and gold", primary: "#2B2B2E", accent: "#D9A94E" },
  { name: "Sky and sun", primary: "#2A5BD7", accent: "#FFD166" },
];

export const isHex = (s: unknown): s is string => typeof s === "string" && /^#[0-9a-fA-F]{6}$/.test(s);

export function brandColors(b: Pick<Business, "brandPrimary" | "brandAccent">): { primary: string; accent: string } {
  return {
    primary: isHex(b.brandPrimary) ? b.brandPrimary : DEFAULT_BRAND.primary,
    accent: isHex(b.brandAccent) ? b.brandAccent : DEFAULT_BRAND.accent,
  };
}

function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrast(a: string, b: string): number {
  const [x, y] = [luminance(a), luminance(b)].sort((m, n) => n - m);
  return (x + 0.05) / (y + 0.05);
}

/** Near-black or white, whichever reads better on this background (aims for 4.5:1). */
export function textOn(background: string): string {
  const dark = "#16191F";
  const light = "#FFFFFF";
  return contrast(background, dark) >= contrast(background, light) ? dark : light;
}
