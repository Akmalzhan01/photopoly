/**
 * Box dielines: the flat shape a box is cut from, worked out from the box.
 *
 * This is pure geometry — no model, no server, no network. That is the whole
 * appeal: it works offline from the first visit, unlike everything else the
 * studio does.
 *
 * The output is meant to be handed to a die shop, not to a plotter in the back
 * room. That changes what matters. A cut file has to be right to a tenth of a
 * millimetre because a machine follows it blindly; a drawing has to be
 * *unambiguous*, because a person reads it and will adjust the allowances to
 * their own board anyway. So every derived figure is put on the drawing where
 * the die maker can see it and argue with it, rather than hidden in here.
 *
 * ## Coordinates
 *
 * Millimetres, y up, origin at the bottom-left of each piece's bounding box.
 * y-up because DXF is y-up and the die shop's file is the one that has to be
 * exactly right; the SVG rendering flips it once, in one place.
 *
 * ## Thickness
 *
 * Board is not paper: it has to bend around a corner, and the fold happens
 * about the middle of the board rather than its inside face. So a wall that
 * must leave `L` of clear space inside is `L + T` long between its creases —
 * half a thickness at each end. Skip this and every box comes out tight, which
 * is the single most common fault in a home-made dieline.
 */

export type BoxKind = "rsc" | "tray" | "pillow" | "tuck";

export type Layer =
  /** Cut through. Drawn solid. */
  | "cut"
  /** Creased, not cut — the board still holds. Drawn dashed. */
  | "crease";

export type Point = { x: number; y: number };

export type Shape =
  | { kind: "line"; layer: Layer; a: Point; b: Point }
  /** Angles in degrees, counter-clockwise from +x, drawn from `from` to `to`. */
  | { kind: "arc"; layer: Layer; centre: Point; radius: number; from: number; to: number };

export type Dimension = {
  from: Point;
  to: Point;
  /**
   * How far the dimension line sits from the thing it measures. The sign picks
   * the side: for a horizontal span, positive is above.
   */
  offset: number;
  label: string;
};

export type Piece = {
  /** Named because a two-piece box arrives as two drawings and they get mixed up. */
  label: string;
  width: number;
  height: number;
  shapes: Shape[];
  dimensions: Dimension[];
};

export type Blank = {
  pieces: Piece[];
  /** The title block: what the die maker has to know and we must not leave out. */
  facts: { label: string; value: string }[];
  /** Said out loud on the drawing, because a silent assumption ruins a batch. */
  notes: string[];
};

export type BoxSpec = {
  kind: BoxKind;
  /** Millimetres. Read as inside or outside according to `measure`. */
  length: number;
  width: number;
  height: number;
  /** Board thickness, millimetres. */
  thickness: number;
  /**
   * Which face the three numbers describe.
   *
   * This is the first question a die maker asks and the most expensive one to
   * get wrong: a box ordered at 200 outside when 200 inside was meant is a
   * scrapped die, not a tweak. So it is a visible switch, never a default
   * assumed in silence.
   */
  measure: "inner" | "outer";
  /** Two-piece box only: how far the lid comes down. */
  lidDrop: number;
};

export const KINDS: { value: BoxKind; label: string; note: string }[] = [
  { value: "rsc", label: "Обычная", note: "Четыре клапана, склейка сбоку. FEFCO 0201" },
  { value: "tray", label: "С крышкой", note: "Две детали: дно и крышка" },
  { value: "pillow", label: "Подушка", note: "Без склейки торцов, края в дугу" },
  { value: "tuck", label: "С замком", note: "Язычок заправляется внутрь. Без скотча" },
];

export const KIND_LABEL: Record<BoxKind, string> = {
  rsc: "Обычная коробка (FEFCO 0201)",
  tray: "Коробка с крышкой (дно + крышка)",
  pillow: "Коробка-подушка",
  tuck: "Коробка с замком (так-ин)",
};

