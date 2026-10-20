/**
 * Print sheets: tile the finished photo across a standard paper size so one
 * print yields several copies to cut apart.
 */

import { drawCard, drawMark, EDGE_MM, hasImprint, markRoom, type Box, type Imprint } from "./imprint";

export type SheetPreset = {
  id: string;
  label: string;
  note: string;
  /** Millimetres. */
  width: number;
  height: number;
};

export const SHEET_PRESETS: SheetPreset[] = [
  { id: "10x15", label: "10 × 15 см", note: "Самый ходовой", width: 100, height: 150 },
  { id: "13x18", label: "13 × 18 см", note: "Лист побольше", width: 130, height: 180 },
  { id: "15x21", label: "15 × 21 см", note: "Половина A4", width: 150, height: 210 },
  { id: "a4", label: "A4", note: "210 × 297 мм", width: 210, height: 297 },
  { id: "4x6in", label: "4 × 6 дюйма", note: "Американская печать", width: 101.6, height: 152.4 },
  { id: "letter", label: "Letter", note: "216 × 279 мм", width: 215.9, height: 279.4 },
];

export function findSheet(id: string): SheetPreset | undefined {
  return SHEET_PRESETS.find((sheet) => sheet.id === id);
}

export type SheetLayout = {
  cols: number;
  rows: number;
  /** Slots available on the sheet. */
  capacity: number;
  /** Whether photos sit turned 90°, which often fits more of them. */
  rotated: boolean;
  /** Millimetres, in sheet space. */
  cellW: number;
  cellH: number;
  originX: number;
  originY: number;
};

export type SheetSpec = {
  /** Sheet size in millimetres. */
  sheetW: number;
  sheetH: number;
  /** Photo size in millimetres. */
  photoW: number;
  photoH: number;
  gap: number;
  margin: number;
  dpi: number;
  copies: number;
  cutMarks: boolean;
  /**
   * The studio's name and number. Printed in a cell the order left empty and in
   * the paper's margin — never over a photograph, and never on the single-photo
   * export, which has no sheet at all.
   */
  imprint?: Imprint;
  /**
   * Where the studio dragged the photos to: the top-left corner of the group
   * (photos and card together), in millimetres. `null` or absent lays them out
   * by themselves.
   */
  blockAt?: { x: number; y: number } | null;
};

export const mmToPx = (mm: number, dpi: number) => (mm * dpi) / 25.4;

/** How far the crop ticks reach into the margin, in millimetres. */
const tickLength = (margin: number) => Math.max(2.5, Math.min(margin * 0.7, 5));

/** Narrowest and widest the studio's strip beside the photos is drawn, in millimetres. */
export const STRIP_MIN = 6;
const STRIP_MAX = 12;

type StripShape = Pick<SheetSpec, "sheetW" | "gap" | "margin">;

/** Width of the photo block, in millimetres. */
const blockWidth = (spec: Pick<SheetSpec, "gap">, layout: SheetLayout) =>
  layout.cols > 0 ? layout.cols * layout.cellW + (layout.cols - 1) * spec.gap : 0;

/**
 * Room for a strip once the photos are moved against the left margin: what is
 * left on the right after the block and one gap, short of the right margin and
 * the printer's dead band.
 */
function stripRoom(spec: StripShape, layout: SheetLayout): number {
  const right = spec.sheetW - Math.max(spec.margin, EDGE_MM);
  return right - (spec.margin + blockWidth(spec, layout) + spec.gap);
}

/**
 * Whether a card would be printed, and why not when it would not be. The panel
 * says this out loud rather than leaving a switch that quietly does nothing.
 */
export function cardFits(
  spec: Pick<SheetSpec, "copies" | "imprint"> & StripShape,
  layout: SheetLayout,
): { card: boolean; reason: "no-text" | "off" | "full" | null } {
  if (!hasImprint(spec.imprint)) return { card: false, reason: "no-text" };
  if (!spec.imprint.card) return { card: false, reason: "off" };
  if (stripRoom(spec, layout) >= STRIP_MIN) return { card: true, reason: null };
  const used = Math.max(0, Math.min(spec.copies, layout.capacity));
  if (used >= layout.capacity) return { card: false, reason: "full" };
  return { card: true, reason: null };
}

/** What the two "does it fit" answers need to know — the panel has no dpi. */
type SheetShape = Pick<SheetSpec, "sheetW" | "sheetH" | "gap" | "margin" | "cutMarks" | "copies" | "imprint" | "blockAt">;

