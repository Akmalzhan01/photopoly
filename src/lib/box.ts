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
 * the die maker can see it and argue with it — and, since the figures are only
 * conventions, every one of them can be overridden here too.
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

/**
 * One panel of the folded box, for the preview.
 *
 * A rectangle in blank coordinates plus the edge it turns on, so the same
 * numbers that drew the flat shape also assemble it. Keeping the two from one
 * source is the point: a preview built from its own idea of the box would
 * happily show a box the drawing does not make.
 */
export type Face = {
  /** Rectangle in blank space, y up. */
  x: number;
  y: number;
  w: number;
  h: number;
  /** Which of this face's own edges is the crease it turns on. */
  hinge: "left" | "right" | "top" | "bottom";
  /** Degrees at full fold. Positive folds away from the viewer. */
  angle: number;
  role: "panel" | "flap" | "glue";
  children: Face[];
};

export type Piece = {
  /** Named because a two-piece box arrives as two drawings and they get mixed up. */
  label: string;
  width: number;
  height: number;
  shapes: Shape[];
  dimensions: Dimension[];
  /** The same piece, assembled. Null where folding it is not worth faking. */
  faces: Face | null;
};

export type Blank = {
  pieces: Piece[];
  /** The title block: what the die maker has to know and we must not leave out. */
  facts: { label: string; value: string }[];
  /** Said out loud on the drawing, because a silent assumption ruins a batch. */
  notes: string[];
  /** Shown in the interface, not on the drawing. */
  warnings: string[];
};

/**
 * The proportions that are conventions rather than consequences.
 *
 * Every one of these was a formula with a clamp on it. They are reasonable
 * defaults and they are also somebody else's opinion, so each can be replaced:
 * a shop that knows its board and its glue machine knows better than a formula
 * what its glue flap should be.
 */
export type Knob =
  | "glueTab"
  | "flapDepth"
  | "slot"
  | "cornerTab"
  | "lidGap"
  | "arcRise"
  | "tongue"
  | "dustFlap"
  | "radius";

export type Tweaks = Partial<Record<Knob, number>>;

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
  /** Overrides for the conventions above. Absent means "use the formula". */
  tweaks: Tweaks;
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

/**
 * Sanity, not permission.
 *
 * These exist so a typo cannot produce a blank with no dimensions or one the
 * browser cannot draw — not to decide what size of box a shop is allowed to
 * make. Anything unusual is said out loud in `warnings` and drawn anyway.
 */
export const LIMITS = {
  side: { min: 1, max: 100_000 },
  thickness: { min: 0.01, max: 50 },
  lidDrop: { min: 1, max: 100_000 },
} as const;

/** Past this the blank stops fitting the die boards a small print shop runs. */
const BIG_BLANK = 1000;

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

const safe = (value: unknown, fallback: number, low: number, high: number) =>
  typeof value === "number" && Number.isFinite(value) ? clamp(value, low, high) : fallback;

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

const face = (
  x: number,
  y: number,
  w: number,
  h: number,
  hinge: Face["hinge"],
  angle: number,
  role: Face["role"] = "panel",
  children: Face[] = [],
): Face => ({ x, y, w, h, hinge, angle, role, children });

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
    l: Math.max(0.5, spec.length - shrink),
    w: Math.max(0.5, spec.width - shrink),
    h: Math.max(
      0.5,
      spec.height - (spec.measure === "outer" ? (spec.kind === "tray" ? t : 2 * t) : 0),
    ),
    t,
  };
}

type Props = Record<Knob, number>;

/** What each proportion works out to when nobody has overridden it. */
function automatic(spec: BoxSpec, { l, w, h, t }: Inner): Props {
  const lp = l + t;
  const wp = w + t;
  const trayWall = h + t / 2;
  return {
    glueTab: clamp(Math.round(wp * 0.35), 12, 40),
    flapDepth: wp / 2,
    slot: t,
    cornerTab: Math.min(trayWall - 1.5, clamp(trayWall * 0.7, 6, 28)),
    lidGap: Math.max(0.5, t),
    arcRise: clamp(Math.max(wp / 4, (h + t) / 2 + 2), 3, (l + t) / 3),
    tongue: clamp(Math.min(h, w) * 0.5, 8, 30),
    dustFlap: clamp(Math.min(lp, wp) * 0.35, 6, 25),
    radius: 0,
  };
}