/** Boards a shop in Bishkek actually buys, with the thickness that goes with them. */
export const BOARDS: { label: string; thickness: number; note: string }[] = [
  { label: "Картон 250 г", thickness: 0.3, note: "Тонкий, для мелочей" },
  { label: "Картон 300 г", thickness: 0.4, note: "Самый ходовой" },
  { label: "Переплётный 1 мм", thickness: 1, note: "Жёсткий, подарочный" },
  { label: "Микрогофра", thickness: 1.5, note: "Лёгкие коробки" },
  { label: "Гофра E", thickness: 1.6, note: "Мелкая волна" },
  { label: "Гофра B", thickness: 3, note: "Транспортная" },
  { label: "Гофра C", thickness: 4, note: "Крупная волна" },
];

export const LIMITS = {
  side: { min: 10, max: 1200 },
  thickness: { min: 0.1, max: 8 },
  lidDrop: { min: 5, max: 400 },
} as const;

/**
 * A box to start from: a shoe-box-ish carton in the commonest board.
 *
 * Deliberately not 100 × 100 × 100. A shape with three different sides makes it
 * obvious which number moved which edge of the drawing, and a cube does not.
 */
export function initialSpec(): BoxSpec {
  return {
    kind: "rsc",
    length: 200,
    width: 150,
    height: 80,
    thickness: 1.5,
    measure: "inner",
    lidDrop: 30,
  };
}

export function sanitiseSpec(raw: unknown): BoxSpec {
  const base = initialSpec();
  if (!raw || typeof raw !== "object") return base;
  const v = raw as Record<string, unknown>;
  const size = (value: unknown, fallback: number, low: number, high: number) =>
    typeof value === "number" && Number.isFinite(value) ? clamp(value, low, high) : fallback;

  return {
    kind: KINDS.some((k) => k.value === v.kind) ? (v.kind as BoxKind) : base.kind,
    length: size(v.length, base.length, LIMITS.side.min, LIMITS.side.max),
    width: size(v.width, base.width, LIMITS.side.min, LIMITS.side.max),
    height: size(v.height, base.height, LIMITS.side.min, LIMITS.side.max),
    thickness: size(v.thickness, base.thickness, LIMITS.thickness.min, LIMITS.thickness.max),
    measure: v.measure === "outer" ? "outer" : "inner",
    lidDrop: size(v.lidDrop, base.lidDrop, LIMITS.lidDrop.min, LIMITS.lidDrop.max),
  };
}

/**
 * What the three numbers mean, which is not the same for every shape.
 *
 * A pillow box has no height — the third figure is how thick it is when full —
 * and calling it "height" is how someone ends up ordering a 30 mm tall envelope
 * when they wanted a 30 mm deep one.
 */
export const SIDE_LABELS: Record<BoxKind, [string, string, string]> = {
  rsc: ["Длина", "Ширина", "Высота"],
  tray: ["Длина", "Ширина", "Высота"],
  pillow: ["Длина", "Ширина", "Толщина"],
  tuck: ["Длина", "Ширина", "Высота"],
};

// ── small builders ──────────────────────────────────────────────────────────

const line = (layer: Layer, x1: number, y1: number, x2: number, y2: number): Shape => ({
  kind: "line",
  layer,
  a: { x: x1, y: y1 },
  b: { x: x2, y: y2 },
});

const cut = (x1: number, y1: number, x2: number, y2: number) => line("cut", x1, y1, x2, y2);
const crease = (x1: number, y1: number, x2: number, y2: number) => line("crease", x1, y1, x2, y2);

const clamp = (value: number, low: number, high: number) =>
  Math.min(high, Math.max(low, value));

/** Millimetres, printed the way a drawing prints them: no trailing noise. */
export function mm(value: number): string {
  const rounded = Math.round(value * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1).replace(".", ",");
}

/**
 * The arc through a chord of `span` with a rise of `sag` at its middle,
 * bulging away from the straight edge.
 *
 * `up` is which way it bulges; the top and bottom of a pillow box are the same
 * curve mirrored.
 */
