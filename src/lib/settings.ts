import type { ModelQuality } from "./cutout";
import type { ExportFormat } from "./imaging";
import { findPreset, type FitMode, type Preset } from "./presets";
import type { SheetPreset } from "./sheet";
import type { Unit } from "./units";

export type Settings = {
  presetId: string;
  width: number;
  height: number;
  unit: Unit;
  dpi: number;
  background: string;
  fit: FitMode;
  padding: number;
  zoom: number;
  offsetX: number;
  offsetY: number;
  format: ExportFormat;
  /** Export quality for lossy formats, 0–1. */
  quality: number;
  removeBg: boolean;
  model: ModelQuality;
  /** Colour tweaks, each -1…1 with 0 meaning "leave it alone". */
  brightness: number;
  contrast: number;
  saturation: number;
  warmth: number;
  /**
   * Which uploaded suit is laid over the photo, or null for none. An id that no
   * longer exists simply draws nothing, so a deleted suit cannot strand anyone.
   */
  attireAssetId: string | null;
  attireScale: number;
  attireOffsetX: number;
  attireOffsetY: number;
  /** Inset frame around the photo, in output pixels. */
  borderWidth: number;
  borderColour: string;
  /** Tile the finished photo across a print sheet instead of exporting one copy. */
  sheet: boolean;
  sheetId: string;
  /** Sheet size and spacing, in millimetres. */
  sheetW: number;
  sheetH: number;
  gap: number;
  margin: number;
  cutMarks: boolean;
  /** Whether photos may lie sideways to fit more per sheet. */
  sheetRotate: "auto" | "upright";
  /** How many copies to place; clamped to whatever the sheet actually holds. */
  copies: number;
  /** When set, ignore `copies` and lay out as many as the sheet will take. */
  fillSheet: boolean;
  /**
   * Show the preview as ink would print it. A viewing aid only — it never
   * reaches the exported file, which stays in full sRGB.
   */
  proof: boolean;
};

/** Editing any of these means the result no longer matches the chosen preset. */
export const PRESET_KEYS = [
  "width",
  "height",
  "unit",
  "dpi",
  "background",
  "fit",
  "padding",
] as const satisfies readonly (keyof Settings)[];

export const DEFAULT_SETTINGS: Settings = {
  presetId: "passport-35x45",
  width: 35,
  height: 45,
  unit: "mm",
  dpi: 300,
  background: "#ffffff",
  fit: "contain",
  padding: 0.08,
  zoom: 1,
  offsetX: 0,
  offsetY: 0,
  format: "image/png",
  quality: 0.92,
  removeBg: true,
  model: "fine",
  brightness: 0,
  contrast: 0,
  saturation: 0,
  warmth: 0,
  attireAssetId: null,
  attireScale: 1.2,
  attireOffsetX: 0,
  attireOffsetY: 0,
  borderWidth: 0,
  borderColour: "#14161c",
  sheet: false,
  sheetId: "10x15",
  sheetW: 100,
  sheetH: 150,
  gap: 2,
  margin: 4,
  cutMarks: true,
  sheetRotate: "auto",
  // One copy to start with: multiplying is an explicit choice, not a surprise.
  copies: 1,
  fillSheet: false,
  // Off by default: the studio should open showing the photograph, not a
  // simulation of one.
  proof: false,
};

/**
 * A preset describes the output — paper, not framing. It deliberately leaves
 * `zoom` and the offsets alone: those are how the user placed *their* face in
 * the frame, and resetting them meant a careful composition was thrown away by
 * a stray click on a size. The offsets are fractions of the target dimensions,
 * so they survive a change of aspect ratio on their own.
 */
export function fromPreset(preset: Preset): Partial<Settings> {
  return {
    presetId: preset.id,
    width: preset.width,
    height: preset.height,
    unit: preset.unit,
    dpi: preset.dpi,
    background: preset.background,
    fit: preset.fit,
    padding: preset.padding,
  };
}

/** Editing any of these means the sheet no longer matches a named paper size. */
export const SHEET_KEYS = ["sheetW", "sheetH"] as const satisfies readonly (keyof Settings)[];

export function fromSheet(sheet: SheetPreset): Partial<Settings> {
  return {
    sheetId: sheet.id,
    sheetW: sheet.width,
    sheetH: sheet.height,
  };
}

export function initialSettings(): Settings {
  const preset = findPreset(DEFAULT_SETTINGS.presetId);
  return preset
    ? { ...DEFAULT_SETTINGS, ...fromPreset(preset) }
    : DEFAULT_SETTINGS;
}
