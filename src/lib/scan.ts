/**
 * Turning a phone photo of a document into something that looks scanned.
 *
 * Three steps, all plain arithmetic on the device:
 *
 * 1. **Find the page.** Paper is almost always the brightest large thing in
 *    the frame. On a small copy of the photo the brightness is split into
 *    "paper" and "not paper" by Otsu's threshold, the largest connected bright
 *    region is taken as the sheet, and its corners are the points furthest
 *    along the two diagonals. It is a guess, and the page lets the corners be
 *    dragged; when the guess is implausible the corners start just inside the
 *    frame instead.
 * 2. **Flatten it.** A homography maps the chosen quadrilateral onto a
 *    rectangle whose sides are the quadrilateral's own lengths, so a page shot
 *    at an angle comes out square, at its own proportions.
 * 3. **Clean it.** The light falling on a page is uneven — a shadow from the
 *    phone, a lamp's warm corner. The page's own background is estimated by
 *    taking the brightest value in each small neighbourhood (which removes the
 *    text) and blurring that, and every pixel is divided by it. Paper comes
 *    out white and even; ink stays ink.
 */

export type Point = { x: number; y: number };
/** Top-left, top-right, bottom-right, bottom-left. */
export type Quad = [Point, Point, Point, Point];

export type ScanFilter = "original" | "enhanced" | "gray" | "bw";

/** Longest side of a flattened page. 3000 px is A4 at about 250 dpi. */
export const MAX_PAGE_EDGE = 3000;

function canvas(width: number, height: number): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = Math.max(1, Math.round(width));
  c.height = Math.max(1, Math.round(height));
  return c;
}

function context(c: HTMLCanvasElement): CanvasRenderingContext2D {
  const ctx = c.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("Canvas unavailable");
  return ctx;
}

/** Corners a little inside the frame: the fallback when no page is found. */
export function insetQuad(width: number, height: number, inset = 0.06): Quad {
  const dx = width * inset;
  const dy = height * inset;
  return [
    { x: dx, y: dy },
    { x: width - dx, y: dy },
    { x: width - dx, y: height - dy },
    { x: dx, y: height - dy },
  ];
}

function otsu(gray: Uint8ClampedArray | Uint8Array): number {
  const hist = new Array<number>(256).fill(0);
  for (const v of gray) hist[v]++;
  const total = gray.length;
  let sum = 0;
  for (let i = 0; i < 256; i++) sum += i * hist[i];
  let sumB = 0;
  let weightB = 0;
  let best = 0;
  let threshold = 127;
  for (let t = 0; t < 256; t++) {
    weightB += hist[t];
    if (weightB === 0) continue;
    const weightF = total - weightB;
    if (weightF === 0) break;
    sumB += t * hist[t];
    const meanB = sumB / weightB;
    const meanF = (sum - sumB) / weightF;
    const between = weightB * weightF * (meanB - meanF) ** 2;
    if (between > best) {
      best = between;
      threshold = t;
    }
  }
  return threshold;
}

/**
 * Where the sheet of paper probably is, in `source`'s own pixel coordinates.
 */
export function detectQuad(source: CanvasImageSource & { width: number; height: number }): Quad {
  const W = source.width;
  const H = source.height;
  const scale = Math.min(1, 360 / Math.max(W, H));
  const w = Math.max(8, Math.round(W * scale));
  const h = Math.max(8, Math.round(H * scale));
  const small = canvas(w, h);
  const ctx = context(small);
  // A light blur first, so text and paper texture do not break the page into pieces.
  ctx.filter = "blur(2px)";
  ctx.drawImage(source, 0, 0, w, h);
  ctx.filter = "none";
  const rgba = ctx.getImageData(0, 0, w, h).data;

  const gray = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) {
    gray[i] = (rgba[i * 4] * 77 + rgba[i * 4 + 1] * 150 + rgba[i * 4 + 2] * 29) >> 8;
  }
  const threshold = otsu(gray);

  // Largest 4-connected bright region.
  const label = new Int32Array(w * h).fill(-1);
  const stack = new Int32Array(w * h);
  let bestId = -1;
  let bestSize = 0;
  let id = 0;
  for (let start = 0; start < w * h; start++) {
    if (gray[start] <= threshold || label[start] !== -1) continue;
    let top = 0;
    stack[top++] = start;
    label[start] = id;
    let size = 0;
    while (top > 0) {
      const p = stack[--top];
      size++;
      const x = p % w;
      const y = (p - x) / w;
      const next = [x > 0 ? p - 1 : -1, x < w - 1 ? p + 1 : -1, y > 0 ? p - w : -1, y < h - 1 ? p + w : -1];
      for (const n of next) {
        if (n >= 0 && label[n] === -1 && gray[n] > threshold) {
          label[n] = id;
          stack[top++] = n;
        }
      }
    }
    if (size > bestSize) {
      bestSize = size;
      bestId = id;
    }
    id++;
  }

  const share = bestSize / (w * h);
  // Too small to be the page, or the whole frame is "paper" — no real edge found.
  if (bestId < 0 || share < 0.12 || share > 0.97) return insetQuad(W, H);

  let tl = { x: 0, y: 0, v: Infinity };
  let br = { x: 0, y: 0, v: -Infinity };
  let tr = { x: 0, y: 0, v: -Infinity };
  let bl = { x: 0, y: 0, v: Infinity };
  for (let p = 0; p < w * h; p++) {
    if (label[p] !== bestId) continue;
    const x = p % w;
    const y = (p - x) / w;
    if (x + y < tl.v) tl = { x, y, v: x + y };
    if (x + y > br.v) br = { x, y, v: x + y };
    if (x - y > tr.v) tr = { x, y, v: x - y };
    if (x - y < bl.v) bl = { x, y, v: x - y };
  }
  // Found on a copy a few hundred pixels wide, each corner can sit a pixel or
  // two of the original outside the paper, which leaves a thin dark seam of
  // table along the edge of the scan. Pulled a little towards the middle.
  const cx = (tl.x + tr.x + br.x + bl.x) / 4;
  const cy = (tl.y + tr.y + br.y + bl.y) / 4;
  const up = (p: { x: number; y: number }): Point => ({
    x: Math.min(W, Math.max(0, (p.x + 0.5 + (cx - p.x) * 0.012) / scale)),
    y: Math.min(H, Math.max(0, (p.y + 0.5 + (cy - p.y) * 0.012) / scale)),
  });
  return [up(tl), up(tr), up(br), up(bl)];
}