/** Where everything on a sheet goes, in millimetres. */
export type Arrangement = { photos: Box[]; card: Box | null };

/**
 * Places the photographs and the studio's card.
 *
 * Without a card the photos fill the sheet row by row, centred, as they always
 * have. With one, the photos keep that order but move against the left margin,
 * and the card becomes a narrow strip down the right-hand side, as tall as the
 * rows the photos take: four 3×4 on a 10×15 give it the top half, eight the
 * whole height. It costs no photo a cell, so even a full sheet gets one.
 *
 * Where the photos already fill the width, there is no strip to be had, and
 * the card takes cells the order left empty instead: the photos go down the
 * left-hand column and the card takes the column beside them from the top.
 */
export function arrange(
  spec: Pick<SheetSpec, "copies" | "imprint" | "sheetH" | "blockAt"> & StripShape,
  layout: SheetLayout,
): Arrangement {
  const placed = arrangeInPlace(spec, layout);
  return spec.blockAt ? moved(placed, spec, spec.blockAt) : placed;
}

/** The box round everything printed, or `null` for an empty sheet. */
export function groupBounds(placed: Arrangement): Box | null {
  const boxes = placed.card ? [...placed.photos, placed.card] : placed.photos;
  if (boxes.length === 0) return null;
  const x = Math.min(...boxes.map((b) => b.x));
  const y = Math.min(...boxes.map((b) => b.y));
  const right = Math.max(...boxes.map((b) => b.x + b.w));
  const bottom = Math.max(...boxes.map((b) => b.y + b.h));
  return { x, y, w: right - x, h: bottom - y };
}

/**
 * The same arrangement with its top-left corner at `to`, kept out of the
 * printer's dead band at the paper's edge. A group already closer to the edge
 * than that (margins set to nothing) may stay where it was laid out, but is
 * never dragged further out.
 */
function moved(placed: Arrangement, sheet: Pick<SheetSpec, "sheetW" | "sheetH">, to: { x: number; y: number }): Arrangement {
  const group = groupBounds(placed);
  if (!group) return placed;
  const fit = (value: number, at: number, size: number, extent: number) =>
    Math.min(Math.max(extent - EDGE_MM - size, at), Math.max(Math.min(EDGE_MM, at), value));
  const dx = fit(to.x, group.x, group.w, sheet.sheetW) - group.x;
  const dy = fit(to.y, group.y, group.h, sheet.sheetH) - group.y;
  const shift = (box: Box): Box => ({ ...box, x: box.x + dx, y: box.y + dy });
  return { photos: placed.photos.map(shift), card: placed.card ? shift(placed.card) : null };
}

function arrangeInPlace(spec: Pick<SheetSpec, "copies" | "imprint"> & StripShape, layout: SheetLayout): Arrangement {
  const count = Math.max(0, Math.min(spec.copies, layout.capacity));
  const at = (col: number, row: number, span = 1, left = layout.originX): Box => ({
    x: left + col * (layout.cellW + spec.gap),
    y: layout.originY + row * (layout.cellH + spec.gap),
    w: layout.cellW,
    h: span * layout.cellH + (span - 1) * spec.gap,
  });

  if (!cardFits(spec, layout).card) {
    const photos = Array.from({ length: count }, (_, i) => at(i % layout.cols, Math.floor(i / layout.cols)));
    return { photos, card: null };
  }

  const room = stripRoom(spec, layout);
  if (room >= STRIP_MIN) {
    const width = Math.min(room, STRIP_MAX);
    // Photos and strip together, centred in what the margins leave, so a wide
    // sheet does not push the photos hard left and the strip far away.
    const left = spec.margin + (room - width) / 2;
    const photos = Array.from({ length: count }, (_, i) => at(i % layout.cols, Math.floor(i / layout.cols), 1, left));
    const rows = Math.max(1, Math.ceil(count / Math.max(1, layout.cols)));
    const band = at(0, 0, rows, left);
    return {
      photos,
      card: { x: left + blockWidth(spec, layout) + spec.gap, y: band.y, w: width, h: band.h },
    };
  }

  const rows = layout.rows;
  const cols = layout.cols;
  // A single column has nowhere beside the photos: the card goes under them.
  if (cols < 2) {
    const photos = Array.from({ length: count }, (_, i) => at(0, i));
    return { photos, card: at(0, count) };
  }

  if (count <= rows) {
    const photos = Array.from({ length: count }, (_, i) => at(0, i));
    return { photos, card: at(1, 0, Math.max(1, count)) };
  }

  const full = Math.floor(count / rows);
  const spill = count % rows;
  const photos: Box[] = [];
  for (let col = 0; col < full; col++) for (let row = 0; row < rows; row++) photos.push(at(col, row));
  // The last column fills from the bottom up, keeping its free cells on top.
  for (let i = 0; i < spill; i++) photos.push(at(full, rows - spill + i));
  return { photos, card: at(full, 0, spill > 0 ? rows - spill : rows) };
}