function bow(x1: number, x2: number, base: number, sag: number, up: boolean): Shape {
  const span = x2 - x1;
  // Circle through the two ends and the peak: r = (c²/4 + s²) / 2s.
  const radius = (span * span) / (8 * sag) + sag / 2;
  const mid = (x1 + x2) / 2;
  const peak = up ? base + sag : base - sag;
  const centre = { x: mid, y: up ? peak - radius : peak + radius };
  const angle = (p: Point) =>
    (Math.atan2(p.y - centre.y, p.x - centre.x) * 180) / Math.PI;
  const left = angle({ x: x1, y: base });
  const right = angle({ x: x2, y: base });
  // Arcs run counter-clockwise from `from` to `to`, so the ends swap depending
  // on which way the curve bulges.
  return {
    kind: "arc",
    layer: "cut",
    centre,
    radius,
    from: up ? right : left,
    to: up ? left : right,
  };
}

// ── resolving the numbers a shape is actually built from ────────────────────

type Inner = { l: number; w: number; h: number; t: number };

/**
 * Inside dimensions, whatever the person typed.
 *
 * Everything downstream is built from the inside out, because that is what the
 * contents care about. Converting here rather than in four places is also the
 * only way the conversion can be got wrong exactly once.
 */
function inside(spec: BoxSpec): Inner {
  const t = spec.thickness;
  const shrink = spec.measure === "outer" ? 2 * t : 0;
  return {
    l: Math.max(1, spec.length - shrink),
    w: Math.max(1, spec.width - shrink),
    h: Math.max(1, spec.height - (spec.measure === "outer" ? (spec.kind === "tray" ? t : 2 * t) : 0)),
    t,
  };
}

// ── FEFCO 0201 ──────────────────────────────────────────────────────────────

/**
 * The regular slotted container: the brown box everything ships in.
 *
 * Four walls in a row with a glue flap at one end, and four flaps top and
 * bottom that each reach halfway across, so opposite pairs meet in the middle.
 * The slots between the flaps are cut one board thickness wide — that gap is
 * what lets a flap fold without tearing its neighbour.
 */
function rsc({ l, w, h, t }: Inner): Piece {
  const lp = l + t;
  const wp = w + t;
  const wall = h + t;
  const flap = wp / 2;
  const tab = clamp(Math.round(wp * 0.35), 15, 40);
  const chamfer = Math.min(3, wall / 5);

  const x0 = 0;
  const x1 = tab;
  const x2 = x1 + lp;
  const x3 = x2 + wp;
  const x4 = x3 + lp;
  const x5 = x4 + wp;

  const y0 = 0;
  const y1 = flap;
  const y2 = flap + wall;
  const y3 = y2 + flap;

  const shapes: Shape[] = [];

  // Glue flap: tapered so it slides under the far wall instead of catching on it.
  shapes.push(
    cut(x1, y1, x0, y1 + chamfer),
    cut(x0, y1 + chamfer, x0, y2 - chamfer),
    cut(x0, y2 - chamfer, x1, y2),
  );

  // Slots. Each internal crease gets a `t`-wide notch through the flap zones,
  // closed at the inner end so the outline stays a single closed contour.
  for (const x of [x2, x3, x4]) {
    const a = x - t / 2;
    const b = x + t / 2;
    shapes.push(
      cut(a, y2, a, y3),
      cut(b, y2, b, y3),
      cut(a, y2, b, y2),
      cut(a, y0, a, y1),
      cut(b, y0, b, y1),
      cut(a, y1, b, y1),
    );
  }

  // The two outer edges of the flap run: no slot, the flap simply ends.
  shapes.push(cut(x1, y2, x1, y3), cut(x1, y0, x1, y1));
  shapes.push(cut(x5, y0, x5, y3));

  // Flap edges, top and bottom, broken by the slots.
  const runs: [number, number][] = [
    [x1, x2 - t / 2],
    [x2 + t / 2, x3 - t / 2],
    [x3 + t / 2, x4 - t / 2],
    [x4 + t / 2, x5],
  ];
  for (const [a, b] of runs) {
    shapes.push(cut(a, y3, b, y3), cut(a, y0, b, y0));
  }

  // Creases: the two fold lines the flaps turn on, and the four corners.
  shapes.push(crease(x1, y1, x5, y1), crease(x1, y2, x5, y2));
  for (const x of [x1, x2, x3, x4]) shapes.push(crease(x, y1, x, y2));

  return {
    label: "Развёртка",
    width: x5,
    height: y3,
    shapes,
    dimensions: [
      { from: { x: x0, y: y3 }, to: { x: x5, y: y3 }, offset: 26, label: `${mm(x5)} общая` },
      { from: { x: x0, y: y0 }, to: { x: x0, y: y3 }, offset: -24, label: `${mm(y3)} общая` },
      { from: { x: x0, y: y3 }, to: { x: x1, y: y3 }, offset: 11, label: mm(tab) },
      { from: { x: x1, y: y3 }, to: { x: x2, y: y3 }, offset: 11, label: mm(lp) },
      { from: { x: x2, y: y3 }, to: { x: x3, y: y3 }, offset: 11, label: mm(wp) },
      { from: { x: x3, y: y3 }, to: { x: x4, y: y3 }, offset: 11, label: mm(lp) },
      { from: { x: x4, y: y3 }, to: { x: x5, y: y3 }, offset: 11, label: mm(wp) },
      { from: { x: x5, y: y0 }, to: { x: x5, y: y1 }, offset: 12, label: mm(flap) },
      { from: { x: x5, y: y1 }, to: { x: x5, y: y2 }, offset: 12, label: mm(wall) },
      { from: { x: x5, y: y2 }, to: { x: x5, y: y3 }, offset: 12, label: mm(flap) },
    ],
  };
}

