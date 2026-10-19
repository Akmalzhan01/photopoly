/**
 * Print sheets: tile the finished photo across a standard paper size so one
 * print yields several copies to cut apart.
 */

import { drawCard, drawMark, EDGE_MM, hasImprint, markRoom, type Imprint } from "./imprint";

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
};

export const mmToPx = (mm: number, dpi: number) => (mm * dpi) / 25.4;

/** How far the crop ticks reach into the margin, in millimetres. */
const tickLength = (margin: number) => Math.max(2.5, Math.min(margin * 0.7, 5));

/**
 * Whether a card would be printed, and why not when it would not be. The panel
 * says this out loud rather than leaving a switch that quietly does nothing.
 */
export function cardFits(
  spec: Pick<SheetSpec, "copies" | "imprint">,
  layout: SheetLayout,
): { card: boolean; reason: "no-text" | "off" | "full" | null } {
  if (!hasImprint(spec.imprint)) return { card: false, reason: "no-text" };
  if (!spec.imprint.card) return { card: false, reason: "off" };
  const used = Math.max(0, Math.min(spec.copies, layout.capacity));
  if (used >= layout.capacity) return { card: false, reason: "full" };
  return { card: true, reason: null };
}

/** What the two "does it fit" answers need to know — the panel has no dpi. */
type SheetShape = Pick<SheetSpec, "sheetH" | "gap" | "margin" | "cutMarks" | "copies" | "imprint">;

/** Bottom edge of the last printed row, in millimetres from the sheet's top. */
function bottomOf(spec: SheetShape, layout: SheetLayout, cells: number): number {
  const rows = Math.max(1, Math.ceil(cells / Math.max(1, layout.cols)));
  return layout.originY + rows * layout.cellH + (rows - 1) * spec.gap;
}

/**
 * Clear millimetres between the last printed row and the printer's dead band.
 * Counts the card, which may start a row of its own and leave no margin at all.
 */
export function markFits(spec: SheetShape, layout: SheetLayout): number {
  const used = Math.max(0, Math.min(spec.copies, layout.capacity));
  const cells = used + (cardFits(spec, layout).card ? 1 : 0);
  const tick = spec.cutMarks ? tickLength(spec.margin) : 0;
  return markRoom(spec.sheetH, bottomOf(spec, layout, cells), tick);
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

  const count = Math.max(0, Math.min(spec.copies, layout.capacity));
  const cellW = px(layout.cellW);
  const cellH = px(layout.cellH);

  const cellAt = (index: number) => {
    const col = index % layout.cols;
    const row = Math.floor(index / layout.cols);
    return {
      x: px(layout.originX + col * (layout.cellW + spec.gap)),
      y: px(layout.originY + row * (layout.cellH + spec.gap)),
    };
  };

  for (let index = 0; index < count; index++) {
    const { x, y } = cellAt(index);
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

  // The card takes the first cell the order left empty, so every copy that was
  // paid for still gets printed and the card costs no paper at all.
  const { card } = cardFits(spec, layout);
  if (card && spec.imprint) {
    const col = count % layout.cols;
    const row = Math.floor(count / layout.cols);
    drawCard(
      { ctx, px },
      {
        x: layout.originX + col * (layout.cellW + spec.gap),
        y: layout.originY + row * (layout.cellH + spec.gap),
        w: layout.cellW,
        h: layout.cellH,
      },
      spec.imprint,
      !spec.cutMarks,
    );
  }

  const printed = count + (card ? 1 : 0);
  if (spec.cutMarks && printed > 0) {
    // The card is cut out like everything else, so it gets its own marks.
    drawCutMarks(ctx, canvas, spec, layout, printed, px);
  }

  if (spec.imprint?.mark && hasImprint(spec.imprint)) {
    const tick = spec.cutMarks ? tickLength(spec.margin) : 0;
    const room = markRoom(spec.sheetH, bottomOf(spec, layout, printed), tick);
    // Sat on the far side of the clear band, one text height up from the dead
    // band at the paper's edge.
    const baseline = spec.sheetH - EDGE_MM - Math.min(1, room * 0.2);
    drawMark({ ctx, px }, spec.sheetW, baseline, room, spec.imprint);
  }

  return canvas;
}

function drawCutMarks(
  ctx: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  spec: SheetSpec,
  layout: SheetLayout,
  count: number,
  px: (mm: number) => number,
) {
  const usedRows = Math.ceil(count / layout.cols);
  const usedCols = Math.min(count, layout.cols);
  const lineWidth = Math.max(1, Math.round(px(0.12)));
  const tick = px(tickLength(spec.margin));

  const xEdges: number[] = [];
  for (let col = 0; col < usedCols; col++) {
    const left = layout.originX + col * (layout.cellW + spec.gap);
    xEdges.push(px(left), px(left + layout.cellW));
  }
  const yEdges: number[] = [];
  for (let row = 0; row < usedRows; row++) {
    const top = layout.originY + row * (layout.cellH + spec.gap);
    yEdges.push(px(top), px(top + layout.cellH));
  }

  ctx.save();
  ctx.lineWidth = lineWidth;

  // Faint guides across the sheet, so scissors have something to follow.
  ctx.strokeStyle = "rgba(0,0,0,0.28)";
  ctx.setLineDash([px(1.4), px(1.4)]);
  const top = Math.min(...yEdges);
  const bottom = Math.max(...yEdges);
  const left = Math.min(...xEdges);
  const right = Math.max(...xEdges);
  for (const x of xEdges) {
    ctx.beginPath();
    ctx.moveTo(x, top);
    ctx.lineTo(x, bottom);
    ctx.stroke();
  }
  for (const y of yEdges) {
    ctx.beginPath();
    ctx.moveTo(left, y);
    ctx.lineTo(right, y);
    ctx.stroke();
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
