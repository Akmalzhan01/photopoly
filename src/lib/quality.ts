/**
 * The quality service: one photograph in, a better print out.
 *
 * A separate service rather than a panel in the editor, because it answers a
 * different question. The editor's job is a document photograph at an exact
 * size, and the repair there is something that happens on the way. Here the
 * repair *is* the job: somebody brings in a dark phone snapshot or a small scan
 * and wants a file worth printing. Nothing is cropped, nothing is composed, no
 * background is touched — the frame that arrives is the frame that leaves.
 *
 * All the arithmetic lives in `enhance.ts` and is shared with the editor, down
 * to the measured tables in its header. What is here is what this page needs on
 * top of it: how much to enlarge by, what the result will actually measure, and
 * what to show on screen so the difference can be judged before paying for it.
 *
 * ## Why the preview is not simply the result
 *
 * The result can be forty megapixels, and a slider has to answer in a moment.
 * So the comparison is made at the size it is displayed at, and two views are
 * offered, because they tell different truths:
 *
 *   «Целиком» — the whole frame, reduced to the screen. Honest about exposure
 *     and colour, and optimistic about grain: reducing a picture averages grain
 *     away, so it always looks calmer here than it will on paper.
 *
 *   «1:1» — one window of the *result*, at the result's own pixels. This is the
 *     view that tells the truth about grain, sharpening and the enlargement,
 *     because nothing has been reduced. The untouched side is the same window
 *     enlarged by the browser, which is exactly what the file would have looked
 *     like without any of this.
 */

import {
  enhanceSource,
  levelsOf,
  plannedSize,
  type Enhance,
  type Levels,
} from "./enhance";
import { fullBounds, MAX_EDGE, type Drawable, type ExportFormat } from "./imaging";

export type Quality = {
  /** Exposure and white balance, 0–1. */
  tone: number;
  /** Noise smoothing, 0–1. */
  denoise: number;
  /** Edge contrast, 0–1. */
  sharpen: number;
  /** How much bigger to make it, 1–4. */
  scale: number;
  format: Extract<ExportFormat, "image/jpeg" | "image/png">;
};

/**
 * The same starting point as the editor's, and for the same reasons — see the
 * tables in `enhance.ts`. The enlargement starts at 1: growing a photograph is
 * a decision about the print, not a default.
 */
export function initialQuality(): Quality {
  return { tone: 0.75, denoise: 0.45, sharpen: 0.45, scale: 1, format: "image/jpeg" };
}

export const SCALES = [1, 2, 3, 4] as const;

/** High enough that the enlargement is not thrown away by the encoder. */
export const JPEG_QUALITY = 0.95;

/**
 * What the file claims about its physical size.
 *
 * There is no document size here to take it from, so the file is tagged at the
 * figure print shops work in. Anybody laying it out themselves overrides this;
 * anybody who just prints it gets a sensible size instead of none.
 */
export const PRINT_DPI = 300;

export type View = "fit" | "crop";

export type Rect = { x: number; y: number; w: number; h: number };
export type Size = { w: number; h: number };

export function toEnhance(quality: Quality): Enhance {
  return { on: true, tone: quality.tone, denoise: quality.denoise, sharpen: quality.sharpen };
}

export function idleQuality(quality: Quality): boolean {
  return (
    quality.scale <= 1 && quality.tone === 0 && quality.denoise === 0 && quality.sharpen === 0
  );
}

/**
 * What the saved file will measure, worked out by the same function the
 * pipeline uses, so the page cannot promise a size it then fails to write.
 */
export function resultSize(source: Size, scale: number): Size & { capped: boolean } {
  const plan = plannedSize(source, scale);
  return { w: plan.w, h: plan.h, capped: plan.scale < scale - 0.001 };
}

/** Millimetres a given number of pixels covers on paper. */
export function printMm(pixels: number, dpi = PRINT_DPI): number {
  return (pixels / dpi) * 25.4;
}

export function describeMm(w: number, h: number): string {
  const cm = (mm: number) => (Math.round(mm / 10 * 10) / 10).toString().replace(".", ",");
  return `${cm(printMm(w))} × ${cm(printMm(h))} см`;
}

/**
 * The region of the source that fills a window of `win` output pixels.
 *
 * Clamped to the picture, which is what makes a small photograph behave: ask
 * for a thousand pixels of a three-hundred-pixel snapshot and you get all three
 * hundred rather than a region hanging off the edge.
 */
export function focusRegion(source: Size, win: Size, scale: number, focus: Size): Rect {
  const w = Math.min(source.w, Math.max(8, Math.round(win.w / scale)));
  const h = Math.min(source.h, Math.max(8, Math.round(win.h / scale)));
  const place = (centre: number, span: number, limit: number) =>
    Math.round(Math.max(0, Math.min(limit - span, centre * limit - span / 2)));
  return { x: place(focus.w, w, source.w), y: place(focus.h, h, source.h), w, h };
}

/** A box of the given aspect that fits the width available, under a ceiling. */
export function stageBox(available: number, aspect: number, maxHeight: number): Size {
  const w = Math.max(120, Math.floor(available));
  const h = w / Math.max(0.05, aspect);
  if (h <= maxHeight) return { w, h: Math.max(1, Math.round(h)) };
  return { w: Math.max(1, Math.round(maxHeight * Math.max(0.05, aspect))), h: maxHeight };
}

