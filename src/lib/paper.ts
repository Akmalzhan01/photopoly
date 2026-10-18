/**
 * Laying scans out on a sheet of paper: the front and back of an ID card on
 * one A4, the way a copy shop would photocopy them.
 *
 * Everything here is in millimetres, so a card placed at its real size prints
 * at its real size whatever the sheet's resolution turns out to be.
 */

export type SheetSize = "a4" | "a5" | "a3" | "letter";
export type Orientation = "portrait" | "landscape";
export type Dims = { w: number; h: number };

export const SHEET_SIZES: Record<SheetSize, { label: string; title: string } & Dims> = {
  a4: { label: "A4", title: "210 × 297 мм", w: 210, h: 297 },
  a5: { label: "A5", title: "148 × 210 мм", w: 148, h: 210 },
  a3: { label: "A3", title: "297 × 420 мм", w: 297, h: 420 },
  letter: { label: "Letter", title: "216 × 279 мм", w: 215.9, h: 279.4 },
};

/** One scan on a sheet. Its height follows from the scan's own proportions. */
export type Placed = { id: string; pageId: string; x: number; y: number; w: number };

export const MARGIN = 10;
export const MIN_WIDTH = 15;
/** Room left between a new scan and the one above it. */
const GAP = 8;

/** Documents people copy most, by their real long and short edge. */
export const KNOWN_SIZES = [
  { label: "ID-карта", title: "85,6 × 54 мм — паспорт-карта, права, банковская карта", long: 85.6, short: 53.98 },
  { label: "Паспорт", title: "125 × 88 мм — разворот паспорта-книжки", long: 125, short: 88 },
];

export function sheetDims(size: SheetSize, orientation: Orientation): Dims {
  const { w, h } = SHEET_SIZES[size];
  return orientation === "portrait" ? { w, h } : { w: h, h: w };
}

/** The widest a scan of this shape (height ÷ width) can be and still fit. */
export function widest(aspect: number, sheet: Dims): number {
  return Math.min(sheet.w, sheet.h / aspect);
}

/** Width at which the scan's long edge measures `long` millimetres. */
export function widthForLongEdge(aspect: number, long: number): number {
  return aspect <= 1 ? long : long / aspect;
}

/** Width that fills the sheet between the margins. */
export function fullWidth(aspect: number, sheet: Dims): number {
  return Math.min(sheet.w - 2 * MARGIN, (sheet.h - 2 * MARGIN) / aspect);
}

/** Keeps a scan its size and inside the paper. */
export function clampPlaced(item: Placed, aspect: number, sheet: Dims): Placed {
  const w = Math.min(widest(aspect, sheet), Math.max(MIN_WIDTH, item.w));
  const h = w * aspect;
  return {
    ...item,
    w,
    x: Math.min(sheet.w - w, Math.max(0, item.x)),
    y: Math.min(sheet.h - h, Math.max(0, item.y)),
  };
}

/**
 * The size a scan arrives at. A card-shaped scan is almost certainly a card,
 * so it comes in at the size of one; anything else takes half the sheet, which
 * leaves room for a second side underneath.
 */
function arrivalWidth(aspect: number, sheet: Dims): number {
  const ratio = Math.min(aspect, 1 / aspect);
  const card = KNOWN_SIZES[0];
  if (Math.abs(ratio - card.short / card.long) / (card.short / card.long) < 0.06) {
    return widthForLongEdge(aspect, card.long);
  }
  return Math.min(sheet.w - 2 * MARGIN, (sheet.h / 2 - 1.5 * MARGIN) / aspect);
}

/** Where a new scan goes: centred, under whatever is on the sheet already. */
export function placeNew(
  id: string,
  pageId: string,
  aspect: number,
  existing: Placed[],
  aspectOf: (pageId: string) => number,
  sheet: Dims,
): Placed {
  const w = arrivalWidth(aspect, sheet);
  const h = w * aspect;
  const bottom = existing.reduce((low, item) => Math.max(low, item.y + item.w * aspectOf(item.pageId)), 0);
  let y = existing.length > 0 ? bottom + GAP : MARGIN;
  let x = (sheet.w - w) / 2;
  if (y + h > sheet.h - MARGIN) {
    // No room left below: stagger from the top so it doesn't hide exactly
    // behind another scan.
    const step = 6 * (existing.length % 8);
    y = MARGIN + step;
    x += step;
  }
  return clampPlaced({ id, pageId, x, y, w }, aspect, sheet);
}

/** Phones and Safari refuse canvases much past 16 megapixels. */
const MAX_SHEET_PIXELS = 16_000_000;
const PRINT_DPI = 300;

/** A hairline round each scan to cut along: white card on white paper has no edge otherwise. */
export const CUT_LINE_MM = 0.2;
export const CUT_LINE_COLOUR = "#9ca3af";

/** Draws a sheet for printing: white paper, scans at their places, 300 dpi or near it. */
export function renderSheet(
  items: Placed[],
  sheet: Dims,
  pictureOf: (pageId: string) => HTMLCanvasElement | undefined,
  cutLines = false,
): HTMLCanvasElement {
  const perMm = Math.min(PRINT_DPI / 25.4, Math.sqrt(MAX_SHEET_PIXELS / (sheet.w * sheet.h)));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(sheet.w * perMm);
  canvas.height = Math.round(sheet.h * perMm);
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.imageSmoothingQuality = "high";
  for (const item of items) {
    const picture = pictureOf(item.pageId);
    if (!picture) continue;
    const w = item.w * perMm;
    const h = w * (picture.height / picture.width);
    ctx.drawImage(picture, item.x * perMm, item.y * perMm, w, h);
    if (cutLines) {
      const line = CUT_LINE_MM * perMm;
      ctx.strokeStyle = CUT_LINE_COLOUR;
      ctx.lineWidth = line;
      ctx.strokeRect(item.x * perMm + line / 2, item.y * perMm + line / 2, w - line, h - line);
    }
  }
  return canvas;
}

/** Millimetres the way a ruler reads them: whole, or with one decimal when it matters. */
export function mm(value: number): string {
  const rounded = Math.round(value * 10) / 10;
  return (Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1)).replace(".", ",");
}