// ── tray, used for both halves of the two-piece box ─────────────────────────

/**
 * A four-corner tray: a floor, four walls, and a tab at each corner that folds
 * round and glues to the inside of the next wall.
 *
 * The cut running up the corner from the notch is a slit, not an outline — the
 * tab and the wall beside it are adjacent board that has to come apart. Dies
 * have slits; the drawing shows one.
 */
function tray(l: number, w: number, h: number, t: number, label: string): Piece {
  const floorW = l + t;
  const floorH = w + t;
  // One fold from the floor, so half a thickness rather than a whole one.
  const wall = h + t / 2;
  /**
   * How far the corner tab reaches along the wall it glues to.
   *
   * Its height is the wall's — that comes from the blank — but its reach is a
   * choice, and it is a glue tab, not a second wall. Making it the full wall
   * height fills the corner notch in, which both wastes board and leaves a
   * blank that reads as a plain rectangle with four slits in it. It must still
   * stay inside the notch, so it can never be longer than the wall.
   */
  const tabLen = Math.min(wall - 1.5, clamp(wall * 0.7, 6, 28));

  const x0 = 0;
  const x1 = wall;
  const x2 = x1 + floorW;
  const x3 = x2 + wall;
  const y0 = 0;
  const y1 = wall;
  const y2 = y1 + floorH;
  const y3 = y2 + wall;

  const shapes: Shape[] = [];

  // Bottom and top walls: three cut edges each.
  shapes.push(cut(x1, y0, x2, y0), cut(x1, y0, x1, y1), cut(x2, y0, x2, y1));
  shapes.push(cut(x1, y3, x2, y3), cut(x1, y2, x1, y3), cut(x2, y2, x2, y3));

  // Left and right walls with a tab at each end.
  for (const [outer, innerX] of [
    [x0, x1],
    [x3, x2],
  ] as const) {
    shapes.push(cut(outer, y1 - tabLen, outer, y2 + tabLen));
    shapes.push(cut(outer, y1 - tabLen, innerX, y1 - tabLen));
    shapes.push(cut(outer, y2 + tabLen, innerX, y2 + tabLen));
  }

  shapes.push(crease(x0, y1, x3, y1), crease(x0, y2, x3, y2));
  shapes.push(crease(x1, y1, x1, y2), crease(x2, y1, x2, y2));

  return {
    label,
    width: x3,
    height: y3,
    shapes,
    dimensions: [
      { from: { x: x0, y: y3 }, to: { x: x3, y: y3 }, offset: 26, label: `${mm(x3)} общая` },
      { from: { x: x0, y: y0 }, to: { x: x0, y: y3 }, offset: -24, label: `${mm(y3)} общая` },
      { from: { x: x0, y: y3 }, to: { x: x1, y: y3 }, offset: 11, label: mm(wall) },
      { from: { x: x1, y: y3 }, to: { x: x2, y: y3 }, offset: 11, label: mm(floorW) },
      { from: { x: x2, y: y3 }, to: { x: x3, y: y3 }, offset: 11, label: mm(wall) },
      { from: { x: x3, y: y1 }, to: { x: x3, y: y2 }, offset: 12, label: mm(floorH) },
      { from: { x: x0, y: y1 - tabLen }, to: { x: x0, y: y1 }, offset: -11, label: mm(tabLen) },
    ],
  };
}

