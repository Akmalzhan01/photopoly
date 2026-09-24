/**
 * Turning a dieline into the two things a die shop is actually sent.
 *
 * A drawing on paper, for a person: scaled to fit the sheet, dimensioned, with
 * a title block saying what board and what dimensions. And a DXF, for their
 * CAD: one to one, in millimetres, cut and crease on separate layers.
 *
 * The two carry the same geometry but answer to different readers, and the
 * split matters. The drawing may be at 1:5; the DXF never is. Annotation sizes
 * are in sheet millimetres, not drawing millimetres, so the numbers stay
 * readable whether the blank is a matchbox or a shoe box.
 */

import type { Blank, Dimension, Piece, Point, Shape } from "./box";
import { mm } from "./box";

export type Paper = { id: string; label: string; width: number; height: number };

export const PAPERS: Paper[] = [
  { id: "a4", label: "A4", width: 210, height: 297 },
  { id: "a3", label: "A3", width: 297, height: 420 },
];

/**
 * Drawing scales, not arbitrary fractions.
 *
 * A drawing at 1:3,7 is a drawing nobody can check with a ruler. These are the
 * ones a workshop expects to see, so the scale in the title block means
 * something to the person reading it.
 */
const SCALES = [1, 2, 2.5, 4, 5, 10, 15, 20, 25, 50, 100];

const MARGIN = 10;
/** Deep enough for two rows of facts and up to four notes without crowding. */
const TITLE_HEIGHT = 38;
const GAP = 14;

/**
 * Room the dimension lines need outside the blank itself, in sheet
 * millimetres — annotation does not shrink with the scale.
 *
 * Above each piece: the panel chain, then the overall width above that. To the
 * sides: the overall height on the left and up to two tiers on the right.
 */
const TOP_ROOM = 32;
const SIDE_ROOM = 34;
/** Clear space between the drawing and the title block, where the job line goes. */
const FOOT_ROOM = 10;

export type Sheet = {
  paper: Paper;
  landscape: boolean;
  /** Divisor: 5 means 1:5. */
  scale: number;
  svg: string;
};

const round = (value: number) => Math.round(value * 1000) / 1000;

function onArc(centre: Point, radius: number, degrees: number): Point {
  const radians = (degrees * Math.PI) / 180;
  return { x: centre.x + radius * Math.cos(radians), y: centre.y + radius * Math.sin(radians) };
}

function shapeEnds(shape: Shape): [Point, Point] {
  if (shape.kind === "line") return [shape.a, shape.b];
  return [
    onArc(shape.centre, shape.radius, shape.from),
    onArc(shape.centre, shape.radius, shape.to),
  ];
}

/**
 * Piece space (millimetres, y up) to sheet space (millimetres, y down).
 *
 * The flip is done here, once. Everywhere else can think in the coordinates
 * that suit it: geometry in y-up because DXF is, drawing in y-down because SVG
 * is, and neither has to know about the other.
 */
type Project = (point: Point) => Point;

function projector(originX: number, originY: number, height: number, k: number): Project {
  return (point) => ({ x: originX + point.x * k, y: originY + (height - point.y) * k });
}

function pathFor(shape: Shape, project: Project, height: number, k: number): string {
  if (shape.kind === "line") {
    const a = project(shape.a);
    const b = project(shape.b);
    return `M${round(a.x)} ${round(a.y)}L${round(b.x)} ${round(b.y)}`;
  }
  const [from, to] = shapeEnds(shape);
  const a = project(from);
  const b = project(to);
  const sweep = (((shape.to - shape.from) % 360) + 360) % 360;
  const large = sweep > 180 ? 1 : 0;
  /**
   * Sweep 0, because the y-flip turns the arc around.
   *
   * The geometry runs counter-clockwise in a y-up world. Flipping y reverses
   * that, and SVG's sweep flag 1 means *increasing* angle — so the flipped arc
   * is the decreasing one, which is 0. Getting this backwards does not fail:
   * it draws the same curve bowed the other way, and a pillow box whose ends
   * curve inward instead of outward looks entirely plausible until it is cut.
   */
  void height;
  return `M${round(a.x)} ${round(a.y)}A${round(shape.radius * k)} ${round(shape.radius * k)} 0 ${large} 0 ${round(b.x)} ${round(b.y)}`;
}