function resolve(spec: BoxSpec, dims: Inner): { auto: Props; used: Props } {
  const auto = automatic(spec, dims);
  const used = { ...auto };
  for (const key of Object.keys(auto) as Knob[]) {
    // Optional chaining on purpose: a spec stored by an older build has no
    // tweaks at all, and the formula is exactly the right answer for it.
    const override = spec.tweaks?.[key];
    if (typeof override === "number" && Number.isFinite(override) && override >= 0) {
      used[key] = override;
    }
  }
  return { auto, used };
}

/** Which proportions a given box has, and what to call them. */
export const KNOBS: Record<BoxKind, { key: Knob; label: string; note: string }[]> = {
  rsc: [
    { key: "glueTab", label: "Клапан склейки", note: "Полоса под клей сбоку" },
    { key: "flapDepth", label: "Глубина клапанов", note: "Половина ширины — они сходятся в середине" },
    { key: "slot", label: "Ширина прорези", note: "Зазор между клапанами, обычно толщина картона" },
  ],
  tray: [
    { key: "cornerTab", label: "Угловой язычок", note: "Насколько заходит на соседнюю стенку" },
    { key: "lidGap", label: "Зазор крышки", note: "Насколько крышка шире дна" },
  ],
  pillow: [
    { key: "glueTab", label: "Клапан склейки", note: "Полоса под клей сбоку" },
    { key: "arcRise", label: "Высота дуги", note: "Чем выше, тем плотнее закрывается торец" },
  ],
  tuck: [
    { key: "glueTab", label: "Клапан склейки", note: "Полоса под клей сбоку" },
    { key: "tongue", label: "Язычок замка", note: "Заправляется за переднюю стенку" },
    { key: "dustFlap", label: "Пылезащитный клапан", note: "Складывается первым, держит крышку" },
  ],
};

/** The rounding control, offered on every shape. */
export const RADIUS_KNOB = {
  key: "radius" as const,
  label: "Скругление углов",
  note: "0 — острые. Скругляются только свободные углы, биговки не трогаются",
};

export type KnobView = {
  key: Knob;
  label: string;
  note: string;
  /** What the formula says. */
  auto: number;
  /** What is actually being used. */
  value: number;
  /** Whether it has been overridden. */
  set: boolean;
};

export function knobsFor(spec: BoxSpec): KnobView[] {
  const dims = inside(spec);
  const { auto, used } = resolve(spec, dims);
  return [...KNOBS[spec.kind], RADIUS_KNOB].map(({ key, label, note }) => ({
    key,
    label,
    note,
    auto: auto[key],
    value: used[key],
    set: typeof spec.tweaks?.[key] === "number",
  }));
}

// ── rounding ────────────────────────────────────────────────────────────────

/**
 * A point as a map key, with negative zero spelled the same as zero.
 *
 * Two corners at the same place must produce the same string or they will not
 * be recognised as one corner, and `-0` prints differently from `0` while being
 * equal to it.
 */
const at = (p: Point) => {
  const fix = (v: number) => {
    const r = Math.round(v * 10_000) / 10_000;
    return (Object.is(r, -0) ? 0 : r).toFixed(4);
  };
  return `${fix(p.x)},${fix(p.y)}`;
};

/**
 * Rounds the free corners of a blank.
 *
 * Only where two straight cuts meet and no crease ends there. A crease junction
 * is a corner the board folds around; rounding it would take the fold with it.
 * The inner end of a slot is fair game and is better rounded than not — a sharp
 * slot end is where board tears — but it is usually too short to take a radius,
 * and the check below refuses rather than eating the edge.
 *
 * Each corner becomes an arc tangent to both edges, and both edges are trimmed
 * back to the tangent points, so the outline stays exactly as closed as it was.
 */
