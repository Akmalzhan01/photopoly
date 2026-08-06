import type { ModelQuality } from "./cutout";
import type { ExportFormat } from "./imaging";
import type { FitMode } from "./presets";
import { initialSettings, type Settings } from "./settings";
import type { Unit } from "./units";

const KEY = "photopoly.settings";

/**
 * Anything can end up in localStorage — an older build, a half-written value, a
 * user poking at devtools. Every field is checked against the current schema and
 * falls back to its default, so a bad entry can never wedge the app.
 */
function num(value: unknown, fallback: number, min: number, max: number): number {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.min(max, Math.max(min, value))
    : fallback;
}

function pick<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  return typeof value === "string" && (allowed as readonly string[]).includes(value)
    ? (value as T)
    : fallback;
}

function bool(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

function colour(value: unknown, fallback: string): string {
  if (value === "transparent") return value;
  return typeof value === "string" && /^#[0-9a-f]{3,8}$/i.test(value) ? value : fallback;
}

const UNITS: readonly Unit[] = ["px", "mm", "cm", "in"];
const FITS: readonly FitMode[] = ["contain", "cover"];
const FORMATS: readonly ExportFormat[] = ["image/png", "image/jpeg", "image/webp"];
const MODELS: readonly ModelQuality[] = ["fast", "fine"];
const ROTATIONS = ["auto", "upright"] as const;

export function sanitise(raw: unknown): Settings {
  const base = initialSettings();
  if (!raw || typeof raw !== "object") return base;
  const v = raw as Record<string, unknown>;

  return {
    presetId: typeof v.presetId === "string" ? v.presetId : base.presetId,
    width: num(v.width, base.width, 0.1, 100000),
    height: num(v.height, base.height, 0.1, 100000),
    unit: pick(v.unit, UNITS, base.unit),
    dpi: num(v.dpi, base.dpi, 36, 1200),
    background: colour(v.background, base.background),
    fit: pick(v.fit, FITS, base.fit),
    padding: num(v.padding, base.padding, 0, 0.45),
    zoom: num(v.zoom, base.zoom, 0.2, 4),
    rotate: num(v.rotate, base.rotate, -180, 180),
    offsetX: num(v.offsetX, base.offsetX, -1, 1),
    offsetY: num(v.offsetY, base.offsetY, -1, 1),
    format: pick(v.format, FORMATS, base.format),
    quality: num(v.quality, base.quality, 0.2, 1),
    removeBg: bool(v.removeBg, base.removeBg),
    model: pick(v.model, MODELS, base.model),
    brightness: num(v.brightness, base.brightness, -1, 1),
    contrast: num(v.contrast, base.contrast, -1, 1),
    saturation: num(v.saturation, base.saturation, -1, 1),
    warmth: num(v.warmth, base.warmth, -1, 1),
    // Not validated against the live list: settings are read before the assets
    // arrive, and a stale id is harmless — it resolves to no artwork.
    attireAssetId: typeof v.attireAssetId === "string" ? v.attireAssetId : base.attireAssetId,
    attireScale: num(v.attireScale, base.attireScale, 0.4, 3),
    attireOffsetX: num(v.attireOffsetX, base.attireOffsetX, -1, 1),
    attireOffsetY: num(v.attireOffsetY, base.attireOffsetY, -1, 1),
    borderWidth: num(v.borderWidth, base.borderWidth, 0, 400),
    borderColour: colour(v.borderColour, base.borderColour),
    sheet: bool(v.sheet, base.sheet),
    sheetId: typeof v.sheetId === "string" ? v.sheetId : base.sheetId,
    sheetW: num(v.sheetW, base.sheetW, 20, 1000),
    sheetH: num(v.sheetH, base.sheetH, 20, 1000),
    gap: num(v.gap, base.gap, 0, 50),
    margin: num(v.margin, base.margin, 0, 60),
    cutMarks: bool(v.cutMarks, base.cutMarks),
    sheetRotate: pick(v.sheetRotate, ROTATIONS, base.sheetRotate),
    copies: num(v.copies, base.copies, 1, 9999),
    fillSheet: bool(v.fillSheet, base.fillSheet),
    proof: bool(v.proof, base.proof),
  };
}

export function loadSettings(): Settings | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(KEY);
    return raw ? sanitise(JSON.parse(raw)) : null;
  } catch {
    return null;
  }
}

export function saveSettings(settings: Settings): void {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(settings));
  } catch {
    // Private mode or a full quota — remembering settings is not worth an error.
  }
}