function geometry(piece: Piece, project: Project, k: number): string {
  const cuts: string[] = [];
  const creases: string[] = [];
  for (const shape of piece.shapes) {
    const d = pathFor(shape, project, piece.height, k);
    (shape.layer === "cut" ? cuts : creases).push(d);
  }
  return `<path class="cut" d="${cuts.join("")}"/><path class="crease" d="${creases.join("")}"/>`;
}

const escape = (text: string) =>
  text.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

/**
 * One dimension: two witness lines, a measured line between them, arrows, and
 * the figure.
 *
 * Everything but the endpoints is sized in sheet millimetres, so a 1:20 drawing
 * gets the same 2,5 mm text as a 1:1 one rather than something microscopic.
 */
function dimension(dim: Dimension, project: Project): string {
  const a = project(dim.from);
  const b = project(dim.to);
  const horizontal = Math.abs(a.y - b.y) < Math.abs(a.x - b.x);
  // Sheet y grows downward, so a positive offset — "above" on the drawing —
  // has to subtract.
  const shift = horizontal ? { x: 0, y: -dim.offset } : { x: dim.offset, y: 0 };

  const a2 = { x: a.x + shift.x, y: a.y + shift.y };
  const b2 = { x: b.x + shift.x, y: b.y + shift.y };
  const overshoot = 1.8;
  const unit = horizontal ? { x: 0, y: Math.sign(shift.y) } : { x: Math.sign(shift.x), y: 0 };

  const witness = (from: Point, to: Point) =>
    `M${round(from.x + unit.x * 1.2)} ${round(from.y + unit.y * 1.2)}L${round(to.x + unit.x * overshoot)} ${round(to.y + unit.y * overshoot)}`;

  const along = horizontal ? { x: Math.sign(b.x - a.x), y: 0 } : { x: 0, y: Math.sign(b.y - a.y) };
  const arrow = (tip: Point, direction: 1 | -1) => {
    const dx = along.x * direction * 2.4;
    const dy = along.y * direction * 2.4;
    const wx = along.y * 0.7;
    const wy = along.x * 0.7;
    return `${round(tip.x)},${round(tip.y)} ${round(tip.x + dx + wx)},${round(tip.y + dy + wy)} ${round(tip.x + dx - wx)},${round(tip.y + dy - wy)}`;
  };

  const midX = (a2.x + b2.x) / 2;
  const midY = (a2.y + b2.y) / 2;
  const text = horizontal
    ? `<text x="${round(midX)}" y="${round(midY - 1.4)}" text-anchor="middle">${escape(dim.label)}</text>`
    : `<text x="${round(midX)}" y="${round(midY)}" text-anchor="middle" transform="rotate(-90 ${round(midX)} ${round(midY)})" dy="-1.4">${escape(dim.label)}</text>`;

  return (
    `<path class="thin" d="${witness(a, a2)}${witness(b, b2)}"/>` +
    `<path class="thin" d="M${round(a2.x)} ${round(a2.y)}L${round(b2.x)} ${round(b2.y)}"/>` +
    `<polygon class="tick" points="${arrow(a2, 1)}"/><polygon class="tick" points="${arrow(b2, -1)}"/>` +
    text
  );
}

/** The largest standard scale the pieces fit at, or the smallest if none do. */
function chooseScale(need: number): number {
  for (const scale of SCALES) if (1 / scale <= need) return scale;
  return SCALES[SCALES.length - 1];
}

function stacked(blank: Blank): { width: number; height: number } {
  const width = Math.max(...blank.pieces.map((p) => p.width));
  const height =
    blank.pieces.reduce((sum, p) => sum + p.height, 0) + GAP * (blank.pieces.length - 1);
  return { width, height };
}