const dist = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);

/** The rectangle a quad flattens into: its own side lengths, capped. */
export function flatSize(quad: Quad, maxEdge = MAX_PAGE_EDGE): { w: number; h: number } {
  const [tl, tr, br, bl] = quad;
  let w = Math.max(dist(tl, tr), dist(bl, br));
  let h = Math.max(dist(tl, bl), dist(tr, br));
  const ratio = Math.min(1, maxEdge / Math.max(w, h, 1));
  w *= ratio;
  h *= ratio;
  return { w: Math.max(1, Math.round(w)), h: Math.max(1, Math.round(h)) };
}

/**
 * The 3×3 matrix taking the rectangle (0,0)–(w,h) onto `quad`, solved as the
 * usual eight-unknown linear system. Used backwards: every output pixel asks
 * where in the photo it came from.
 */
function homography(w: number, h: number, quad: Quad): number[] {
  const from: Point[] = [
    { x: 0, y: 0 },
    { x: w, y: 0 },
    { x: w, y: h },
    { x: 0, y: h },
  ];
  const A: number[][] = [];
  const b: number[] = [];
  for (let i = 0; i < 4; i++) {
    const { x, y } = from[i];
    const { x: u, y: v } = quad[i];
    A.push([x, y, 1, 0, 0, 0, -u * x, -u * y]);
    b.push(u);
    A.push([0, 0, 0, x, y, 1, -v * x, -v * y]);
    b.push(v);
  }
  // Gaussian elimination with partial pivoting.
  for (let col = 0; col < 8; col++) {
    let pivot = col;
    for (let row = col + 1; row < 8; row++) if (Math.abs(A[row][col]) > Math.abs(A[pivot][col])) pivot = row;
    [A[col], A[pivot]] = [A[pivot], A[col]];
    [b[col], b[pivot]] = [b[pivot], b[col]];
    for (let row = col + 1; row < 8; row++) {
      const f = A[row][col] / A[col][col];
      for (let k = col; k < 8; k++) A[row][k] -= f * A[col][k];
      b[row] -= f * b[col];
    }
  }
  const x = new Array<number>(8).fill(0);
  for (let row = 7; row >= 0; row--) {
    let s = b[row];
    for (let k = row + 1; k < 8; k++) s -= A[row][k] * x[k];
    x[row] = s / A[row][row];
  }
  return [...x, 1];
}

/** The page inside `quad`, flattened to a rectangle, with bilinear sampling. */
export function flatten(source: HTMLCanvasElement, quad: Quad, maxEdge = MAX_PAGE_EDGE): HTMLCanvasElement {
  const { w, h } = flatSize(quad, maxEdge);
  const [a, b, c, d, e, f, g, k] = homography(w, h, quad);
  const W = source.width;
  const H = source.height;
  const src = context(source).getImageData(0, 0, W, H).data;
  const out = canvas(w, h);
  const ctx = context(out);
  const image = ctx.createImageData(w, h);
  const dst = image.data;

  for (let y = 0; y < h; y++) {
    const yy = y + 0.5;
    for (let x = 0; x < w; x++) {
      const xx = x + 0.5;
      const z = g * xx + k * yy + 1;
      const u = Math.min(W - 1.001, Math.max(0, (a * xx + b * yy + c) / z - 0.5));
      const v = Math.min(H - 1.001, Math.max(0, (d * xx + e * yy + f) / z - 0.5));
      const x0 = u | 0;
      const y0 = v | 0;
      const fx = u - x0;
      const fy = v - y0;
      const i00 = (y0 * W + x0) * 4;
      const i10 = i00 + 4;
      const i01 = i00 + W * 4;
      const i11 = i01 + 4;
      const o = (y * w + x) * 4;
      for (let ch = 0; ch < 3; ch++) {
        const top = src[i00 + ch] + (src[i10 + ch] - src[i00 + ch]) * fx;
        const bottom = src[i01 + ch] + (src[i11 + ch] - src[i01 + ch]) * fx;
        dst[o + ch] = top + (bottom - top) * fy;
      }
      dst[o + 3] = 255;
    }
  }
  ctx.putImageData(image, 0, 0);
  return out;
}