/** Bottom edge of whatever is printed lowest, in millimetres from the sheet's top. */
function bottomOf(placed: Arrangement, layout: SheetLayout): number {
  const boxes = placed.card ? [...placed.photos, placed.card] : placed.photos;
  if (boxes.length === 0) return layout.originY + layout.cellH;
  return Math.max(...boxes.map((box) => box.y + box.h));
}

/**
 * Clear millimetres between the lowest printed cell and the printer's dead
 * band. Counts the card, which may take a row of its own and leave no margin.
 */
export function markFits(spec: SheetShape, layout: SheetLayout): number {
  const tick = spec.cutMarks ? tickLength(spec.margin) : 0;
  return markRoom(spec.sheetH, bottomOf(arrange(spec, layout), layout), tick);
}

function grid(
  availW: number,
  availH: number,
  cellW: number,
  cellH: number,
  gap: number,
): { cols: number; rows: number } {
  // n cells plus (n-1) gaps must fit: n*(cell+gap) - gap <= avail
  const cols = Math.floor((availW + gap) / (cellW + gap));
  const rows = Math.floor((availH + gap) / (cellH + gap));
  return { cols: Math.max(0, cols), rows: Math.max(0, rows) };
}

/**
 * Chooses the orientation that fits the most copies, preferring upright on a tie.
 * Turning photos sideways is what gets eight 3×4 cm shots onto a 10×15 print
 * instead of six, but `allowRotate: false` keeps them the way up they were shot.
 */
export function planSheet(
  spec: Omit<SheetSpec, "copies" | "cutMarks" | "dpi">,
  allowRotate = true,
): SheetLayout {
  const { sheetW, sheetH, photoW, photoH, gap, margin } = spec;
  const availW = Math.max(0, sheetW - margin * 2);
  const availH = Math.max(0, sheetH - margin * 2);

  const upright = grid(availW, availH, photoW, photoH, gap);
  const turned = grid(availW, availH, photoH, photoW, gap);

  const uprightCount = upright.cols * upright.rows;
  const turnedCount = turned.cols * turned.rows;
  const rotated = allowRotate && turnedCount > uprightCount;

  const { cols, rows } = rotated ? turned : upright;
  const cellW = rotated ? photoH : photoW;
  const cellH = rotated ? photoW : photoH;

  const blockW = cols > 0 ? cols * cellW + (cols - 1) * gap : 0;
  const blockH = rows > 0 ? rows * cellH + (rows - 1) * gap : 0;

  return {
    cols,
    rows,
    capacity: cols * rows,
    rotated,
    cellW,
    cellH,
    originX: (sheetW - blockW) / 2,
    originY: (sheetH - blockH) / 2,
  };
}

export function composeSheet(
  photo: HTMLCanvasElement,
  spec: SheetSpec,
  layout: SheetLayout,
  target?: HTMLCanvasElement,
): HTMLCanvasElement {
  const canvas = target ?? document.createElement("canvas");
  const px = (mm: number) => mmToPx(mm, spec.dpi);

  canvas.width = Math.max(1, Math.round(px(spec.sheetW)));
  canvas.height = Math.max(1, Math.round(px(spec.sheetH)));

  const ctx = canvas.getContext("2d");
  if (!ctx) return canvas;

  // Paper.
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";

  const placed = arrange(spec, layout);
  const cellW = px(layout.cellW);
  const cellH = px(layout.cellH);

  for (const cell of placed.photos) {
    const x = px(cell.x);
    const y = px(cell.y);
    if (layout.rotated) {
      ctx.save();
      ctx.translate(x + cellW / 2, y + cellH / 2);
      ctx.rotate(-Math.PI / 2);
      // After rotating, the photo's own width runs along the cell's height.
      ctx.drawImage(photo, -cellH / 2, -cellW / 2, cellH, cellW);
      ctx.restore();
    } else {
      ctx.drawImage(photo, x, y, cellW, cellH);
    }
  }

  // The card takes cells the order left empty, so every copy that was paid
  // for still gets printed and the card costs no paper at all.
  if (placed.card && spec.imprint) {
    drawCard({ ctx, px }, placed.card, spec.imprint, !spec.cutMarks);
  }

  const boxes = placed.card ? [...placed.photos, placed.card] : placed.photos;
  if (spec.cutMarks && boxes.length > 0) {
    // The card is cut out like everything else, so it gets its own marks.
    drawCutMarks(ctx, canvas, spec, boxes, px);
  }

  if (spec.imprint?.mark && hasImprint(spec.imprint)) {
    const tick = spec.cutMarks ? tickLength(spec.margin) : 0;
    const room = markRoom(spec.sheetH, bottomOf(placed, layout), tick);
    // Sat on the far side of the clear band, one text height up from the dead
    // band at the paper's edge.
    const baseline = spec.sheetH - EDGE_MM - Math.min(1, room * 0.2);
    drawMark({ ctx, px }, spec.sheetW, baseline, room, spec.imprint);
  }

  return canvas;
}