function titleBlock(blank: Blank, sheet: Paper, landscape: boolean, scale: number, job: string, today: string): string {
  const w = landscape ? sheet.height : sheet.width;
  const h = landscape ? sheet.width : sheet.height;
  const top = h - MARGIN - TITLE_HEIGHT;
  const left = MARGIN;
  const right = w - MARGIN;

  // The facts keep to the left three quarters; scale and date own the right.
  // Sharing one grid let a long box name run under the scale, which on a
  // drawing reads as a different number than the one meant.
  const column = ((right - left) * 0.74) / 3;
  const rows = blank.facts.map((fact, i) => {
    const x = left + 3 + (i % 3) * column;
    const y = top + 6 + Math.floor(i / 3) * 11;
    return (
      `<text class="key" x="${round(x)}" y="${round(y)}">${escape(fact.label.toUpperCase())}</text>` +
      `<text class="value" x="${round(x)}" y="${round(y + 4.6)}">${escape(fact.value)}</text>`
    );
  });

  const notes = blank.notes
    .slice(0, 4)
    .map((note, i) => `<text class="note" x="${round(left + 3)}" y="${round(top + 26 + i * 3.1)}">${escape(note)}</text>`)
    .join("");

  // The legend lives in the title block, not loose above it. Out there it
  // landed on the job line and the two printed on top of each other.
  const legendY = top + TITLE_HEIGHT - 4;
  const legend =
    `<path class="cut" d="M${round(right - 46)} ${round(legendY)}L${round(right - 40)} ${round(legendY)}"/>` +
    `<text class="legend" x="${round(right - 38)}" y="${round(legendY + 0.9)}">рез</text>` +
    `<path class="crease" d="M${round(right - 26)} ${round(legendY)}L${round(right - 20)} ${round(legendY)}"/>` +
    `<text class="legend" x="${round(right - 18)}" y="${round(legendY + 0.9)}">биговка</text>`;

  return (
    `<rect class="frame" x="${round(left)}" y="${round(top)}" width="${round(right - left)}" height="${TITLE_HEIGHT}"/>` +
    rows.join("") +
    notes +
    legend +
    `<text class="key" x="${round(right - 3)}" y="${round(top + 6)}" text-anchor="end">МАСШТАБ</text>` +
    `<text class="value" x="${round(right - 3)}" y="${round(top + 10.6)}" text-anchor="end">1:${mm(scale)}</text>` +
    `<text class="key" x="${round(right - 3)}" y="${round(top + 17)}" text-anchor="end">ДАТА</text>` +
    `<text class="value" x="${round(right - 3)}" y="${round(top + 21.6)}" text-anchor="end">${escape(today)}</text>` +
    (job
      ? `<text class="job" x="${round(left + 3)}" y="${round(top - 3)}">${escape(job)}</text>`
      : "")
  );
}

const STYLE = `
.cut { fill: none; stroke: #000; stroke-width: 0.5; }
.crease { fill: none; stroke: #000; stroke-width: 0.3; stroke-dasharray: 3 1.6; }
.thin { fill: none; stroke: #000; stroke-width: 0.18; }
.tick { fill: #000; }
.frame { fill: none; stroke: #000; stroke-width: 0.35; }
text { font-family: "Helvetica Neue", Arial, sans-serif; fill: #000; }
text { font-size: 2.5px; }
.key { font-size: 2.1px; letter-spacing: 0.35px; fill: #555; }
.value { font-size: 3.1px; }
.note { font-size: 2.3px; fill: #444; }
.job { font-size: 3.6px; }
.label { font-size: 3.2px; }
.legend { font-size: 2.4px; fill: #333; }
`;

/**
 * The printable drawing.
 *
 * Paper and orientation are chosen rather than asked for: there is one right
 * answer — the one that gets the largest standard scale — and making a shop
 * guess at it is how a blank ends up drawn at 1:50 on a portrait A4 for no
 * reason.
 */
