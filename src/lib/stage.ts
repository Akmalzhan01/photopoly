/**
 * Sizing helpers for a before-and-after stage, and what a picture measures on
 * paper.
 */

export type Size = { w: number; h: number };

export const PRINT_DPI = 300;

/** Millimetres a given number of pixels covers on paper. */
export function printMm(pixels: number, dpi = PRINT_DPI): number {
  return (pixels / dpi) * 25.4;
}

export function describeMm(w: number, h: number): string {
  const cm = (mm: number) => (Math.round(mm / 10 * 10) / 10).toString().replace(".", ",");
  return `${cm(printMm(w))} × ${cm(printMm(h))} см`;
}

/** A box of the given aspect that fits the width available, under a ceiling. */
export function stageBox(available: number, aspect: number, maxHeight: number): Size {
  const w = Math.max(120, Math.floor(available));
  const h = w / Math.max(0.05, aspect);
  if (h <= maxHeight) return { w, h: Math.max(1, Math.round(h)) };
  return { w: Math.max(1, Math.round(maxHeight * Math.max(0.05, aspect))), h: maxHeight };
}