// ── pillow box ──────────────────────────────────────────────────────────────

/**
 * A flattened tube whose ends are arcs that fold in on each other.
 *
 * The rise of the arc is a proportion, not a derived quantity: how far the
 * curve has to travel depends on how firmly the shop wants the end to hold, and
 * every template house picks its own. A quarter of the panel is the common one,
 * and it is never allowed below half the side panel or the ends cannot meet.
 * The figure is dimensioned on the drawing so it can be changed.
 */
function pillow({ l, w, h, t }: Inner): Piece {
  const face = w + t;
  const side = h + t;
  const body = l + t;
  const sag = clamp(Math.max(face / 4, side / 2 + 2), 3, body / 3);
  const tab = clamp(Math.round(side * 0.9), 10, 25);
  const chamfer = Math.min(3, body / 6);

  const x0 = 0;
  const x1 = tab;
  const x2 = x1 + face;
  const x3 = x2 + side;
  const x4 = x3 + face;
  const x5 = x4 + side;

  const yLow = sag;
  const yHigh = sag + body;

  const shapes: Shape[] = [];

  shapes.push(
    cut(x1, yLow, x0, yLow + chamfer),
    cut(x0, yLow + chamfer, x0, yHigh - chamfer),
    cut(x0, yHigh - chamfer, x1, yHigh),
  );

  // The wide panels bow out past the ends of the narrow ones; that overhang is
  // what folds in and locks.
  shapes.push(bow(x1, x2, yLow, sag, false), bow(x3, x4, yLow, sag, false));
  shapes.push(bow(x1, x2, yHigh, sag, true), bow(x3, x4, yHigh, sag, true));
  shapes.push(cut(x2, yLow, x3, yLow), cut(x4, yLow, x5, yLow));
  shapes.push(cut(x2, yHigh, x3, yHigh), cut(x4, yHigh, x5, yHigh));
  shapes.push(cut(x5, yLow, x5, yHigh));

  for (const x of [x1, x2, x3, x4]) shapes.push(crease(x, yLow, x, yHigh));

  return {
    label: "Развёртка",
    width: x5,
    height: yHigh + sag,
    shapes,
    dimensions: [
      {
        from: { x: x0, y: yHigh + sag },
        to: { x: x5, y: yHigh + sag },
        offset: 26,
        label: `${mm(x5)} общая`,
      },
      {
        from: { x: x0, y: 0 },
        to: { x: x0, y: yHigh + sag },
        offset: -24,
        label: `${mm(yHigh + sag)} общая`,
      },
      // Anchored on the very top of the blank — the peak of the arcs — not on
      // the straight edge, or the chain runs straight through the curves.
      { from: { x: x0, y: yHigh + sag }, to: { x: x1, y: yHigh + sag }, offset: 11, label: mm(tab) },
      { from: { x: x1, y: yHigh + sag }, to: { x: x2, y: yHigh + sag }, offset: 11, label: mm(face) },
      { from: { x: x2, y: yHigh + sag }, to: { x: x3, y: yHigh + sag }, offset: 11, label: mm(side) },
      { from: { x: x3, y: yHigh + sag }, to: { x: x4, y: yHigh + sag }, offset: 11, label: mm(face) },
      { from: { x: x4, y: yHigh + sag }, to: { x: x5, y: yHigh + sag }, offset: 11, label: mm(side) },
      { from: { x: x5, y: yLow }, to: { x: x5, y: yHigh }, offset: 12, label: mm(body) },
      { from: { x: x5, y: 0 }, to: { x: x5, y: yLow }, offset: 12, label: `${mm(sag)} дуга` },
    ],
  };
}

// ── tuck-end carton ─────────────────────────────────────────────────────────