/**
 * The paper's own brightness everywhere on the page: a small copy, a
 * neighbourhood maximum to lift the text out, then enlarged smoothly.
 */
function backgroundOf(page: HTMLCanvasElement): Uint8ClampedArray {
  const w = Math.max(4, Math.round(page.width / 12));
  const h = Math.max(4, Math.round(page.height / 12));
  const small = canvas(w, h);
  const sctx = context(small);
  sctx.imageSmoothingQuality = "high";
  sctx.drawImage(page, 0, 0, w, h);
  const data = sctx.getImageData(0, 0, w, h);
  const px = data.data;
  const R = 3;
  // Separable maximum: rows, then columns.
  const tmp = new Uint8ClampedArray(px.length);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      for (let ch = 0; ch < 3; ch++) {
        let m = 0;
        for (let dx = -R; dx <= R; dx++) {
          const xx = Math.min(w - 1, Math.max(0, x + dx));
          m = Math.max(m, px[(y * w + xx) * 4 + ch]);
        }
        tmp[(y * w + x) * 4 + ch] = m;
      }
      tmp[(y * w + x) * 4 + 3] = 255;
    }
  }
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      for (let ch = 0; ch < 3; ch++) {
        let m = 0;
        for (let dy = -R; dy <= R; dy++) {
          const yy = Math.min(h - 1, Math.max(0, y + dy));
          m = Math.max(m, tmp[(yy * w + x) * 4 + ch]);
        }
        px[(y * w + x) * 4 + ch] = m;
      }
    }
  }
  sctx.putImageData(data, 0, 0);
  const big = canvas(page.width, page.height);
  const bctx = context(big);
  bctx.imageSmoothingEnabled = true;
  bctx.imageSmoothingQuality = "high";
  bctx.filter = `blur(${Math.max(2, Math.round(Math.min(page.width, page.height) / 80))}px)`;
  bctx.drawImage(small, 0, 0, page.width, page.height);
  return bctx.getImageData(0, 0, page.width, page.height).data;
}

/** The flattened page with one of the scan looks applied. */
export function applyFilter(page: HTMLCanvasElement, filter: ScanFilter): HTMLCanvasElement {
  if (filter === "original") return page;
  const w = page.width;
  const h = page.height;
  const out = canvas(w, h);
  const ctx = context(out);
  const image = context(page).getImageData(0, 0, w, h);
  const px = image.data;
  const bg = backgroundOf(page);

  for (let i = 0; i < px.length; i += 4) {
    // Divide out the light: paper goes to white, shadows and casts go with it.
    let r = Math.min(255, (px[i] * 255) / Math.max(24, bg[i]));
    let g = Math.min(255, (px[i + 1] * 255) / Math.max(24, bg[i + 1]));
    let b = Math.min(255, (px[i + 2] * 255) / Math.max(24, bg[i + 2]));
    if (filter === "enhanced") {
      // A gentle push on the darks so ink reads as ink, not as grey.
      r = r < 235 ? Math.max(0, r * 1.08 - 18) : r;
      g = g < 235 ? Math.max(0, g * 1.08 - 18) : g;
      b = b < 235 ? Math.max(0, b * 1.08 - 18) : b;
    } else {
      const lum = 0.299 * r + 0.587 * g + 0.114 * b;
      const v =
        filter === "gray"
          ? Math.max(0, Math.min(255, (lum - 30) * 1.15))
          : // Steep but not a hard cut: a hard threshold makes thin strokes ragged.
            Math.max(0, Math.min(255, ((lum - 150) * 255) / 75));
      r = g = b = v;
    }
    px[i] = r;
    px[i + 1] = g;
    px[i + 2] = b;
    px[i + 3] = 255;
  }
  ctx.putImageData(image, 0, 0);
  return out;
}

/** A quarter turn clockwise. */
export function rotate(page: HTMLCanvasElement): HTMLCanvasElement {
  const out = canvas(page.height, page.width);
  const ctx = context(out);
  ctx.translate(out.width, 0);
  ctx.rotate(Math.PI / 2);
  ctx.drawImage(page, 0, 0);
  return out;
}