export function renderSheet(
  blank: Blank,
  { job = "", today = "" }: { job?: string; today?: string } = {},
): Sheet {
  const extent = stacked(blank);
  const count = blank.pieces.length;
  // The blanks scale; the annotation around them does not. So the room it takes
  // comes off the paper first, and only what is left is divided by the drawing.
  const fixedH = TOP_ROOM * count + GAP * (count - 1);
  const drawnH = blank.pieces.reduce((sum, piece) => sum + piece.height, 0);

  let best: { paper: Paper; landscape: boolean; scale: number } | null = null;
  for (const paper of PAPERS) {
    for (const landscape of [false, true]) {
      const w = landscape ? paper.height : paper.width;
      const h = landscape ? paper.width : paper.height;
      const availW = w - 2 * MARGIN - 2 * SIDE_ROOM;
      const availH = h - 2 * MARGIN - TITLE_HEIGHT - FOOT_ROOM - fixedH;
      const scale = chooseScale(Math.min(availW / extent.width, availH / drawnH));
      if (!best || scale < best.scale) best = { paper, landscape, scale };
    }
  }
  const { paper, landscape, scale } = best!;
  const k = 1 / scale;

  const w = landscape ? paper.height : paper.width;
  const h = landscape ? paper.width : paper.height;

  // Centre what will actually be inked — blanks plus the room above each — in
  // the space left over the title block, rather than centring the blanks and
  // letting the dimension lines push everything up.
  const inkH = drawnH * k + fixedH;
  const body: string[] = [];
  let band = MARGIN + (h - 2 * MARGIN - TITLE_HEIGHT - FOOT_ROOM - inkH) / 2;

  for (const piece of blank.pieces) {
    const top = band + TOP_ROOM;
    const originX = (w - piece.width * k) / 2;
    const project = projector(originX, top, piece.height, k);
    if (count > 1) {
      body.push(
        `<text class="label" x="${round(originX)}" y="${round(top - 3)}">${escape(piece.label)}</text>`,
      );
    }
    body.push(geometry(piece, project, k));
    body.push(piece.dimensions.map((d) => dimension(d, project)).join(""));
    band += TOP_ROOM + piece.height * k + GAP;
  }

  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w}mm" height="${h}mm" viewBox="0 0 ${w} ${h}">` +
    `<style>${STYLE}</style>` +
    `<rect x="0" y="0" width="${w}" height="${h}" fill="#fff"/>` +
    // Named groups so the two halves of the sheet can be measured apart. The
    // drawing crept over the title block once, and from the outside that looks
    // identical to a drawing that fits.
    `<g id="drawing">${body.join("")}</g>` +
    `<g id="title">${titleBlock(blank, paper, landscape, scale, job, today)}</g>` +
    `</svg>`;

  return { paper, landscape, scale, svg };
}

/**
 * The on-screen preview.
 *
 * No dimensions and no title block: on a phone-sized panel they turn the shape
 * into a thicket, and the figures are already beside it in the interface. This
 * answers one question — does that look like the box I meant — and the printed
 * drawing answers the rest.
 */
export function renderPreview(piece: Piece): string {
  const pad = 6;
  const k = 1;
  const project = projector(pad, pad, piece.height, k);
  const w = piece.width + pad * 2;
  const h = piece.height + pad * 2;
  const stroke = Math.max(piece.width, piece.height) / 260;

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${round(w)} ${round(h)}" ` +
    `preserveAspectRatio="xMidYMid meet" role="img" aria-label="Развёртка: ${escape(piece.label)}">` +
    `<g fill="none" stroke-linecap="round" stroke-linejoin="round">` +
    `<path d="${piece.shapes
      .filter((s) => s.layer === "cut")
      .map((s) => pathFor(s, project, piece.height, k))
      .join("")}" stroke="currentColor" stroke-width="${round(stroke * 1.6)}"/>` +
    `<path d="${piece.shapes
      .filter((s) => s.layer === "crease")
      .map((s) => pathFor(s, project, piece.height, k))
      .join("")}" stroke="var(--color-safe)" stroke-width="${round(stroke)}" ` +
    `stroke-dasharray="${round(stroke * 4)} ${round(stroke * 3)}"/>` +
    `</g></svg>`
  );
}

