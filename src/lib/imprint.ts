/**
 * The studio's own name and number, printed on a sheet.
 *
 * The one rule this module exists to keep: **nothing is ever drawn on a
 * photograph.** A 3×4 for a passport or a visa is refused at the counter if it
 * carries text, and the customer blames the studio that printed it, so the
 * imprint only goes where a photograph is not:
 *
 * - **A card beside the photographs.** With a card on, the photos move against
 *   the left margin and the card runs down the narrow strip that frees on the
 *   right, as tall as the rows of photos — the customer keeps it, which makes
 *   it the only placement with any advertising value, since it survives the
 *   scissors. It takes no cell, so a full sheet gets one too. Where the
 *   photos already fill the width, it takes the cells the order left empty.
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
  /** An address or a slogan, printed small under the number. Card only. */
  note?: string;
  /** The card's accent: its band, badge and phone mark. */
  colour?: string;
  /** Print a card in the cells the order left empty. See `arrange` in sheet.ts. */
  card: boolean;
  /** Print one line in the sheet's margin. */
  mark: boolean;
};

export const DEFAULT_COLOUR = "#1d4ed8";

export const EMPTY_IMPRINT: Imprint = { name: "", phone: "", note: "", colour: DEFAULT_COLOUR, card: true, mark: false };

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

/** The family the site itself is set in (Onest), so the card matches the brand; the stack behind it if not loaded. */
function family(): string {
  if (typeof document === "undefined") return FAMILY;
  const own = getComputedStyle(document.body).fontFamily;
  return own ? `${own}, ${FAMILY}` : FAMILY;
}

/** Lucide icons (ISC licence), drawn on a 24-unit grid. */
const CAMERA = "M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z";
const PHONE =
  "M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z";

