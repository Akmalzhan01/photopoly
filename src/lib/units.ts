export type Unit = "px" | "mm" | "cm" | "in";

export const UNITS: Unit[] = ["px", "mm", "cm", "in"];

/** How many of `unit` fit into one inch. `px` is resolved via DPI instead. */
const PER_INCH: Record<Exclude<Unit, "px">, number> = {
  mm: 25.4,
  cm: 2.54,
  in: 1,
};

export function toPixels(value: number, unit: Unit, dpi: number): number {
  if (unit === "px") return Math.max(1, Math.round(value));
  return Math.max(1, Math.round((value / PER_INCH[unit]) * dpi));
}

export function fromPixels(px: number, unit: Unit, dpi: number): number {
  if (unit === "px") return px;
  return (px / dpi) * PER_INCH[unit];
}

/** Sensible decimal places when showing a value in `unit`. */
export function formatIn(px: number, unit: Unit, dpi: number): string {
  const v = fromPixels(px, unit, dpi);
  if (unit === "px") return String(Math.round(v));
  return v.toFixed(unit === "in" ? 2 : 1);
}

/** Tick spacing for the stage rulers, chosen so ~6-14 ticks land on the edge. */
export function tickStep(spanInUnit: number): number {
  const candidates = [1, 2, 5, 10, 20, 25, 50, 100, 200, 250, 500, 1000, 2000];
  for (const c of candidates) {
    if (spanInUnit / c <= 14) return c;
  }
  return 5000;
}
