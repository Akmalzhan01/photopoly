import type { Drawable } from "./imaging";

/**
 * Hand corrections to the cut-out.
 *
 * The model is good but not perfect: it shaves off wisps of hair and leaves
 * scraps of background around glasses and shoulders. Strokes are stored as data
 * rather than baked pixels, so every one of them stays undoable, and they are
 * normalised to 0…1 so they survive whatever resolution the image happens to be.
 */

export type StrokeMode = "erase" | "restore";

export type Point = { x: number; y: number };

export type Stroke = {
  mode: StrokeMode;
  /** Brush radius as a fraction of the image width. */
  radius: number;
  /** Edge feather, as a fraction of the radius. */
  softness: number;
  points: Point[];
};

function makeCanvas(width: number, height: number): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(width));
  canvas.height = Math.max(1, Math.round(height));
  return canvas;
}

function tracePath(
  ctx: CanvasRenderingContext2D,
  stroke: Stroke,
  width: number,
  height: number,
  from: number,
  originX = 0,
  originY = 0,
): void {
  const radius = Math.max(0.5, stroke.radius * width);
  const points = stroke.points;
  const start = Math.max(0, Math.min(from, points.length - 1));

  ctx.lineWidth = radius * 2;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  // A tap produces a single point, which `stroke()` would draw as nothing.
  if (points.length === 1 || start === points.length - 1) {
    const only = points[points.length - 1];
    ctx.beginPath();
    ctx.arc(only.x * width - originX, only.y * height - originY, radius, 0, Math.PI * 2);
    ctx.fill();
    return;
  }

  ctx.beginPath();
  ctx.moveTo(points[start].x * width - originX, points[start].y * height - originY);
  for (let i = start + 1; i < points.length; i++) {
    ctx.lineTo(points[i].x * width - originX, points[i].y * height - originY);
  }
  ctx.stroke();
}

function blurFor(stroke: Stroke, width: number): number {
  return Math.max(0, stroke.radius * width * stroke.softness);
}

/** Bounding box of a stroke segment, in canvas pixels, padded for brush and blur. */
function segmentBounds(
  stroke: Stroke,
  width: number,
  height: number,
  from: number,
): { x: number; y: number; w: number; h: number } {
  const pad = stroke.radius * width + blurFor(stroke, width) * 2 + 2;
  const points = stroke.points.slice(Math.max(0, from));
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const point of points) {
    minX = Math.min(minX, point.x * width);
    maxX = Math.max(maxX, point.x * width);
    minY = Math.min(minY, point.y * height);
    maxY = Math.max(maxY, point.y * height);
  }

  const x = Math.max(0, Math.floor(minX - pad));
  const y = Math.max(0, Math.floor(minY - pad));
  return {
    x,
    y,
    w: Math.min(width, Math.ceil(maxX + pad)) - x,
    h: Math.min(height, Math.ceil(maxY + pad)) - y,
  };
}

/**
 * Draws one stroke — or just the tail of it, from `from` — onto a canvas holding
 * the cut-out. `original` supplies the pixels that "restore" paints back.
 */
export function paintStroke(
  canvas: HTMLCanvasElement,
  original: Drawable,
  stroke: Stroke,
  from = 0,
): void {
  const ctx = canvas.getContext("2d");
  if (!ctx || stroke.points.length === 0) return;

  const { width, height } = canvas;
  const blur = blurFor(stroke, width);

  if (stroke.mode === "erase") {
    ctx.save();
    ctx.globalCompositeOperation = "destination-out";
    if (blur > 0) ctx.filter = `blur(${blur.toFixed(2)}px)`;
    ctx.fillStyle = "#000";
    ctx.strokeStyle = "#000";
    tracePath(ctx, stroke, width, height, from);
    ctx.restore();
    return;
  }

  // Restore: mask the segment, fill it from the original, then lay it back down.
  const box = segmentBounds(stroke, width, height, from);
  if (box.w <= 0 || box.h <= 0) return;

  const patch = makeCanvas(box.w, box.h);
  const pctx = patch.getContext("2d");
  if (!pctx) return;

  if (blur > 0) pctx.filter = `blur(${blur.toFixed(2)}px)`;
  pctx.fillStyle = "#fff";
  pctx.strokeStyle = "#fff";
  tracePath(pctx, stroke, width, height, from, box.x, box.y);

  pctx.filter = "none";
  pctx.globalCompositeOperation = "source-in";
  pctx.drawImage(
    original,
    0,
    0,
    original.width,
    original.height,
    -box.x,
    -box.y,
    width,
    height,
  );

  ctx.drawImage(patch, box.x, box.y);
}

/** Replays every stroke over a fresh copy of the cut-out. */
export function applyStrokes(
  cutout: Drawable,
  original: Drawable,
  strokes: Stroke[],
): HTMLCanvasElement {
  const canvas = makeCanvas(cutout.width, cutout.height);
  const ctx = canvas.getContext("2d");
  if (ctx) {
    ctx.drawImage(cutout, 0, 0);
    for (const stroke of strokes) paintStroke(canvas, original, stroke);
  }
  return canvas;
}