/** Parts of the line from `from` to `to` that are left once `blocked` is taken out. */
function openSpans(from: number, to: number, blocked: [number, number][]): [number, number][] {
  const spans: [number, number][] = [];
  let start = from;
  for (const [a, b] of [...blocked].sort((p, q) => p[0] - q[0])) {
    if (a > start) spans.push([start, Math.min(a, to)]);
    start = Math.max(start, b);
  }
  if (start < to) spans.push([start, to]);
  return spans.filter(([a, b]) => b > a);
}

function drawCutMarks(
  ctx: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  spec: SheetSpec,
  boxes: Box[],
  px: (mm: number) => number,
) {
  const lineWidth = Math.max(1, Math.round(px(0.12)));
  const tick = px(tickLength(spec.margin));
  const unique = (values: number[]) => [...new Set(values.map((v) => Math.round(v * 1000) / 1000))].map(px);

  const xEdges = unique(boxes.flatMap((box) => [box.x, box.x + box.w]));
  const yEdges = unique(boxes.flatMap((box) => [box.y, box.y + box.h]));
  const scaled = boxes.map((box) => ({ x: px(box.x), y: px(box.y), w: px(box.w), h: px(box.h) }));
  const inside = (value: number, start: number, size: number) => value > start + 0.5 && value < start + size - 0.5;

  ctx.save();
  ctx.lineWidth = lineWidth;

  // Faint guides across the sheet, so scissors have something to follow —
  // except across the card, which spans rows the photos beside it divide.
  ctx.strokeStyle = "rgba(0,0,0,0.28)";
  ctx.setLineDash([px(1.4), px(1.4)]);
  const top = Math.min(...yEdges);
  const bottom = Math.max(...yEdges);
  const left = Math.min(...xEdges);
  const right = Math.max(...xEdges);
  for (const x of xEdges) {
    const blocked = scaled.filter((b) => inside(x, b.x, b.w)).map((b): [number, number] => [b.y, b.y + b.h]);
    for (const [a, b] of openSpans(top, bottom, blocked)) {
      ctx.beginPath();
      ctx.moveTo(x, a);
      ctx.lineTo(x, b);
      ctx.stroke();
    }
  }
  for (const y of yEdges) {
    const blocked = scaled.filter((b) => inside(y, b.y, b.h)).map((b): [number, number] => [b.x, b.x + b.w]);
    for (const [a, b] of openSpans(left, right, blocked)) {
      ctx.beginPath();
      ctx.moveTo(a, y);
      ctx.lineTo(b, y);
      ctx.stroke();
    }
  }

  // Solid crop ticks reaching into the paper margin.
  ctx.setLineDash([]);
  ctx.strokeStyle = "rgba(0,0,0,0.75)";
  for (const x of xEdges) {
    ctx.beginPath();
    ctx.moveTo(x, Math.max(0, top - tick));
    ctx.lineTo(x, top);
    ctx.moveTo(x, bottom);
    ctx.lineTo(x, Math.min(canvas.height, bottom + tick));
    ctx.stroke();
  }
  for (const y of yEdges) {
    ctx.beginPath();
    ctx.moveTo(Math.max(0, left - tick), y);
    ctx.lineTo(left, y);
    ctx.moveTo(right, y);
    ctx.lineTo(Math.min(canvas.width, right + tick), y);
    ctx.stroke();
  }

  ctx.restore();
}