/**
 * The toothpaste-box carton: a glued tube, closed by a panel whose tongue tucks
 * down inside the front wall.
 *
 * Reverse tuck — the top closure hangs off one long panel and the bottom off
 * the other. It nests better on the sheet than a straight tuck, which is why
 * nearly every cheap carton is made this way.
 *
 * The tongue is set in from the panel by a thickness and a bit, so it clears
 * the wall on the way down; the two steps that leaves are the shoulders, and
 * they are what stops the box falling open.
 */
function tuck({ l, w, h, t }: Inner): Piece {
  const lp = l + t;
  const wp = w + t;
  const wall = h + t;
  const tongue = clamp(Math.min(h, w) * 0.5, 8, 30);
  const dust = clamp(Math.min(lp, wp) * 0.35, 6, 25);
  const tab = clamp(Math.round(wp * 0.35), 12, 30);
  const inset = t + 0.5;
  const nose = Math.min(4, tongue / 2);
  const chamfer = Math.min(3, dust / 2);
  const gTab = Math.min(3, wall / 5);

  const x0 = 0;
  const x1 = tab;
  const x2 = x1 + lp;
  const x3 = x2 + wp;
  const x4 = x3 + lp;
  const x5 = x4 + wp;

  const y0 = 0;
  const y1 = tongue + wp;
  const y2 = y1 + wall;
  const y3 = y2 + wp + tongue;

  const shapes: Shape[] = [];

  // Glue flap.
  shapes.push(
    cut(x1, y1, x0, y1 + gTab),
    cut(x0, y1 + gTab, x0, y2 - gTab),
    cut(x0, y2 - gTab, x1, y2),
  );

  /** One closure: the lid panel, its tongue, and the shoulders between them. */
  const closure = (xa: number, xb: number, base: number, dir: 1 | -1) => {
    const fold = base + dir * wp;
    const tip = fold + dir * tongue;
    shapes.push(cut(xa, base, xa, fold), cut(xb, base, xb, fold));
    shapes.push(cut(xa, fold, xa + inset, fold), cut(xb - inset, fold, xb, fold));
    shapes.push(
      cut(xa + inset, fold, xa + inset, tip - dir * nose),
      cut(xa + inset, tip - dir * nose, xa + inset + nose, tip),
      cut(xa + inset + nose, tip, xb - inset - nose, tip),
      cut(xb - inset - nose, tip, xb - inset, tip - dir * nose),
      cut(xb - inset, tip - dir * nose, xb - inset, fold),
    );
    shapes.push(crease(xa, base, xb, base), crease(xa + inset, fold, xb - inset, fold));
  };

  // Bottom closure on the first long panel, top closure on the other.
  closure(x1, x2, y1, -1);
  closure(x3, x4, y2, 1);

  /** A dust flap: folds in first, holds the lid panel up. */
  const dustFlap = (xa: number, xb: number, base: number, dir: 1 | -1) => {
    const edge = base + dir * dust;
    shapes.push(
      cut(xa, base, xa, edge - dir * chamfer),
      cut(xa, edge - dir * chamfer, xa + chamfer, edge),
      cut(xa + chamfer, edge, xb - chamfer, edge),
      cut(xb - chamfer, edge, xb, edge - dir * chamfer),
      cut(xb, edge - dir * chamfer, xb, base),
      crease(xa, base, xb, base),
    );
  };

  dustFlap(x2, x3, y1, -1);
  dustFlap(x4, x5, y1, -1);
  dustFlap(x2, x3, y2, 1);
  dustFlap(x4, x5, y2, 1);

  // Where a panel has no flap, its edge is simply open board.
  shapes.push(cut(x1, y2, x2, y2), cut(x3, y1, x4, y1));

  shapes.push(cut(x5, y1, x5, y2));
  for (const x of [x1, x2, x3, x4]) shapes.push(crease(x, y1, x, y2));

  return {
    label: "Развёртка",
    width: x5,
    height: y3,
    shapes,
    dimensions: [
      { from: { x: x0, y: y3 }, to: { x: x5, y: y3 }, offset: 26, label: `${mm(x5)} общая` },
      { from: { x: x0, y: y0 }, to: { x: x0, y: y3 }, offset: -24, label: `${mm(y3)} общая` },
      // Above the whole blank, not above the wall: the top closure stands
      // between the two, and a chain drawn at the wall crosses straight over it.
      { from: { x: x0, y: y3 }, to: { x: x1, y: y3 }, offset: 11, label: mm(tab) },
      { from: { x: x1, y: y3 }, to: { x: x2, y: y3 }, offset: 11, label: mm(lp) },
      { from: { x: x2, y: y3 }, to: { x: x3, y: y3 }, offset: 11, label: mm(wp) },
      { from: { x: x3, y: y3 }, to: { x: x4, y: y3 }, offset: 11, label: mm(lp) },
      { from: { x: x4, y: y3 }, to: { x: x5, y: y3 }, offset: 11, label: mm(wp) },
      // Two tiers down the right edge. The wall and the dust flap are really
      // there at x5; the closure is on the panel before it, so its figures go
      // out to a second line rather than being crammed onto the first.
      { from: { x: x5, y: y1 }, to: { x: x5, y: y2 }, offset: 12, label: mm(wall) },
      { from: { x: x5, y: y2 }, to: { x: x5, y: y2 + dust }, offset: 12, label: `${mm(dust)} пылезащ.` },
      { from: { x: x5, y: y2 }, to: { x: x5, y: y2 + wp }, offset: 28, label: `${mm(wp)} крышка` },
      { from: { x: x5, y: y2 + wp }, to: { x: x5, y: y3 }, offset: 28, label: `${mm(tongue)} язычок` },
    ],
  };
}