// ── DXF ─────────────────────────────────────────────────────────────────────

/** One DXF group: a code and its value, each on its own line. */
const pair = (code: number, value: string | number) => `${code}\n${value}\n`;

/**
 * An R12 DXF at one to one.
 *
 * R12 on purpose: it is the version every cutting table, plotter driver and
 * twenty-year-old CAD seat in a print shop can still open, and a dieline needs
 * nothing newer than lines and arcs.
 *
 * Cut and crease go on named layers in the conventional colours — red for cut,
 * blue for crease — because that pair is what a die shop looks for, and a file
 * that puts everything on layer 0 makes them redo the separation by hand.
 */
export function renderDxf(blank: Blank): string {
  let entities = "";
  let maxX = 0;
  let maxY = 0;
  let offsetY = 0;

  for (const piece of [...blank.pieces].reverse()) {
    for (const shape of piece.shapes) {
      const layer = shape.layer === "cut" ? "CUT" : "CREASE";
      if (shape.kind === "line") {
        entities +=
          pair(0, "LINE") +
          pair(8, layer) +
          pair(10, round(shape.a.x)) +
          pair(20, round(shape.a.y + offsetY)) +
          pair(11, round(shape.b.x)) +
          pair(21, round(shape.b.y + offsetY));
      } else {
        // DXF arcs also run counter-clockwise from start to end, and DXF is
        // also y-up — so the geometry goes across untouched.
        entities +=
          pair(0, "ARC") +
          pair(8, layer) +
          pair(10, round(shape.centre.x)) +
          pair(20, round(shape.centre.y + offsetY)) +
          pair(40, round(shape.radius)) +
          pair(50, round(((shape.from % 360) + 360) % 360)) +
          pair(51, round(((shape.to % 360) + 360) % 360));
      }
    }
    maxX = Math.max(maxX, piece.width);
    maxY = Math.max(maxY, piece.height + offsetY);
    offsetY += piece.height + 20;
  }

  const layer = (name: string, colour: number) =>
    pair(0, "LAYER") + pair(2, name) + pair(70, 0) + pair(62, colour) + pair(6, "CONTINUOUS");

  return (
    pair(0, "SECTION") +
    pair(2, "HEADER") +
    // Millimetres, stated rather than left to the reader to assume.
    pair(9, "$INSUNITS") +
    pair(70, 4) +
    pair(9, "$EXTMIN") +
    pair(10, 0) +
    pair(20, 0) +
    pair(9, "$EXTMAX") +
    pair(10, round(maxX)) +
    pair(20, round(maxY)) +
    pair(0, "ENDSEC") +
    pair(0, "SECTION") +
    pair(2, "TABLES") +
    pair(0, "TABLE") +
    pair(2, "LTYPE") +
    pair(70, 1) +
    pair(0, "LTYPE") +
    pair(2, "CONTINUOUS") +
    pair(70, 0) +
    pair(3, "Solid line") +
    pair(72, 65) +
    pair(73, 0) +
    pair(40, 0) +
    pair(0, "ENDTAB") +
    pair(0, "TABLE") +
    pair(2, "LAYER") +
    pair(70, 2) +
    layer("CUT", 1) +
    layer("CREASE", 5) +
    pair(0, "ENDTAB") +
    pair(0, "ENDSEC") +
    pair(0, "SECTION") +
    pair(2, "ENTITIES") +
    entities +
    pair(0, "ENDSEC") +
    pair(0, "EOF")
  );
}

/** A file name a shop can find again in a folder of forty of them. */
export function fileName(blank: Blank, extension: string): string {
  const size = blank.facts.find((f) => f.label === "Внутри")?.value ?? "";
  const digits = size.replace(/[^\d×]/g, "").replace(/×/g, "x");
  return `korobka-${digits || "chertyozh"}.${extension}`;
}