/**
 * How many pixels to compute per pixel of screen.
 *
 * On a dense display one CSS pixel is two device pixels, and computing only one
 * would hand the browser a soft preview to stretch — which hides the very grain
 * this page exists to judge. The budget is what one drag of a slider may cost,
 * and it is what stops a wide window on a 3× display from being charged for
 * nine times the work.
 */
export const PREVIEW_BUDGET = 2_200_000;

export function bufferRatio(box: Size, dpr: number, budget = PREVIEW_BUDGET): number {
  const wanted = Math.max(1, Math.min(2, dpr || 1));
  const affordable = Math.sqrt(budget / Math.max(1, box.w * box.h));
  return Math.max(1, Math.min(wanted, affordable));
}

function surface(w: number, h: number): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(w));
  canvas.height = Math.max(1, Math.round(h));
  return canvas;
}

function asCanvas(bitmap: Drawable): HTMLCanvasElement {
  if (bitmap instanceof HTMLCanvasElement) return bitmap;
  const canvas = surface(bitmap.width, bitmap.height);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0);
  return canvas;
}

/** `drawImage` at its best, which is what the untouched side has to be. */
function stretch(
  from: Drawable,
  region: Rect,
  out: Size,
): HTMLCanvasElement {
  const canvas = surface(out.w, out.h);
  const ctx = canvas.getContext("2d")!;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(from, region.x, region.y, region.w, region.h, 0, 0, canvas.width, canvas.height);
  return canvas;
}

/**
 * The picture fitted into the box — reduced if it has to be, never enlarged.
 *
 * The cap at 1 is load-bearing. Without it a small photograph was stretched by
 * the browser to fill the stage *before* the quality pass ran, so the pass was
 * reading interpolated pixels: grain came out looking coarser than it is and
 * the sharpening worked on detail that was never in the file. The preview must
 * not invent pixels either.
 */
export function contain(source: Size, box: Size): Size {
  const ratio = Math.min(1, box.w / Math.max(1, source.w), box.h / Math.max(1, source.h));
  return {
    w: Math.max(1, Math.round(source.w * ratio)),
    h: Math.max(1, Math.round(source.h * ratio)),
  };
}

export type Pair = {
  before: HTMLCanvasElement;
  after: HTMLCanvasElement;
  /** The window shown, in source pixels — null when the whole frame is shown. */
  region: Rect | null;
};

/** Long edge of the copy the exposure is measured on. */
const SAMPLE = 600;

/**
 * The exposure of the whole photograph, measured once.
 *
 * Measured on a reduced copy and then used by every view *and* by the file, so
 * the screen and the result agree by construction rather than by coincidence.
 * Reducing first costs a fraction of a level at the far ends of the histogram
 * and saves reading forty megapixels every time a slider moves.
 */
export function exposureOf(bitmap: Drawable): Levels | null {
  const ratio = Math.min(1, SAMPLE / Math.max(bitmap.width, bitmap.height));
  const canvas = surface(bitmap.width * ratio, bitmap.height * ratio);
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return null;
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  return levelsOf(ctx.getImageData(0, 0, canvas.width, canvas.height));
}

/**
 * The two canvases the comparison is drawn from, always the same size as each
 * other so one can be revealed over the other.
 */
export function previewPair(
  bitmap: Drawable,
  quality: Quality,
  view: View,
  focus: Size,
  buffer: Size,
  exposure: Levels | null,
): Pair {
  const settings = toEnhance(quality);
  const source = { w: bitmap.width, h: bitmap.height };

  if (view === "fit") {
    const box = contain(source, buffer);
    const before = stretch(bitmap, { x: 0, y: 0, ...source }, box);
    // No target size on purpose: reducing the whole frame to the screen and
    // then enlarging it again would show the filter working on pixels the real
    // run never sees. The enlargement is judged in the other view.
    const after = asCanvas(
      enhanceSource({ bitmap: before, bounds: fullBounds(before) }, settings, undefined, exposure)
        .bitmap,
    );
    return { before, after, region: null };
  }

  const region = focusRegion(source, buffer, quality.scale, focus);
  const cut = stretch(bitmap, region, { w: region.w, h: region.h });
  const out = { w: Math.round(region.w * quality.scale), h: Math.round(region.h * quality.scale) };
  const before = stretch(cut, { x: 0, y: 0, w: region.w, h: region.h }, out);
  const grown = enhanceSource({ bitmap: cut, bounds: fullBounds(cut) }, settings, out, exposure);
  const after = asCanvas(grown.bitmap);
  return { before, after, region };
}

/** The whole photograph, at full size — what actually gets saved. */
export function finalCanvas(
  bitmap: Drawable,
  quality: Quality,
  exposure: Levels | null,
): HTMLCanvasElement {
  const plan = resultSize({ w: bitmap.width, h: bitmap.height }, quality.scale);
  const source = { bitmap, bounds: fullBounds(bitmap) };
  const result = enhanceSource(source, toEnhance(quality), { w: plan.w, h: plan.h }, exposure);
  return asCanvas(result.bitmap);
}

/** The raster ceiling, surfaced so the page can explain the cap it just hit. */
export const EDGE_LIMIT = MAX_EDGE;
