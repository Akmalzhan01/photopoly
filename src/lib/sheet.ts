/**
 * Print sheets: tile the finished photo across a standard paper size so one
 * print yields several copies to cut apart.
 */

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
};

export const mmToPx = (mm: number, dpi: number) => (mm * dpi) / 25.4;

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

  if (spec.cutMarks && count > 0) {
    drawCutMarks(ctx, canvas, spec, layout, count, px);
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
  const tick = px(Math.max(2.5, Math.min(spec.margin * 0.7, 5)));

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