// ── the whole job ───────────────────────────────────────────────────────────

export function buildBlank(spec: BoxSpec): Blank {
  const dims = inside(spec);
  const { l, w, h, t } = dims;

  const facts: { label: string; value: string }[] = [
    { label: "Тип", value: KIND_LABEL[spec.kind] },
    { label: "Внутри", value: `${mm(l)} × ${mm(w)} × ${mm(h)} мм` },
    { label: "Снаружи", value: `${mm(l + 2 * t)} × ${mm(w + 2 * t)} × ${mm(h + 2 * t)} мм` },
    { label: "Материал", value: `толщина ${mm(t)} мм` },
  ];

  const notes: string[] = [
    "Размеры на чертеже — по линии биговки, с учётом толщины материала.",
    "Сплошная линия — рез, пунктир — биговка.",
  ];

  let pieces: Piece[];

  if (spec.kind === "tray") {
    // The lid has to swallow the base, so it is built around the base's outside
    // plus a working clearance. Equal to the board thickness: thin card needs
    // almost nothing, corrugated needs real room.
    const gap = Math.max(0.5, t);
    const drop = clamp(spec.lidDrop, LIMITS.lidDrop.min, Math.max(LIMITS.lidDrop.min, h + t));
    pieces = [
      tray(l, w, h, t, "Дно"),
      tray(l + 2 * t + gap, w + 2 * t + gap, drop, t, "Крышка"),
    ];
    facts.push({ label: "Крышка", value: `высота ${mm(drop)} мм, зазор ${mm(gap)} мм` });
    notes.push("Две детали. Крышка рассчитана на посадку поверх дна.");
  } else if (spec.kind === "pillow") {
    pieces = [pillow(dims)];
    notes.push("Высота дуги — пропорция, а не расчёт: проверьте на образце.");
  } else if (spec.kind === "tuck") {
    pieces = [tuck(dims)];
    notes.push("Замок и пылезащитные клапаны — по типовым пропорциям, размеры проставлены.");
  } else {
    pieces = [rsc(dims)];
  }

  // Where a blank stops fitting the die boards a small print shop runs. A plain
  // 20 × 15 × 8 carton already unfolds past 700 mm, so warning there would mean
  // warning about ordinary boxes — and a caution that fires every time is one
  // nobody reads by the third box.
  const sheet = pieces.reduce(
    (worst, piece) => Math.max(worst, piece.width, piece.height),
    0,
  );
  if (sheet > 1000) {
    notes.push("Развёртка крупная — уточните у типографии максимальный формат штампа.");
  }

  return { pieces, facts, notes };
}

/** The flat size of each piece, for the "will it fit" answer on screen. */
export function blankSizes(blank: Blank): { label: string; width: number; height: number }[] {
  return blank.pieces.map((piece) => ({
    label: piece.label,
    width: piece.width,
    height: piece.height,
  }));
}