function roundCorners(shapes: Shape[], radius: number): Shape[] {
  if (!(radius > 0)) return shapes;

  const creaseEnds = new Set<string>();
  for (const shape of shapes) {
    if (shape.layer !== "crease" || shape.kind !== "line") continue;
    creaseEnds.add(at(shape.a));
    creaseEnds.add(at(shape.b));
  }

  const meeting = new Map<string, { index: number; end: "a" | "b" }[]>();
  shapes.forEach((shape, index) => {
    if (shape.kind !== "line" || shape.layer !== "cut") return;
    for (const end of ["a", "b"] as const) {
      const key = at(shape[end]);
      meeting.set(key, [...(meeting.get(key) ?? []), { index, end }]);
    }
  });

  const trims = new Map<number, { a?: Point; b?: Point }>();
  const fillets: Shape[] = [];

  for (const [key, ends] of meeting) {
    if (ends.length !== 2 || creaseEnds.has(key)) continue;
    const [first, second] = ends;
    if (first.index === second.index) continue;

    const one = shapes[first.index] as Extract<Shape, { kind: "line" }>;
    const two = shapes[second.index] as Extract<Shape, { kind: "line" }>;
    const corner = first.end === "a" ? one.a : one.b;
    const awayOne = first.end === "a" ? one.b : one.a;
    const awayTwo = second.end === "a" ? two.b : two.a;

    const spanOne = Math.hypot(awayOne.x - corner.x, awayOne.y - corner.y);
    const spanTwo = Math.hypot(awayTwo.x - corner.x, awayTwo.y - corner.y);
    if (spanOne < 0.01 || spanTwo < 0.01) continue;
    const dirOne = { x: (awayOne.x - corner.x) / spanOne, y: (awayOne.y - corner.y) / spanOne };
    const dirTwo = { x: (awayTwo.x - corner.x) / spanTwo, y: (awayTwo.y - corner.y) / spanTwo };

    const theta = Math.acos(clamp(dirOne.x * dirTwo.x + dirOne.y * dirTwo.y, -1, 1));
    // A corner that is nearly a straight line has nothing to round, and one
    // that is nearly folded back on itself would need an arc bigger than the
    // board.
    if (theta < 0.25 || theta > Math.PI - 0.05) continue;

    const half = theta / 2;
    const back = radius / Math.tan(half);
    // Never take more than half an edge: two rounded corners on a short edge
    // would otherwise meet in the middle and erase it.
    if (back > spanOne * 0.45 || back > spanTwo * 0.45) continue;

    const tangentOne = { x: corner.x + dirOne.x * back, y: corner.y + dirOne.y * back };
    const tangentTwo = { x: corner.x + dirTwo.x * back, y: corner.y + dirTwo.y * back };
    const bisector = { x: dirOne.x + dirTwo.x, y: dirOne.y + dirTwo.y };
    const bisectorLength = Math.hypot(bisector.x, bisector.y);
    if (bisectorLength < 1e-9) continue;
    const reach = radius / Math.sin(half);
    const centre = {
      x: corner.x + (bisector.x / bisectorLength) * reach,
      y: corner.y + (bisector.y / bisectorLength) * reach,
    };

    const angleOf = (p: Point) =>
      (Math.atan2(p.y - centre.y, p.x - centre.x) * 180) / Math.PI;
    const angleOne = angleOf(tangentOne);
    const angleTwo = angleOf(tangentTwo);
    const sweep = (((angleTwo - angleOne) % 360) + 360) % 360;
    const [from, to] = sweep <= 180 ? [angleOne, angleTwo] : [angleTwo, angleOne];

    fillets.push({ kind: "arc", layer: "cut", centre, radius, from, to });
    trims.set(first.index, { ...trims.get(first.index), [first.end]: tangentOne });
    trims.set(second.index, { ...trims.get(second.index), [second.end]: tangentTwo });
  }

  const trimmed = shapes.map((shape, index) => {
    const trim = trims.get(index);
    if (!trim || shape.kind !== "line") return shape;
    return { ...shape, a: trim.a ?? shape.a, b: trim.b ?? shape.b };
  });
  return [...trimmed, ...fillets];
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
function rsc({ l, w, h, t }: Inner, p: Props): Piece {
  const lp = l + t;
  const wp = w + t;
  const wall = h + t;
  const flap = p.flapDepth;
  const tab = p.glueTab;
  const slot = p.slot;
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

  // Slots. Each internal crease gets a notch through the flap zones, closed at
  // the inner end so the outline stays a single closed contour.
  for (const x of [x2, x3, x4]) {
    const a = x - slot / 2;
    const b = x + slot / 2;
    shapes.push(
      cut(a, y2, a, y3),
      cut(b, y2, b, y3),
      cut(a, y2, b, y2),
      cut(a, y0, a, y1),
      cut(b, y0, b, y1),
      cut(a, y1, b, y1),
    );
  }

  shapes.push(cut(x1, y2, x1, y3), cut(x1, y0, x1, y1));
  shapes.push(cut(x5, y0, x5, y3));

  const runs: [number, number][] = [
    [x1, x2 - slot / 2],
    [x2 + slot / 2, x3 - slot / 2],
    [x3 + slot / 2, x4 - slot / 2],
    [x4 + slot / 2, x5],
  ];
  for (const [a, b] of runs) {
    shapes.push(cut(a, y3, b, y3), cut(a, y0, b, y0));
  }

  shapes.push(crease(x1, y1, x5, y1), crease(x1, y2, x5, y2));
  for (const x of [x1, x2, x3, x4]) shapes.push(crease(x, y1, x, y2));

  // Assembled: the four walls turn the corner one after another, and every wall
  // carries a flap top and bottom.
  const wallFace = (x: number, width: number, hinge: Face["hinge"], angle: number) =>
    face(x, y1, width, wall, hinge, angle, "panel", [
      face(x, y2, width, flap, "bottom", -90, "flap"),
      face(x, y0, width, flap, "top", 90, "flap"),
    ]);

  const chain = wallFace(x4, wp, "left", -90);
  const third = wallFace(x3, lp, "left", -90);
  third.children.push(chain);
  const second = wallFace(x2, wp, "left", -90);
  second.children.push(third);
  const root = wallFace(x1, lp, "left", 0);
  root.children.push(second, face(x0, y1, tab, wall, "right", 90, "glue"));

  return {
    label: "Развёртка",
    width: x5,
    height: y3,
    shapes: roundCorners(shapes, p.radius),
    faces: root,
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
function tray(l: number, w: number, h: number, t: number, p: Props, label: string): Piece {
  const floorW = l + t;
  const floorH = w + t;
  // One fold from the floor, so half a thickness rather than a whole one.
  const wall = h + t / 2;
  const tabLen = Math.min(wall, p.cornerTab);

  const x0 = 0;
  const x1 = wall;
  const x2 = x1 + floorW;
  const x3 = x2 + wall;
  const y0 = 0;
  const y1 = wall;
  const y2 = y1 + floorH;
  const y3 = y2 + wall;

  const shapes: Shape[] = [];

  shapes.push(cut(x1, y0, x2, y0), cut(x1, y0, x1, y1), cut(x2, y0, x2, y1));
  shapes.push(cut(x1, y3, x2, y3), cut(x1, y2, x1, y3), cut(x2, y2, x2, y3));

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

  // Which way each wall turns depends on which edge it hangs from: the same
  // angle on opposite sides would fold one wall up and the other down.
  const sideWall = (x: number, hinge: "left" | "right", angle: number) =>
    face(x, y1, wall, floorH, hinge, angle, "panel", [
      face(x, y1 - tabLen, wall, tabLen, "top", 90, "glue"),
      face(x, y2, wall, tabLen, "bottom", -90, "glue"),
    ]);

  const root = face(x1, y1, floorW, floorH, "bottom", 0, "panel", [
    face(x1, y0, floorW, wall, "top", 90, "panel"),
    face(x1, y2, floorW, wall, "bottom", -90, "panel"),
    sideWall(x0, "right", 90),
    sideWall(x2, "left", -90),
  ]);

  return {
    label,
    width: x3,
    height: y3,
    shapes: roundCorners(shapes, p.radius),
    faces: root,
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
 * every template house picks its own. A quarter of the panel is the common one.
 * The figure is dimensioned on the drawing and can be set by hand.
 */
function pillow({ l, w, h, t }: Inner, p: Props): Piece {
  const faceW = w + t;
  const side = h + t;
  const body = l + t;
  const sag = p.arcRise;
  const tab = p.glueTab;
  const chamfer = Math.min(3, body / 6);

  const x0 = 0;
  const x1 = tab;
  const x2 = x1 + faceW;
  const x3 = x2 + side;
  const x4 = x3 + faceW;
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

  // The tube, with the curved ends shown as flaps turning in. They are arcs,
  // not rectangles, so this is the shape of what happens rather than a
  // reproduction of it — enough to see the box, not a substitute for a sample.
  const tubeFace = (x: number, width: number, hinge: Face["hinge"], angle: number, ends: boolean) =>
    face(x, yLow, width, body, hinge, angle, "panel",
      ends
        ? [
            face(x, yHigh, width, sag, "bottom", -80, "flap"),
            face(x, yLow - sag, width, sag, "top", 80, "flap"),
          ]
        : []);

  const fourth = tubeFace(x4, side, "left", -90, false);
  const third = tubeFace(x3, faceW, "left", -90, true);
  third.children.push(fourth);
  const second = tubeFace(x2, side, "left", -90, false);
  second.children.push(third);
  const root = tubeFace(x1, faceW, "left", 0, true);
  root.children.push(second, face(x0, yLow, tab, body, "right", 90, "glue"));

  return {
    label: "Развёртка",
    width: x5,
    height: yHigh + sag,
    shapes: roundCorners(shapes, p.radius),
    faces: root,
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
      { from: { x: x1, y: yHigh + sag }, to: { x: x2, y: yHigh + sag }, offset: 11, label: mm(faceW) },
      { from: { x: x2, y: yHigh + sag }, to: { x: x3, y: yHigh + sag }, offset: 11, label: mm(side) },
      { from: { x: x3, y: yHigh + sag }, to: { x: x4, y: yHigh + sag }, offset: 11, label: mm(faceW) },
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
function tuck({ l, w, h, t }: Inner, p: Props): Piece {
  const lp = l + t;
  const wp = w + t;
  const wall = h + t;
  const tongue = p.tongue;
  const dust = p.dustFlap;
  const tab = p.glueTab;
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

  shapes.push(cut(x1, y2, x2, y2), cut(x3, y1, x4, y1));
  shapes.push(cut(x5, y1, x5, y2));
  for (const x of [x1, x2, x3, x4]) shapes.push(crease(x, y1, x, y2));

  const wallFace = (
    x: number,
    width: number,
    hinge: Face["hinge"],
    angle: number,
    extras: Face[],
  ) => face(x, y1, width, wall, hinge, angle, "panel", extras);

  const dustPair = (x: number, width: number) => [
    face(x, y2, width, dust, "bottom", -90, "flap"),
    face(x, y1 - dust, width, dust, "top", 90, "flap"),
  ];

  const topLid = face(x3, y2, lp, wp, "bottom", -90, "panel", [
    face(x3 + inset, y2 + wp, lp - 2 * inset, tongue, "bottom", -90, "flap"),
  ]);
  const bottomLid = face(x1, y1 - wp, lp, wp, "top", 90, "panel", [
    face(x1 + inset, y1 - wp - tongue, lp - 2 * inset, tongue, "top", 90, "flap"),
  ]);

  const fourth = wallFace(x4, wp, "left", -90, dustPair(x4, wp));
  const third = wallFace(x3, lp, "left", -90, [topLid]);
  third.children.push(fourth);
  const second = wallFace(x2, wp, "left", -90, dustPair(x2, wp));
  second.children.push(third);
  const root = wallFace(x1, lp, "left", 0, [bottomLid]);
  root.children.push(second, face(x0, y1, tab, wall, "right", 90, "glue"));

  return {
    label: "Развёртка",
    width: x5,
    height: y3,
    shapes: roundCorners(shapes, p.radius),
    faces: root,
    dimensions: [
      { from: { x: x0, y: y3 }, to: { x: x5, y: y3 }, offset: 26, label: `${mm(x5)} общая` },
      { from: { x: x0, y: y0 }, to: { x: x0, y: y3 }, offset: -24, label: `${mm(y3)} общая` },
      { from: { x: x0, y: y3 }, to: { x: x1, y: y3 }, offset: 11, label: mm(tab) },
      { from: { x: x1, y: y3 }, to: { x: x2, y: y3 }, offset: 11, label: mm(lp) },
      { from: { x: x2, y: y3 }, to: { x: x3, y: y3 }, offset: 11, label: mm(wp) },
      { from: { x: x3, y: y3 }, to: { x: x4, y: y3 }, offset: 11, label: mm(lp) },
      { from: { x: x4, y: y3 }, to: { x: x5, y: y3 }, offset: 11, label: mm(wp) },
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
  const { used } = resolve(spec, dims);

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
  const warnings: string[] = [];

  let pieces: Piece[];

  if (spec.kind === "tray") {
    // The lid has to swallow the base, so it is built around the base's outside
    // plus a working clearance.
    const gap = used.lidGap;
    const drop = Math.max(0.5, spec.lidDrop);
    pieces = [
      tray(l, w, h, t, used, "Дно"),
      tray(l + 2 * t + gap, w + 2 * t + gap, drop, t, used, "Крышка"),
    ];
    facts.push({ label: "Крышка", value: `высота ${mm(drop)} мм, зазор ${mm(gap)} мм` });
    notes.push("Две детали. Крышка рассчитана на посадку поверх дна.");
    if (gap < 0.3) warnings.push("Зазор крышки почти нулевой — крышка может не налезть на дно.");
  } else if (spec.kind === "pillow") {
    pieces = [pillow(dims, used)];
    notes.push("Высота дуги — пропорция, а не расчёт: проверьте на образце.");
    if (used.arcRise < (h + t) / 2) {
      warnings.push("Дуга ниже половины толщины — торцы, скорее всего, не сойдутся.");
    }
  } else if (spec.kind === "tuck") {
    pieces = [tuck(dims, used)];
    notes.push("Замок и пылезащитные клапаны — по типовым пропорциям, размеры проставлены.");
    if (used.tongue > h) warnings.push("Язычок длиннее высоты коробки — он упрётся в дно.");
    if (2 * used.dustFlap > l + t) {
      warnings.push("Пылезащитные клапаны встретятся друг с другом — уменьшите их.");
    }
  } else {
    pieces = [rsc(dims, used)];
    if (Math.abs(used.flapDepth * 2 - (w + t)) > 0.5) {
      warnings.push(
        used.flapDepth * 2 > w + t
          ? "Клапаны длиннее половины ширины — они перехлестнутся и коробка не ляжет плоско."
          : "Клапаны короче половины ширины — между ними останется щель.",
      );
    }
  }

  const sheet = pieces.reduce((worst, piece) => Math.max(worst, piece.width, piece.height), 0);
  if (sheet > BIG_BLANK) {
    notes.push("Развёртка крупная — уточните у типографии максимальный формат штампа.");
    warnings.push(
      `Развёртка ${mm(sheet)} мм по длинной стороне — уточните у типографии максимальный размер штампа.`,
    );
  }
  if (t > Math.min(l, w, h) / 3) {
    warnings.push("Материал толстый относительно коробки — проверьте на образце, будет ли она закрываться.");
  }

  return { pieces, facts, notes, warnings };
}

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
    tweaks: {},
  };
}

export function sanitiseSpec(raw: unknown): BoxSpec {
  const base = initialSpec();
  if (!raw || typeof raw !== "object") return base;
  const v = raw as Record<string, unknown>;

  const tweaks: Tweaks = {};
  const stored = v.tweaks;
  if (stored && typeof stored === "object") {
    for (const [key, value] of Object.entries(stored as Record<string, unknown>)) {
      if (typeof value === "number" && Number.isFinite(value) && value >= 0 && value < 100_000) {
        tweaks[key as Knob] = value;
      }
    }
  }

  return {
    kind: KINDS.some((k) => k.value === v.kind) ? (v.kind as BoxKind) : base.kind,
    length: safe(v.length, base.length, LIMITS.side.min, LIMITS.side.max),
    width: safe(v.width, base.width, LIMITS.side.min, LIMITS.side.max),
    height: safe(v.height, base.height, LIMITS.side.min, LIMITS.side.max),
    thickness: safe(v.thickness, base.thickness, LIMITS.thickness.min, LIMITS.thickness.max),
    measure: v.measure === "outer" ? "outer" : "inner",
    lidDrop: safe(v.lidDrop, base.lidDrop, LIMITS.lidDrop.min, LIMITS.lidDrop.max),
    tweaks,
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
