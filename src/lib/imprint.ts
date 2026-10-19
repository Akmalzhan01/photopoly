/**
 * The studio's own name and number, printed on a sheet.
 *
 * The one rule this module exists to keep: **nothing is ever drawn on a
 * photograph.** A 3×4 for a passport or a visa is refused at the counter if it
 * carries text, and the customer blames the studio that printed it, so the
 * imprint only goes where a photograph is not:
 *
 * - **A card in a spare cell.** A 10×15 sheet holds eight 3×4 shots and most
 *   orders are four or six, so two to four cells print as blank paper and are
 *   thrown away after cutting. One of them becomes a 40×30 mm card the customer
 *   keeps — which is the only placement with any advertising value at all, since
 *   it is the only one that survives the scissors.
 * - **A line in the sheet's own margin.** Free and harmless, but cut off and
 *   binned unless the sheet is handed over whole.
 *
 * Neither is reachable from the single-photo export path, and that is deliberate
 * rather than incidental: a file with a phone number on it uploaded to an online
 * visa application is a rejected application.
 */

export type Imprint = {
  name: string;
  phone: string;
  /** Print a card in the first cell the order left empty. */
  card: boolean;
  /** Print one line in the sheet's margin. */
  mark: boolean;
};

export const EMPTY_IMPRINT: Imprint = { name: "", phone: "", card: true, mark: false };

/** Nothing to say means nothing is printed, whatever the switches are set to. */
export function hasImprint(imprint: Imprint | undefined): imprint is Imprint {
  return Boolean(imprint && (imprint.name.trim() || imprint.phone.trim()));
}

/**
 * Printers do not reach the edge of the paper. Three millimetres is the usual
 * dead band, and text that strays into it comes out clipped or not at all.
 */
export const EDGE_MM = 3;

/** The smallest band of margin a line of text can be read in. */
export const MARK_MIN_MM = 5;

export type Box = { x: number; y: number; w: number; h: number };

type Pen = {
  ctx: CanvasRenderingContext2D;
  /** Millimetres to device pixels. */
  px: (mm: number) => number;
};

const FAMILY = `"Segoe UI", system-ui, -apple-system, "Helvetica Neue", Arial, sans-serif`;

/**
 * The largest size at or below `startMm` that fits `maxMm`, or `null` when even
 * the floor is too wide. Shrinking beats clipping: a studio name is a name, and
 * half of one is worse than a small one.
 */
function fitted(
  pen: Pen,
  text: string,
  maxMm: number,
  startMm: number,
  weight: string,
  floorMm = 1.6,
): number | null {
  for (let size = startMm; size >= floorMm; size -= 0.1) {
    pen.ctx.font = `${weight} ${pen.px(size)}px ${FAMILY}`;
    if (pen.ctx.measureText(text).width <= pen.px(maxMm)) return size;
  }
  return null;
}

/**
 * A card in `box`, which is one cell of the sheet in millimetres.
 *
 * `border` draws the card's own edge, and is for sheets printed without cut
 * marks: there would otherwise be nothing on the paper to say where the
 * scissors go, and a card cut by eye looks like a mistake rather than a card.
 * With cut marks on it is left off, because two lines in the same place is one
 * line too many.
 */
export function drawCard(pen: Pen, box: Box, imprint: Imprint, border = true): void {
  const { ctx, px } = pen;
  const name = imprint.name.trim();
  const phone = imprint.phone.trim();
  if (!name && !phone) return;

  const pad = Math.min(2.4, box.w * 0.08, box.h * 0.08);
  const innerW = box.w - pad * 2;
  if (innerW <= 2) return;

  ctx.save();

  if (border) {
    ctx.strokeStyle = "rgba(0,0,0,0.22)";
    ctx.lineWidth = Math.max(1, px(0.15));
    ctx.strokeRect(px(box.x), px(box.y), px(box.w), px(box.h));
  }

  ctx.textAlign = "center";
  // Centred on the line rather than sat on its baseline: the block is placed by
  // arithmetic, and ascent-as-height puts an evenly spaced card visibly high.
  ctx.textBaseline = "middle";

  // Sized off the card, not off the paper: the same card has to read on a cell
  // turned on its side (40 × 30) and one standing up (30 × 40).
  const nameSize = name ? fitted(pen, name, innerW, Math.min(4.8, box.h * 0.2), "600") : null;
  // A long name shrinks to fit, and the number must not then tower over it —
  // the name is what someone reads first on a card.
  const phoneCap = Math.min(4.2, box.h * 0.17, nameSize ?? Infinity);
  const phoneSize = phone ? fitted(pen, phone, innerW, phoneCap, "500") : null;

  const gap = Math.min(1.8, box.h * 0.07);
  const blockH = (nameSize ?? 0) + (phoneSize ?? 0) + (nameSize && phoneSize ? gap : 0);
  let cursor = box.y + (box.h - blockH) / 2;
  const middle = px(box.x + box.w / 2);

  if (nameSize) {
    ctx.font = `600 ${px(nameSize)}px ${FAMILY}`;
    ctx.fillStyle = "#111111";
    ctx.fillText(name, middle, px(cursor + nameSize / 2));
    cursor += nameSize + gap;
  }
  if (phoneSize) {
    ctx.font = `500 ${px(phoneSize)}px ${FAMILY}`;
    ctx.fillStyle = "#1a1a1a";
    ctx.fillText(phone, middle, px(cursor + phoneSize / 2));
  }

  ctx.restore();
}

/** How much clear margin a sheet has below its photographs, in millimetres. */
export function markRoom(sheetH: number, blockBottom: number, tick: number): number {
  return sheetH - blockBottom - tick - EDGE_MM;
}

/**
 * One line centred in the sheet's bottom margin. `room` comes from `markRoom`,
 * and when there is not enough of it the line is dropped rather than squeezed
 * into the printer's dead band, where it would come out half-missing.
 */
export function drawMark(pen: Pen, sheetW: number, baseline: number, room: number, imprint: Imprint): void {
  if (room < MARK_MIN_MM) return;
  const parts = [imprint.name.trim(), imprint.phone.trim()].filter(Boolean);
  if (parts.length === 0) return;

  const { ctx, px } = pen;
  const text = parts.join("   ·   ");
  const size = fitted(pen, text, sheetW - EDGE_MM * 2, Math.min(3, room * 0.6), "500");
  if (size === null) return;

  ctx.save();
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  ctx.font = `500 ${px(size)}px ${FAMILY}`;
  ctx.fillStyle = "rgba(0,0,0,0.62)";
  ctx.fillText(text, px(sheetW / 2), px(baseline));
  ctx.restore();
}