function icon(pen: Pen, path: string, x: number, y: number, size: number, colour: string, circle = false) {
  const { ctx, px } = pen;
  ctx.save();
  ctx.translate(px(x), px(y));
  ctx.scale(px(size) / 24, px(size) / 24);
  ctx.strokeStyle = colour;
  ctx.lineWidth = 2;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.stroke(new Path2D(path));
  if (circle) {
    ctx.beginPath();
    ctx.arc(12, 13, 3, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();
}

/** "#2563eb" at a given opacity, for the card's tint. */
function tint(hex: string, alpha: number): string {
  let h = hex.replace("#", "");
  if (h.length === 3) h = h.replace(/./g, (c) => c + c);
  const n = Number.parseInt(h.slice(0, 6), 16);
  if (!Number.isFinite(n)) return `rgba(37,99,235,${alpha})`;
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${alpha})`;
}

/**
 * Word wrap at the current font, with the lines evened out: an address that
 * leaves one lone word on its last line reads as a mistake. `null` when a
 * single word is wider than the line or it takes more than `maxLines`, so the
 * caller tries a smaller size.
 */
function wrap(ctx: CanvasRenderingContext2D, text: string, width: number, maxLines: number): string[] | null {
  const words = text.split(" ").filter(Boolean);
  const greedy = (limit: number): string[] | null => {
    const lines: string[] = [];
    let current = "";
    for (const word of words) {
      if (ctx.measureText(word).width > limit) return null;
      const next = current ? `${current} ${word}` : word;
      if (ctx.measureText(next).width <= limit) current = next;
      else {
        lines.push(current);
        current = word;
      }
    }
    if (current) lines.push(current);
    return lines;
  };
  const lines = greedy(width);
  if (!lines || lines.length > maxLines) return null;
  if (lines.length < 2) return lines;
  // The narrowest measure that still takes no more lines.
  let low = 0;
  let high = width;
  while (high - low > 1) {
    const mid = (low + high) / 2;
    const tried = greedy(mid);
    if (tried && tried.length <= lines.length) high = mid;
    else low = mid;
  }
  return greedy(high) ?? lines;
}

type CardPlan = {
  badge: number;
  name: { size: number; lines: string[] } | null;
  phone: { size: number } | null;
  note: { size: number; lines: string[] } | null;
  height: number;
  /** The name's size, and the unit every gap is measured in. */
  unit: number;
};

/** The phone pill's height and side padding, per millimetre of its text size. */
const PILL_H = 2;
const PILL_PAD = 0.75;

/**
 * The card as a narrow strip beside the photos: everything on one line along
 * it, turned to read from the bottom up, the way a book's spine does.
 *
 * What goes is decided by what fits: the badge, the name, the number and the
 * address if the strip is long enough. The number is the last to give way.
 */
function drawStrip(pen: Pen, box: Box, imprint: Imprint, border: boolean, accent: string, font: string): void {
  const { ctx, px } = pen;
  const name = imprint.name.trim();
  const phone = imprint.phone.trim();
  const note = (imprint.note ?? "").trim();
  const length = box.h;
  const thick = box.w;

  const inset = Math.min(0.6, thick * 0.08);
  const panel = { x: -length / 2 + inset, y: -thick / 2 + inset, w: length - inset * 2, h: thick - inset * 2 };
  if (panel.w <= 6 || panel.h <= 2) return;
  const band = Math.min(1.2, panel.w * 0.04);
  const pad = Math.min(2.4, panel.h * 0.4);
  const room = panel.w - band - pad * 2;
  const pillH = panel.h * 0.64;
  const badgeD = panel.h * 0.66;

  type Part = "badge" | "name" | "phone" | "note";
  const widths = (parts: Part[], size: number) => {
    const phoneSize = Math.min(size * 0.92, pillH * 0.56);
    const noteSize = size * 0.72;
    const out: number[] = [];
    for (const part of parts) {
      if (part === "badge") out.push(badgeD);
      if (part === "name") {
        ctx.font = `700 ${px(size)}px ${font}`;
        out.push(ctx.measureText(name).width / px(1));
      }
      if (part === "phone") {
        ctx.font = `700 ${px(phoneSize)}px ${font}`;
        out.push(phoneSize * (PILL_PAD * 2 + 1.45) + ctx.measureText(phone).width / px(1));
      }
      if (part === "note") {
        ctx.font = `500 ${px(noteSize)}px ${font}`;
        out.push(ctx.measureText(note).width / px(1));
      }
    }
    return { out, phoneSize, noteSize, gap: size * 0.8 };
  };

  // In order of preference: the address goes first, then the badge, then the
  // name; the number is what the strip is for, so it stays to the last.
  const choices: Part[][] = [
    ["badge", "name", "phone", "note"],
    ["badge", "name", "phone"],
    ["name", "phone"],
    ["badge", "phone"],
    ["phone"],
    ["badge", "name"],
    ["name"],
  ].map((parts) =>
    (parts as Part[]).filter((part) => (part === "name" ? name : part === "phone" ? phone : part === "note" ? note : true)),
  );

  const ceiling = Math.min(4.2, panel.h * 0.44);
  let chosen: { parts: Part[]; size: number } | null = null;
  // A readable size with fewer parts beats a tiny one with all of them.
  for (const floor of [2.2, 1.5]) {
    for (const parts of choices) {
      if (!parts.includes("name") && !parts.includes("phone")) continue;
      for (let size = ceiling; size >= floor; size -= 0.1) {
        const { out, gap } = widths(parts, size);
        if (out.reduce((a, b) => a + b, 0) + gap * (out.length - 1) <= room) {
          chosen = { parts, size };
          break;
        }
      }
      if (chosen) break;
    }
    if (chosen) break;
  }
  if (!chosen) return;

  ctx.save();

  if (border) {
    const width = Math.max(1, px(0.15));
    ctx.strokeStyle = "rgba(0,0,0,0.22)";
    ctx.lineWidth = width;
    ctx.strokeRect(px(box.x) + width / 2, px(box.y) + width / 2, px(box.w) - width, px(box.h) - width);
  }

  ctx.translate(px(box.x + box.w / 2), px(box.y + box.h / 2));
  ctx.rotate(-Math.PI / 2);

  const outline = new Path2D();
  outline.roundRect(px(panel.x), px(panel.y), px(panel.w), px(panel.h), px(Math.min(1.6, panel.h * 0.3)));
  ctx.fillStyle = tint(accent, 0.07);
  ctx.fill(outline);
  ctx.save();
  ctx.clip(outline);
  ctx.fillStyle = accent;
  ctx.fillRect(px(panel.x), px(panel.y), px(band), px(panel.h));
  ctx.restore();
  ctx.strokeStyle = tint(accent, 0.45);
  ctx.lineWidth = Math.max(1, px(0.25));
  ctx.stroke(outline);

  const { out, phoneSize, noteSize, gap } = widths(chosen.parts, chosen.size);
  const total = out.reduce((a, b) => a + b, 0) + gap * (out.length - 1);
  let cursor = panel.x + band + pad + (room - total) / 2;
  ctx.textBaseline = "middle";
  ctx.textAlign = "left";

  chosen.parts.forEach((part, i) => {
    const w = out[i];
    if (part === "badge") {
      const r = badgeD / 2;
      ctx.beginPath();
      ctx.arc(px(cursor + r), 0, px(r), 0, Math.PI * 2);
      ctx.fillStyle = accent;
      ctx.fill();
      const glyph = badgeD * 0.56;
      icon(pen, CAMERA, cursor + r - glyph / 2, -glyph / 2, glyph, "#ffffff", true);
    }
    if (part === "name") {
      ctx.font = `700 ${px(chosen.size)}px ${font}`;
      ctx.fillStyle = "#0f172a";
      ctx.fillText(name, px(cursor), 0);
    }
    if (part === "phone") {
      const pill = new Path2D();
      pill.roundRect(px(cursor), px(-pillH / 2), px(w), px(pillH), px(pillH / 2));
      ctx.fillStyle = accent;
      ctx.fill(pill);
      const glyph = phoneSize * 1.05;
      const start = cursor + phoneSize * PILL_PAD;
      icon(pen, PHONE, start, -glyph / 2, glyph, "#ffffff");
      ctx.font = `700 ${px(phoneSize)}px ${font}`;
      ctx.fillStyle = "#ffffff";
      ctx.fillText(phone, px(start + glyph + phoneSize * 0.4), 0);
    }
    if (part === "note") {
      ctx.font = `500 ${px(noteSize)}px ${font}`;
      ctx.fillStyle = "#475569";
      ctx.fillText(note, px(cursor), 0);
    }
    cursor += w + gap;
  });

  ctx.restore();
}

/**
 * A card in `box`, in millimetres: the cells the order left empty beside the
 * photographs, one cell or a whole column of them.
 *
 * Laid out like a small business card — a tinted panel with a coloured band,
 * a camera badge when there is height for one, the name large, the number in a
 * pill of the studio's colour, and the address or slogan underneath. On a tall
 * column the name and the number move apart to fill it, so it reads as a poster
 * rather than a label stuck in the middle. Everything is sized off the box, so
 * the same card reads on a 40 × 30 cell and on a 40 × 126 column.
 *
 * `border` draws the cut line round the box, for sheets printed without cut
 * marks: there would otherwise be nothing on the paper to say where the
 * scissors go. With cut marks on it is left off, because two lines in the same
 * place is one line too many.
 */
export function drawCard(pen: Pen, box: Box, imprint: Imprint, border = true): void {
  const { ctx, px } = pen;
  const name = imprint.name.trim();
  const phone = imprint.phone.trim();
  const note = (imprint.note ?? "").trim();
  if (!name && !phone) return;
  const accent = imprint.colour || DEFAULT_COLOUR;
  const font = family();

  // A strip beside the photos rather than a cell among them.
  if (box.w < 16 && box.h > box.w * 2.5) {
    drawStrip(pen, box, imprint, border, accent, font);
    return;
  }

  // The panel sits inside the cut line, so a slightly crooked cut never
  // clips it.
  const inset = Math.min(1.6, box.w * 0.05, box.h * 0.05);
  const panel = { x: box.x + inset, y: box.y + inset, w: box.w - inset * 2, h: box.h - inset * 2 };
  if (panel.w <= 6 || panel.h <= 6) return;
  const radius = Math.min(2.4, panel.w * 0.08, panel.h * 0.08);
  const band = Math.min(1.6, panel.h * 0.06);
  const pad = Math.min(3, panel.w * 0.09, panel.h * 0.09);
  const inner = { x: panel.x + pad, y: panel.y + band + pad, w: panel.w - pad * 2, h: panel.h - band - pad * 2 };
  const tall = box.h > box.w * 1.15;

  const plan = (withNote: boolean, withBadge: boolean, withName = true): CardPlan | null => {
    const ceiling = Math.min(tall ? 6.5 : 5, inner.h * 0.3, inner.w * 0.2);
    for (let u = ceiling; u >= 1.5; u -= 0.1) {
      let height = 0;
      const badge = withBadge ? u * 2.8 : 0;
      if (badge) height += badge + u * 0.9;

      let nameLines: string[] | null = null;
      if (withName && name) {
        ctx.font = `700 ${px(u)}px ${font}`;
        nameLines = wrap(ctx, name, px(inner.w), tall ? 3 : 2);
        if (!nameLines) continue;
        height += nameLines.length * u * 1.18;
      }

      const phoneSize = Math.max(1.5, u * 0.78);
      if (phone) {
        ctx.font = `700 ${px(phoneSize)}px ${font}`;
        const width = phoneSize * (PILL_PAD * 2 + 1.45) + ctx.measureText(phone).width / px(1);
        if (width > inner.w) continue;
        if (nameLines) height += u * 0.9;
        height += phoneSize * PILL_H;
      }

      const noteSize = Math.max(1.5, u * 0.56);
      let noteLines: string[] | null = null;
      if (withNote && note) {
        ctx.font = `500 ${px(noteSize)}px ${font}`;
        noteLines = wrap(ctx, note, px(inner.w), tall ? 4 : 2);
        if (!noteLines) continue;
        height += u * 0.6 + noteLines.length * noteSize * 1.35;
      }

      if (height > inner.h) continue;
      return {
        badge,
        name: nameLines ? { size: u, lines: nameLines } : null,
        phone: phone ? { size: phoneSize } : null,
        note: noteLines ? { size: noteSize, lines: noteLines } : null,
        height,
        unit: u,
      };
    }
    return null;
  };

  // What gives way first when the box is small: the badge, then the note, and
  // last a name too long to fit at all, so the number still gets printed.
  const chosen = plan(true, tall) ?? plan(true, false) ?? plan(false, false) ?? (phone ? plan(false, false, false) : null);
  if (!chosen) return;

  ctx.save();

  if (border) {
    ctx.strokeStyle = "rgba(0,0,0,0.22)";
    const width = Math.max(1, px(0.15));
    ctx.lineWidth = width;
    // Inside the box, never over the photo next door.
    ctx.strokeRect(px(box.x) + width / 2, px(box.y) + width / 2, px(box.w) - width, px(box.h) - width);
  }

  // The panel: a light tint of the studio's colour, a band across the top.
  const outline = new Path2D();
  outline.roundRect(px(panel.x), px(panel.y), px(panel.w), px(panel.h), px(radius));
  ctx.fillStyle = tint(accent, 0.07);
  ctx.fill(outline);
  ctx.save();
  ctx.clip(outline);
  ctx.fillStyle = accent;
  ctx.fillRect(px(panel.x), px(panel.y), px(panel.w), px(band));
  ctx.restore();
  ctx.strokeStyle = tint(accent, 0.45);
  ctx.lineWidth = Math.max(1, px(0.25));
  ctx.stroke(outline);

  // Spare height: centred on a small card; on a tall one, split so the name
  // sits in the upper part and the number in the lower.
  const spare = inner.h - chosen.height;
  const split = tall && chosen.name !== null && chosen.phone !== null;
  const middle = inner.x + inner.w / 2;
  let cursor = inner.y + (split ? spare * 0.28 : spare / 2);
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  if (chosen.badge) {
    const r = chosen.badge / 2;
    ctx.beginPath();
    ctx.arc(px(middle), px(cursor + r), px(r), 0, Math.PI * 2);
    ctx.fillStyle = accent;
    ctx.fill();
    // A faint ring round the badge, like a lens.
    ctx.beginPath();
    ctx.arc(px(middle), px(cursor + r), px(r + chosen.unit * 0.3), 0, Math.PI * 2);
    ctx.strokeStyle = tint(accent, 0.25);
    ctx.lineWidth = Math.max(1, px(0.3));
    ctx.stroke();
    const glyph = chosen.badge * 0.5;
    icon(pen, CAMERA, middle - glyph / 2, cursor + r - glyph / 2, glyph, "#ffffff", true);
    cursor += chosen.badge + chosen.unit * 0.9;
  }

  if (chosen.name) {
    const { size, lines } = chosen.name;
    ctx.font = `700 ${px(size)}px ${font}`;
    ctx.fillStyle = "#0f172a";
    for (const text of lines) {
      ctx.fillText(text, px(middle), px(cursor + (size * 1.18) / 2));
      cursor += size * 1.18;
    }
  }

  if (chosen.phone) {
    if (chosen.name) cursor += chosen.unit * 0.9 + (split ? spare * 0.44 : 0);
    const size = chosen.phone.size;
    ctx.font = `700 ${px(size)}px ${font}`;
    const textW = ctx.measureText(phone).width / px(1);
    const glyph = size * 1.05;
    const gap = size * 0.4;
    const pillW = size * PILL_PAD * 2 + glyph + gap + textW;
    const pillH = size * PILL_H;
    const left = middle - pillW / 2;
    const pill = new Path2D();
    pill.roundRect(px(left), px(cursor), px(pillW), px(pillH), px(pillH / 2));
    ctx.fillStyle = accent;
    ctx.fill(pill);
    const line = cursor + pillH / 2;
    const start = left + size * PILL_PAD;
    icon(pen, PHONE, start, line - glyph / 2, glyph, "#ffffff");
    ctx.textAlign = "left";
    ctx.fillStyle = "#ffffff";
    ctx.fillText(phone, px(start + glyph + gap), px(line));
    ctx.textAlign = "center";
    cursor += pillH;
  }

  if (chosen.note) {
    const { size, lines } = chosen.note;
    cursor += chosen.unit * 0.6;
    ctx.font = `500 ${px(size)}px ${font}`;
    ctx.fillStyle = "#475569";
    for (const text of lines) {
      ctx.fillText(text, px(middle), px(cursor + (size * 1.35) / 2));
      cursor += size * 1.35;
    }
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
