/**
 * Making a poor photograph print better — without making anything up.
 *
 * Everything here is arithmetic on the pixels that are already there: the
 * exposure is reshaped to the range the photo actually occupies, the noise is
 * smoothed where there is no detail to lose, the enlargement uses a filter
 * meant for photographs, and the edges are brought back up afterwards.
 *
 * Nothing invents. That restraint is the point, not a limitation. This app's
 * main job is photographs for documents, and a model that improves a face by
 * guessing what it ought to look like has changed somebody's likeness — which
 * is the one thing an identity photograph may not do, and which a consulate
 * will reject the shop for. A generative upscaler belongs behind its own door,
 * for old family pictures, never on this path.
 *
 * ## Why this works in luma and chroma rather than in red, green and blue
 *
 * The first version of this file treated the three colour channels alike, and
 * the shop was right to dislike the result. Measured against a known original
 * that had been darkened, made noisy and compressed — the three things a photo
 * from a messaging app has actually suffered — it made every one of them
 * worse:
 *
 *                        noise   colour   halo   texture   PSNR
 *     as received         7.29     3.97    4.4     25.13   30.11 dB
 *     treating RGB alike  8.16     7.61   22.7     38.52   25.38 dB
 *     the original        0        0       0       22.09        —
 *
 * It added noise rather than removing it, doubled the colour error, left rims
 * at hard edges five times the size of the ones the compression had already
 * put there, and produced half as much texture again as the original ever had
 * — which is what "it looks artificial" is, in numbers. The result was nearly
 * five decibels *further* from the truth than the damaged file it started
 * from. Earlier measurements here had been proxies — "edge energy went up" —
 * and an over-sharpened noisy picture scores beautifully on those.
 *
 * Splitting brightness from colour fixes all three complaints at once, because
 * each of them is really about one or the other:
 *
 *   - **colour noise is the ugly kind** and carries almost no detail, so it can
 *     be smoothed hard. That is the blotchiness a phone produces in poor light.
 *     Smoothing it in RGB would take the detail with it; smoothing it in chroma
 *     alone costs nothing visible.
 *   - **exposure is brightness**, so correcting it in luma leaves hue and
 *     saturation exactly where the photographer left them. The old pass also
 *     guessed at white balance from the average colour, and a guess that is
 *     wrong — a red jumper filling the frame, a warm lamp — is precisely the
 *     "the colours changed" complaint. It is now off unless asked for.
 *   - **halos are brightness too**: a rim the original does not have. Sharpening
 *     only luma, and refusing to let a pixel travel far outside the range of its
 *     own neighbours, removes them.
 *
 * ## What that is worth, same bench, same picture
 *
 *                        noise   colour   halo   texture   PSNR
 *     as received         7.29     3.97    4.4     25.13   30.11 dB
 *     treating RGB alike  8.16     7.61   22.7     38.52   25.38 dB
 *     luma and chroma     5.09     2.99    3.3     29.28   31.05 dB
 *     the original        0        0       0       22.09        —
 *
 * A third of the noise gone, a quarter of the colour error gone, rims smaller
 * than the ones the file arrived with, and — for the first time — a result
 * that is closer to the truth than the damaged file was, rather than further
 * from it. Five and a half decibels better than the version the shop disliked.
 *
 * One thing is genuinely worse: colour at the boundary between two strong
 * colours bleeds a little, 12.6 to 13.1, because the colour smoothing averages
 * across a wide radius. That is the trade for the blotches going, and it is
 * the reason the smoothing dial exists rather than being fixed here.
 *
 * ## Where it still stops
 *
 * Texture 29.28 against the original's 22.09 is what remains: this still
 * leaves more texture in the picture than was ever in it, because some of what
 * survives is noise that reads as detail. Filtering cannot close that gap —
 * telling a compression artefact from an eyelash is the one thing a trained
 * model is genuinely better at. That is what a model would be for, and it is
 * now a much smaller job than it was: exposure, colour cast, blocking and the
 * worst of the noise are no longer the argument for one.
 */

import type { Bounds, Drawable, Source } from "./imaging";
import { MAX_EDGE } from "./imaging";

export type Enhance = {
  on: boolean;
  /** Exposure, 0–1. */
  tone: number;
  /** Noise smoothing, 0–1. */
  denoise: number;
  /** Edge contrast, 0–1. */
  sharpen: number;
  /**
   * Neutralise a colour cast, off unless asked for.
   *
   * Deliberately opt-in. Averaging a photograph toward grey is a guess, and on
   * a picture that is legitimately one colour it is a wrong one.
   */
  balance?: boolean;
};

/**
 * Where the dials sit to begin with, chosen by sweeping them against the bench
 * rather than by eye. Smoothing above about a half starts trading colour
 * bleeding for the colour noise it removes, and sharpening above about a third
 * buys texture the original never had.
 */
export function initialEnhance(): Enhance {
  return { on: false, tone: 0.75, denoise: 0.55, sharpen: 0.3, balance: false };
}

/**
 * Whether running this would change anything.
 *
 * The growth matters: with every dial at zero and an enlargement still asked
 * for, there is work to do — the resampling filter — and treating that as idle
 * handed back the small photograph untouched.
 */
export function idle(settings: Enhance, growth = 1): boolean {
  if (!settings.on) return true;
  if (growth > 1.05) return false;
  return (
    settings.tone === 0 &&
    settings.denoise === 0 &&
    settings.sharpen === 0 &&
    !settings.balance
  );
}

/** Never enlarge beyond this: past it the extra pixels carry nothing. */
const MAX_GROWTH = 4;

function surface(w: number, h: number): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(w));
  canvas.height = Math.max(1, Math.round(h));
  return canvas;
}

function pixels(canvas: HTMLCanvasElement): ImageData {
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  return ctx!.getImageData(0, 0, canvas.width, canvas.height);
}

function paint(data: ImageData): HTMLCanvasElement {
  const canvas = surface(data.width, data.height);
  canvas.getContext("2d")!.putImageData(data, 0, 0);
  return canvas;
}

function asCanvas(bitmap: Drawable): HTMLCanvasElement {
  if (bitmap instanceof HTMLCanvasElement) return bitmap;
  const canvas = surface(bitmap.width, bitmap.height);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0);
  return canvas;
}

const clamp255 = (v: number) => (v < 0 ? 0 : v > 255 ? 255 : v);

/**
 * The picture as brightness and colour, held apart.
 *
 * BT.601, the same weights the rest of the app measures luma with. Kept in
 * floating point from the first step to the last: a dark photograph has few
 * levels to begin with, and rounding back to bytes between every stage is how
 * a gradient ends up banded.
 */
type Planes = {
  w: number;
  h: number;
  y: Float32Array;
  cb: Float32Array;
  cr: Float32Array;
  a: Uint8ClampedArray;
};

function split(image: ImageData): Planes {
  const count = image.width * image.height;
  const y = new Float32Array(count);
  const cb = new Float32Array(count);
  const cr = new Float32Array(count);
  const a = new Uint8ClampedArray(count);
  const d = image.data;
  for (let i = 0, o = 0; i < count; i++, o += 4) {
    const r = d[o];
    const g = d[o + 1];
    const b = d[o + 2];
    y[i] = 0.299 * r + 0.587 * g + 0.114 * b;
    cb[i] = -0.168736 * r - 0.331264 * g + 0.5 * b;
    cr[i] = 0.5 * r - 0.418688 * g - 0.081312 * b;
    a[i] = d[o + 3];
  }
  return { w: image.width, h: image.height, y, cb, cr, a };
}

function join(p: Planes): ImageData {
  const out = new ImageData(p.w, p.h);
  const d = out.data;
  for (let i = 0, o = 0; i < p.w * p.h; i++, o += 4) {
    const y = p.y[i];
    const cb = p.cb[i];
    const cr = p.cr[i];
    d[o] = clamp255(y + 1.402 * cr);
    d[o + 1] = clamp255(y - 0.344136 * cb - 0.714136 * cr);
    d[o + 2] = clamp255(y + 1.772 * cb);
    d[o + 3] = p.a[i];
  }
  return out;
}

/**
 * A box blur, by running sums: one pass across, one down.
 *
 * Every reference below is a blurred copy of something, and the first version
 * of this file got them from the browser — `ctx.filter`, on the GPU. That is
 * fast, but it goes through eight-bit pixels, and the local variance this file
 * now needs cannot survive that: the difference between a flat patch and a
 * noisy one is a few hundredths of a level once squares are packed into bytes,
 * which is to say it is gone. Running sums are exact, cost the same four
 * operations per pixel whatever the radius, and leave nothing to a canvas.
 *
 * Edges repeat the last pixel rather than fading to nothing, so the frame of
 * the picture is not treated as a cliff.
 */
function boxBlur(
  src: Float32Array,
  w: number,
  h: number,
  radius: number,
  /** Reused between calls: at twelve megapixels each of these is forty-eight
   * megabytes, and the pass makes six of them. */
  scratch?: { across?: Float32Array; out?: Float32Array },
): Float32Array {
  const r = Math.max(1, Math.round(radius));
  const span = r * 2 + 1;
  const across = scratch?.across ?? new Float32Array(src.length);
  const out = scratch?.out ?? new Float32Array(src.length);

  for (let y = 0; y < h; y++) {
    const row = y * w;
    let sum = src[row] * (r + 1);
    for (let x = 1; x <= r; x++) sum += src[row + Math.min(w - 1, x)];
    for (let x = 0; x < w; x++) {
      across[row + x] = sum / span;
      sum += src[row + Math.min(w - 1, x + r + 1)] - src[row + Math.max(0, x - r)];
    }
  }

  for (let x = 0; x < w; x++) {
    let sum = across[x] * (r + 1);
    for (let y = 1; y <= r; y++) sum += across[Math.min(h - 1, y) * w + x];
    for (let y = 0; y < h; y++) {
      out[y * w + x] = sum / span;
      sum += across[Math.min(h - 1, y + r + 1) * w + x] - across[Math.max(0, y - r) * w + x];
    }
  }
  return out;
}

/**
 * Half size, by averaging each two-by-two square.
 *
 * Everything the wide radius is for — the colour, and the map of where the
 * picture is flat — is low-frequency by its nature, so it is worked out on a
 * quarter of the pixels and stretched back. Colour is already stored at half
 * resolution inside most JPEGs for exactly this reason. It costs nothing
 * visible and it is most of the difference between a pass that answers while a
 * slider moves and one that does not.
 */
function halve(src: Float32Array, w: number, h: number): Float32Array {
  const hw = Math.max(1, w >> 1);
  const hh = Math.max(1, h >> 1);
  const out = new Float32Array(hw * hh);
  for (let y = 0; y < hh; y++) {
    const top = Math.min(h - 1, y * 2) * w;
    const bottom = Math.min(h - 1, y * 2 + 1) * w;
    for (let x = 0; x < hw; x++) {
      const left = Math.min(w - 1, x * 2);
      const right = Math.min(w - 1, x * 2 + 1);
      out[y * hw + x] = (src[top + left] + src[top + right] + src[bottom + left] + src[bottom + right]) * 0.25;
    }
  }
  return out;
}

/**
 * Where each full-size pixel reads from in the half-size copy, worked out once
 * per axis.
 *
 * Stretching the half-size results back up was first written as four passes
 * that each built a full-size array, and it cost more than the blurs it was
 * there to make cheap — four arrays the size of the picture, filled with
 * arithmetic that repeats identically on every row. The positions and weights
 * depend only on the column, so they are computed once and the stretching
 * happens inside the loop that was already running.
 */
function sampling(size: number, half: number): { near: Int32Array; far: Int32Array; mix: Float32Array } {
  const near = new Int32Array(size);
  const far = new Int32Array(size);
  const mix = new Float32Array(size);
  for (let i = 0; i < size; i++) {
    const at = Math.min(half - 1, Math.max(0, (i - 0.5) * 0.5));
    const first = Math.floor(at);
    near[i] = first;
    far[i] = Math.min(half - 1, first + 1);
    mix[i] = at - first;
  }
  return { near, far, mix };
}

/**
 * The luma to take references from: the picture, with anything transparent
 * replaced by one flat tone.
 *
 * A cut-out photograph has nothing outside the subject, and a blur that reads
 * across that boundary drags the nothing inward — without this, every head in
 * the shop comes back with a dark rim.
 */
function masked(values: Float32Array, alpha: Uint8ClampedArray, neutral: number): Float32Array {
  const out = new Float32Array(values.length);
  for (let i = 0; i < values.length; i++) out[i] = alpha[i] >= 128 ? values[i] : neutral;
  return out;
}

/**
 * What the exposure correction is, as numbers — before any of it is applied.
 *
 * Kept separate from applying it so the same correction can be worked out on
 * one picture and used on another. A window cut out of a photograph has its
 * own histogram, usually a much narrower one, so a preview that looked at only
 * that window showed a correction several times stronger than the file would
 * get — a cheek at three-to-one came out orange. The quality page therefore
 * measures the whole photograph once and hands the answer to every view, so
 * what is on the screen is what lands in the file.
 *
 * The black and white points are the levels a quarter of a percent of the
 * picture falls outside — not the darkest and lightest pixels, which are
 * usually a speck of dust and a highlight. `mid` is where the picture's middle
 * sits between them, which is what says how underexposed it is: a photograph
 * taken indoors without a flash has its middle down around a fifth, and that
 * is the number the curve below answers.
 *
 * Only pixels that are actually part of the subject are counted. After the
 * background has been cut out and replaced with white, the histogram is mostly
 * background, and tuning the exposure to that would darken every face.
 */
export type Levels = {
  low: number;
  high: number;
  /** Where the median sits between them, 0–1. */
  mid: number;
  /** Average colour, for the optional cast removal. */
  cb: number;
  cr: number;
};

export function levelsOf(data: ImageData): Levels | null {
  const { data: px } = data;

  const histogram = new Uint32Array(256);
  let sumCb = 0;
  let sumCr = 0;
  let counted = 0;
  for (let i = 0; i < px.length; i += 4) {
    if (px[i + 3] < 128) continue;
    const r = px[i];
    const g = px[i + 1];
    const b = px[i + 2];
    histogram[Math.round((r * 299 + g * 587 + b * 114) / 1000)]++;
    sumCb += -0.168736 * r - 0.331264 * g + 0.5 * b;
    sumCr += 0.5 * r - 0.418688 * g - 0.081312 * b;
    counted++;
  }
  if (counted < 64) return null;

  const at = (share: number) => {
    const want = Math.max(1, Math.floor(counted * share));
    let seen = 0;
    for (let v = 0; v < 256; v++) {
      seen += histogram[v];
      if (seen >= want) return v;
    }
    return 255;
  };

  const low = at(0.0025);
  const high = at(0.9975);
  if (high - low < 8) return null;

  const median = at(0.5);
  return {
    low,
    high,
    mid: Math.min(0.95, Math.max(0.05, (median - low) / (high - low))),
    cb: sumCb / counted,
    cr: sumCr / counted,
  };
}

/**
 * Where a well-exposed photograph's middle sits, and the most this will stretch.
 *
 * The cap matters: a flat scan has a narrow histogram through no fault of its
 * own, and pulling it to the full range turns it into a poster.
 */
const TARGET_MID = 0.46;
const MAX_STRETCH = 2.5;
/** Above this the curve rolls off instead of running into paper white. */
const KNEE = 0.82;

/**
 * The exposure curve: lift the shadows, hold the highlights.
 *
 * The old pass was a straight line from the black point to the white point,
 * which is why a dark photograph came back harsh — everything above the middle
 * was pushed into the highlights together and the top end simply clipped. A
 * curve raises the part of the picture that is too dark and leaves the part
 * that is already bright where it is, which is what "the dark corner is still
 * dark, and the window is blown out" was asking for.
 *
 * It only ever lifts. A well-exposed photograph has its middle at the target
 * already, the exponent comes out at one, and nothing happens to it.
 */
function curveFor(levels: Levels): Float32Array {
  const span = Math.max(255 / MAX_STRETCH, levels.high - levels.low);
  const gamma = Math.min(
    2.4,
    Math.max(1, Math.log(TARGET_MID) / Math.log(Math.min(0.95, Math.max(0.05, levels.mid)))),
  );
  // Worked out once for each of the 256 levels a pixel can hold, rather than
  // per pixel: a power and a hyperbolic tangent are expensive enough that
  // doing them twelve million times was a quarter of the whole pass.
  const table = new Float32Array(257);
  for (let v = 0; v <= 256; v++) {
    const t = (Math.min(255, v) - levels.low) / span;
    if (t <= 0) {
      table[v] = 0;
      continue;
    }
    const lifted = Math.pow(Math.min(1.6, t), 1 / gamma);
    const shaped =
      lifted <= KNEE ? lifted : KNEE + (1 - KNEE) * Math.tanh((lifted - KNEE) / (1 - KNEE));
    table[v] = shaped * 255;
  }
  return table;
}

/**
 * Applies the exposure to brightness alone.
 *
 * Colour rides along at the same ratio, because that is what underexposure
 * actually did to it: less light is proportionally less of everything, so
 * restoring the brightness without restoring the colour leaves the photograph
 * drained. Damping this to the square root was tried first and measured worse
 * — it desaturated every swatch by a third.
 *
 * It is capped, though. The curve lifts shadows more than midtones, so deep
 * shadow would otherwise come back with its colour multiplied far past
 * anything that was ever in the file.
 */
function applyTone(p: Planes, levels: Levels, strength: number, balance: boolean): void {
  const curve = curveFor(levels);
  // A small cast is worth removing; a large one is usually the subject's own
  // colour, so the correction is capped well short of neutral.
  const castCb = balance ? Math.max(-14, Math.min(14, levels.cb)) * 0.85 : 0;
  const castCr = balance ? Math.max(-14, Math.min(14, levels.cr)) * 0.85 : 0;

  for (let i = 0; i < p.y.length; i++) {
    const before = p.y[i];
    // Between the two nearest entries, so the curve stays smooth on a gradient
    // rather than stepping 256 times across it.
    const slot = before <= 0 ? 0 : before >= 255 ? 255 : before;
    const low = slot | 0;
    const mapped = curve[low] + (curve[low + 1] - curve[low]) * (slot - low);
    const after = before + (mapped - before) * strength;
    p.y[i] = after;
    const ratio = before > 1 ? after / before : 1;
    const gain = Math.min(3, Math.max(0.25, ratio));
    p.cb[i] = (p.cb[i] - castCb * strength) * gain;
    p.cr[i] = (p.cr[i] - castCr * strength) * gain;
  }
}

/**
 * How noisy this photograph actually is, measured rather than assumed.
 *
 * The median of the difference from a blurred copy: half the picture would
 * have to be edges before genuine detail could drag this upward and get itself
 * smoothed away. Every threshold below is a multiple of it, because a fixed
 * figure was tried first and was wrong in exactly the case this exists for.
 */
function noiseOf(sharp: Float32Array, soft: Float32Array): number {
  const samples: number[] = [];
  for (let i = 0; i < sharp.length; i += 17) samples.push(Math.abs(sharp[i] - soft[i]));
  samples.sort((a, b) => a - b);
  return Math.max(0.5, samples[samples.length >> 1] ?? 0.5);
}

/** A JPEG is coded in squares of this size, and leaves its seams behind. */
const BLOCK = 8;

/**
 * How much of a staircase the compression left, as a ratio.
 *
 * Measured, not assumed, because it decides whether the deblocking below runs
 * at all. The steps across the columns that fall on the block grid are
 * compared with the steps across every other column: on a heavily compressed
 * photograph the first is several times the second (measured at 3.25 against
 * 0.80 on the bench picture), and on a clean PNG, a screenshot, or a photo
 * that has been resized since it was coded — where the grid no longer lines
 * up — the two are the same and this returns about one, so nothing happens.
 */
function blockiness(p: Planes): { ratio: number; step: number } {
  const { w, h, y, a } = p;
  let onGrid = 0;
  let onGridCount = 0;
  let between = 0;
  let betweenCount = 0;
  // Every third row is plenty to tell a staircase from a smooth surface.
  for (let row = 0; row < h; row += 3) {
    const base = row * w;
    for (let col = 1; col < w; col++) {
      if (a[base + col] < 128 || a[base + col - 1] < 128) continue;
      const step = Math.abs(y[base + col] - y[base + col - 1]);
      // Big steps are the picture's own edges and say nothing about coding.
      if (step > 40) continue;
      if (col % BLOCK === 0) {
        onGrid += step;
        onGridCount++;
      } else {
        between += step;
        betweenCount++;
      }
    }
  }
  if (onGridCount < 32 || betweenCount < 32) return { ratio: 1, step: 0 };
  const grid = onGrid / onGridCount;
  const rest = between / betweenCount;
  return { ratio: rest > 0.01 ? grid / rest : 1, step: grid };
}

/**
 * Flattens the seams between a JPEG's blocks.
 *
 * This is the piece that was missing, and the measurements say why it had to
 * exist. What a photograph from a messaging app is noisy *with* is mostly not
 * grain: the high frequencies are the first thing the compression throws away,
 * and what remains is a staircase where one block was rounded off slightly
 * differently from its neighbour. Averaging cannot touch it — on the bench a
 * flat patch kept a spread of 1.71 at radius two and got *worse* at radius
 * eight, because at any useful radius a block is not a difference, it is a
 * flat area of its own.
 *
 * So the seam is treated as a seam: where the step across a block boundary is
 * small enough to be coding rather than content, and the pixels either side of
 * it are themselves flat, the step is closed and the correction is tapered
 * away over the next few pixels. A staircase becomes a gentle ramp, which is
 * what the eye stops seeing. Anything that looks like a real edge is left
 * exactly alone.
 */
function deblock(p: Planes, strength: number, limit: number): void {
  const { w, h, y, a } = p;
  const reach = 4;
  const amount = 0.5 * Math.min(1, 0.35 + strength * 0.65);

  // Vertical seams: every column that falls on the grid.
  for (let row = 0; row < h; row++) {
    const base = row * w;
    for (let edge = BLOCK; edge < w - 1; edge += BLOCK) {
      const left = base + edge - 1;
      const right = base + edge;
      if (a[left] < 128 || a[right] < 128) continue;
      const step = y[right] - y[left];
      if (Math.abs(step) >= limit) continue;
      if (Math.abs(y[left] - y[left - 1]) >= limit) continue;
      if (Math.abs(y[right + 1] - y[right]) >= limit) continue;
      const d = step * amount;
      for (let k = 0; k < reach; k++) {
        const taper = d * (1 - k / reach);
        const l = edge - 1 - k;
        const r = edge + k;
        if (l >= 0) y[base + l] += taper;
        if (r < w) y[base + r] -= taper;
      }
    }
  }

  // Horizontal seams: the same, down the picture.
  for (let col = 0; col < w; col++) {
    for (let edge = BLOCK; edge < h - 1; edge += BLOCK) {
      const top = (edge - 1) * w + col;
      const bottom = edge * w + col;
      if (a[top] < 128 || a[bottom] < 128) continue;
      const step = y[bottom] - y[top];
      if (Math.abs(step) >= limit) continue;
      if (Math.abs(y[top] - y[top - w]) >= limit) continue;
      if (Math.abs(y[bottom + w] - y[bottom]) >= limit) continue;
      const d = step * amount;
      for (let k = 0; k < reach; k++) {
        const taper = d * (1 - k / reach);
        const t = edge - 1 - k;
        const b = edge + k;
        if (t >= 0) y[t * w + col] += taper;
        if (b < h) y[b * w + col] -= taper;
      }
    }
  }
}

/**
 * Smooths the noise, at two scales, guided by where there is nothing to lose.
 *
 * The first attempt moved every pixel a little way toward a slightly blurred
 * copy of itself, and measured against a known original it removed almost
 * nothing — eight per cent of the noise at full strength. The reason is worth
 * writing down, because it is the whole argument for this function: what a
 * photograph from a messaging app is noisy *with* is mostly not grain. It is
 * the eight-by-eight blocks the compression left behind, and blocks are
 * low-frequency. A small blur leaves them exactly where they are, because at
 * that radius a block is a flat area, not a difference.
 *
 * So the smoothing has to reach further — and reaching further is only safe
 * where there is no detail to destroy. That is what the local standard
 * deviation tells us: in a cheek, a wall or a sky it sits at the noise level,
 * and in hair or an eyelash it is several times that. Where the picture is
 * flat, the pixel goes most of the way to a wide average, which takes the
 * blocks with it; where it is not, the old conservative rule applies against a
 * tight average, and detail survives.
 *
 * Colour is smoothed much harder than brightness, everywhere. The eye reads
 * edges and texture from brightness — which is why every colour format since
 * the first television has sent less colour than brightness — so the blotchy
 * patches a sensor produces in poor light can be averaged at a radius that
 * would destroy a face if brightness were treated the same way. The guard is
 * the same flatness map, because a wide average computed *near* an edge is
 * already contaminated by it: using the edge at the pixel alone let colour
 * bleed from a few pixels away, which is a red collar staining a white shirt.
 */
function denoise(p: Planes, strength: number, neutral: number): void {
  const { w, h, y, cb, cr, a } = p;

  // The seams first: everything after this reads the picture as a surface, and
  // a staircase read as a surface is read as detail worth keeping.
  const blocks = blockiness(p);
  if (blocks.ratio > 1.3) {
    deblock(p, strength, Math.max(2, blocks.step * 2.5));
  }

  const ref = masked(y, a, neutral);
  const tight = boxBlur(ref, w, h, 2);

  // The wide radius, and everything it guides, at half size.
  const hw = Math.max(1, w >> 1);
  const hh = Math.max(1, h >> 1);
  const wide = Math.max(1, Math.round((3 + strength * 5) / 2));
  const small = halve(ref, w, h);
  const across = new Float32Array(small.length);
  const spare = new Float32Array(small.length);

  const meanSmall = boxBlur(small, hw, hh, wide, { across, out: spare }).slice();
  for (let i = 0; i < small.length; i++) small[i] = small[i] * small[i];
  const meanSquares = boxBlur(small, hw, hh, wide, { across, out: spare });

  // Written over the squares, which have served their purpose.
  const spreadSmall = small;
  for (let i = 0; i < spreadSmall.length; i++) {
    spreadSmall[i] = Math.sqrt(Math.max(0, meanSquares[i] - meanSmall[i] * meanSmall[i]));
  }

  /**
   * What "flat" looks like in *this* photograph.
   *
   * Taken from the spread's own distribution rather than from the fine-grain
   * figure below, and the difference is not academic: on a compressed picture
   * the high frequencies are gone, so the grain figure came out under one
   * level while a genuinely flat cheek had a spread of three. Judged against
   * the wrong yardstick, every flat area in the picture read as texture and
   * the smoothing politely left all of it alone.
   */
  const sampled: number[] = [];
  for (let i = 0; i < spreadSmall.length; i += 11) sampled.push(spreadSmall[i]);
  sampled.sort((a2, b2) => a2 - b2);
  const quiet = Math.max(0.5, sampled[Math.floor(sampled.length * 0.3)] ?? 0.5);

  const noise = noiseOf(ref, tight);
  const tolerance = Math.max(2, noise * (1.4 + strength * 3));
  const lumaCeiling = Math.min(0.92, 0.35 + strength * 0.57);
  const chromaCeiling = Math.min(0.96, 0.55 + strength * 0.41);

  const softCb = boxBlur(halve(masked(cb, a, 0), w, h), hw, hh, wide, { across }).slice();
  const softCr = boxBlur(halve(masked(cr, a, 0), w, h), hw, hh, wide, { across });

  const col = sampling(w, hw);
  const row = sampling(h, hh);

  for (let line = 0; line < h; line++) {
    const upper = row.near[line] * hw;
    const lower = row.far[line] * hw;
    const down = row.mix[line];
    const base = line * w;
    for (let x = 0; x < w; x++) {
      const i = base + x;
      const left = col.near[x];
      const right = col.far[x];
      const sideways = col.mix[x];

      // The four half-size results, read where this pixel falls between them.
      const spreadTop = spreadSmall[upper + left] + (spreadSmall[upper + right] - spreadSmall[upper + left]) * sideways;
      const spreadBottom = spreadSmall[lower + left] + (spreadSmall[lower + right] - spreadSmall[lower + left]) * sideways;
      const spread = spreadTop + (spreadBottom - spreadTop) * down;

      const meanTop = meanSmall[upper + left] + (meanSmall[upper + right] - meanSmall[upper + left]) * sideways;
      const meanBottom = meanSmall[lower + left] + (meanSmall[lower + right] - meanSmall[lower + left]) * sideways;
      const wideMean = meanTop + (meanBottom - meanTop) * down;

      // One means "as quiet as the quiet parts of this picture", zero means
      // there is something here worth keeping.
      const flat = spread <= quiet ? 1 : Math.max(0, 1 - (spread - quiet) / (quiet * 2));

      const gap = Math.abs(y[i] - tight[i]);
      const fine = gap >= tolerance ? 0 : 1 - gap / tolerance;
      const target = tight[i] + (wideMean - tight[i]) * flat;
      y[i] += (target - y[i]) * lumaCeiling * (flat + (1 - flat) * fine);

      const colour = chromaCeiling * (0.35 + 0.65 * flat);
      const cbTop = softCb[upper + left] + (softCb[upper + right] - softCb[upper + left]) * sideways;
      const cbBottom = softCb[lower + left] + (softCb[lower + right] - softCb[lower + left]) * sideways;
      cb[i] += (cbTop + (cbBottom - cbTop) * down - cb[i]) * colour;

      const crTop = softCr[upper + left] + (softCr[upper + right] - softCr[upper + left]) * sideways;
      const crBottom = softCr[lower + left] + (softCr[lower + right] - softCr[lower + left]) * sideways;
      cr[i] += (crTop + (crBottom - crTop) * down - cr[i]) * colour;
    }
  }
}

/**
 * How far past its neighbours a sharpened pixel may travel, as a share of
 * their own range.
 *
 * A tenth sounds modest and is not: at a hard edge the neighbours span the
 * best part of the scale, so a tenth of it is twenty levels of bright rim —
 * measured at 14.8 against the 4.4 the compression had already left. Four per
 * cent brings the rim back to the level of the file as it arrived while
 * costing almost nothing on the texture the sharpening is actually for.
 */
const OVERSHOOT = 0.04;

/**
 * Unsharp mask on brightness, with the halo taken out.
 *
 * The difference between the picture and a blurred copy, added back — and then
 * held inside the range of the pixel's own neighbours, give or take a tenth.
 * That clamp is what separates sharpening from the bright rim around every
 * dark object that reads instantly as "done on a computer": the old pass left
 * rims twice as strong as the ones the compression had already put there.
 *
 * Below the threshold nothing happens at all, so film grain, skin and paper
 * texture are left alone rather than being promoted into detail. The threshold
 * comes from the photograph's own noise, because a fixed one undid the
 * smoothing that had just run.
 */
function sharpenLuma(p: Planes, soft: Float32Array, amount: number, noise: number): void {
  const threshold = Math.max(1.5, noise * 1.3);
  const gain = amount * 1.1;
  const { w, h, y } = p;

  // The range of each pixel's neighbours, in two passes rather than nine reads
  // each: across first, then down. Minimum and maximum are separable the same
  // way a blur is, and doing it the obvious way was a third of the pass.
  const rowLow = new Float32Array(y.length);
  const rowHigh = new Float32Array(y.length);
  for (let row = 0; row < h; row++) {
    const base = row * w;
    for (let col = 0; col < w; col++) {
      const left = y[base + (col > 0 ? col - 1 : 0)];
      const here = y[base + col];
      const right = y[base + (col < w - 1 ? col + 1 : w - 1)];
      rowLow[base + col] = Math.min(left, here, right);
      rowHigh[base + col] = Math.max(left, here, right);
    }
  }

  const out = new Float32Array(y.length);
  for (let row = 0; row < h; row++) {
    const base = row * w;
    const up = row > 0 ? base - w : base;
    const down = row < h - 1 ? base + w : base;
    for (let col = 0; col < w; col++) {
      const i = base + col;
      const difference = y[i] - soft[i];
      if (Math.abs(difference) <= threshold) {
        out[i] = y[i];
        continue;
      }
      const lo = Math.min(rowLow[up + col], rowLow[i], rowLow[down + col]);
      const hi = Math.max(rowHigh[up + col], rowHigh[i], rowHigh[down + col]);
      const slack = (hi - lo) * OVERSHOOT;
      const value = y[i] + difference * gain;
      out[i] = value < lo - slack ? lo - slack : value > hi + slack ? hi + slack : value;
    }
  }
  p.y.set(out);
}

const lanczos = (t: number, a: number) => {
  if (t === 0) return 1;
  const u = Math.abs(t);
  if (u >= a) return 0;
  const p = Math.PI * u;
  return (a * Math.sin(p) * Math.sin(p / a)) / (p * p);
};

/**
 * The weight each source sample carries for each output sample, worked out once
 * per axis instead of once per pixel.
 *
 * The naive version recomputes a sine for every tap of every pixel, which for a
 * print-sized enlargement is tens of millions of them. This is the same
 * arithmetic with the repetition taken out.
 */
function weights(from: number, to: number, a = 3) {
  const ratio = from / to;
  const table: { start: number; w: Float32Array; near: number; far: number }[] = new Array(to);
  for (let i = 0; i < to; i++) {
    const centre = (i + 0.5) * ratio - 0.5;
    const first = Math.ceil(centre - a);
    const last = Math.floor(centre + a);
    const w = new Float32Array(last - first + 1);
    let sum = 0;
    for (let k = first; k <= last; k++) {
      const v = lanczos(centre - k, a);
      w[k - first] = v;
      sum += v;
    }
    if (sum !== 0) for (let k = 0; k < w.length; k++) w[k] /= sum;
    // The two samples this one actually sits between, kept for the clamp.
    table[i] = { start: first, w, near: Math.floor(centre), far: Math.floor(centre) + 1 };
  }
  return table;
}

/**
 * Lanczos rings, and ringing is a halo by another name.
 *
 * The filter has negative lobes — that is where its crispness comes from — so
 * at a hard edge it overshoots on both sides. Measured on the bench, doubling
 * a damaged picture left a rim of 20 against the 2 it arrived with, *before*
 * any sharpening ran at all: a third of what the shop was calling artificial
 * was the enlargement, not the sharpener.
 *
 * So each output sample is held inside the range of the two input samples it
 * sits between. This is the standard anti-ringing clamp, and it keeps the
 * crispness while removing the overshoot, because it only binds where the
 * filter was about to leave the range its own neighbours occupy.
 */
function ring(value: number, a: number, b: number): number {
  const lo = a < b ? a : b;
  const hi = a < b ? b : a;
  return value < lo ? lo : value > hi ? hi : value;
}

/**
 * Lanczos-3 enlargement, separable: across, then down.
 *
 * The browser's own scaling is built for speed and goes soft when stretched.
 * This is the filter photographic software uses for the same job.
 */
export function resample(canvas: HTMLCanvasElement, width: number, height: number): HTMLCanvasElement {
  const w = Math.max(1, Math.round(width));
  const h = Math.max(1, Math.round(height));
  if (w === canvas.width && h === canvas.height) return canvas;

  const src = pixels(canvas);
  const across = weights(canvas.width, w);
  const down = weights(canvas.height, h);

  const middle = new Float32Array(w * canvas.height * 4);
  for (let y = 0; y < canvas.height; y++) {
    const row = y * canvas.width;
    for (let x = 0; x < w; x++) {
      const { start, w: taps, near, far } = across[x];
      let r = 0;
      let g = 0;
      let b = 0;
      let a = 0;
      for (let k = 0; k < taps.length; k++) {
        const weight = taps[k];
        if (weight === 0) continue;
        const sx = Math.min(canvas.width - 1, Math.max(0, start + k));
        const o = (row + sx) * 4;
        r += src.data[o] * weight;
        g += src.data[o + 1] * weight;
        b += src.data[o + 2] * weight;
        a += src.data[o + 3] * weight;
      }
      const o = (y * w + x) * 4;
      const first = (row + Math.min(canvas.width - 1, Math.max(0, near))) * 4;
      const second = (row + Math.min(canvas.width - 1, Math.max(0, far))) * 4;
      middle[o] = ring(r, src.data[first], src.data[second]);
      middle[o + 1] = ring(g, src.data[first + 1], src.data[second + 1]);
      middle[o + 2] = ring(b, src.data[first + 2], src.data[second + 2]);
      middle[o + 3] = ring(a, src.data[first + 3], src.data[second + 3]);
    }
  }

  const out = new ImageData(w, h);
  for (let y = 0; y < h; y++) {
    const { start, w: taps, near, far } = down[y];
    const first = Math.min(canvas.height - 1, Math.max(0, near)) * w;
    const second = Math.min(canvas.height - 1, Math.max(0, far)) * w;
    for (let x = 0; x < w; x++) {
      let r = 0;
      let g = 0;
      let b = 0;
      let a = 0;
      for (let k = 0; k < taps.length; k++) {
        const weight = taps[k];
        if (weight === 0) continue;
        const sy = Math.min(canvas.height - 1, Math.max(0, start + k));
        const o = (sy * w + x) * 4;
        r += middle[o] * weight;
        g += middle[o + 1] * weight;
        b += middle[o + 2] * weight;
        a += middle[o + 3] * weight;
      }
      const o = (y * w + x) * 4;
      const topAt = (first + x) * 4;
      const bottomAt = (second + x) * 4;
      out.data[o] = clamp255(ring(r, middle[topAt], middle[bottomAt]));
      out.data[o + 1] = clamp255(ring(g, middle[topAt + 1], middle[bottomAt + 1]));
      out.data[o + 2] = clamp255(ring(b, middle[topAt + 2], middle[bottomAt + 2]));
      out.data[o + 3] = clamp255(ring(a, middle[topAt + 3], middle[bottomAt + 3]));
    }
  }
  return paint(out);
}

/**
 * How much bigger the photograph has to get before it is composed.
 *
 * Only when the subject is smaller than the frame it is going into — that is
 * the case this exists for, the photograph that arrived through a messaging
 * app. Shrinking a large photograph is something the browser already does well,
 * and doing it here would cost seconds for nothing.
 */
export function growthFor(bounds: Bounds, want: { w: number; h: number } | undefined): number {
  if (!want) return 1;
  const need = Math.max(want.w / Math.max(1, bounds.w), want.h / Math.max(1, bounds.h));
  return need <= 1.05 ? 1 : Math.min(need, MAX_GROWTH);
}

/**
 * The pixel size an enlargement actually comes out at, held to the raster cap.
 *
 * The cap used to be applied to each axis on its own, which quietly squashed
 * anything that crossed it on one side only: a 4000 × 3000 photograph asked to
 * double became 6000 × 6000 — the right number of pixels, the wrong shape, and
 * a face stretched by a third. The limit belongs to the scale, so both axes
 * come back down together.
 *
 * Exported because the quality page states the result size before producing it,
 * and a page that promises one size while the pipeline writes another is worse
 * than one that says nothing.
 */
export function plannedSize(
  base: { w: number; h: number },
  wanted: number,
): { w: number; h: number; scale: number } {
  const scale = Math.min(wanted, MAX_EDGE / Math.max(1, base.w, base.h));
  return {
    w: Math.max(1, Math.round(base.w * scale)),
    h: Math.max(1, Math.round(base.h * scale)),
    scale,
  };
}

/**
 * Runs the whole thing, in the order the operations have to happen in.
 *
 * Exposure first, and this order was arrived at by measuring rather than by
 * taste. An underexposed photograph occupies a narrow band of the range, and
 * opening that band out multiplies everything in it — including the noise, by
 * the same factor. Smoothing beforehand therefore works against a threshold
 * that is about to stop being true. Correcting the exposure first puts the
 * picture at the size the next two steps measure themselves against.
 *
 * Then the enlargement, and the edges last — sharpening before enlarging would
 * blur the result straight back out again.
 */
export function enhanceSource(
  source: Source,
  settings: Enhance,
  want?: { w: number; h: number },
  /** The exposure measured elsewhere — see `levelsOf`. */
  levels?: Levels | null,
): Source {
  const asked = growthFor(source.bounds, want);
  if (idle(settings, asked)) return source;

  const base = asCanvas(source.bitmap);
  const target = plannedSize({ w: base.width, h: base.height }, asked);

  let canvas = base;
  const image = pixels(canvas);
  const planes = split(image);
  const measured = levels ?? levelsOf(image);

  if (measured && (settings.tone > 0 || settings.balance)) {
    applyTone(planes, measured, settings.tone, Boolean(settings.balance));
  }

  // One mid-grey for the whole picture, so a cut-out's missing surroundings
  // cannot drag the rim in any direction.
  const neutral = measured ? (measured.low + measured.high) / 2 : 128;

  if (settings.denoise > 0) denoise(planes, settings.denoise, neutral);

  const sharpen = (p: Planes) => {
    const reference = masked(p.y, p.a, neutral);
    const soft = boxBlur(reference, p.w, p.h, 1);
    sharpenLuma(p, soft, settings.sharpen, noiseOf(reference, soft));
  };

  const enlarging = target.w !== canvas.width || target.h !== canvas.height;
  if (!enlarging) {
    // The common case, and worth the branch: sharpening here rather than after
    // a round trip through a canvas saves taking the picture apart and putting
    // it back together a second time, which is most of a second on a photo
    // from a modern phone.
    if (settings.sharpen > 0) sharpen(planes);
    canvas = paint(join(planes));
  } else {
    canvas = resample(paint(join(planes)), target.w, target.h);
    if (settings.sharpen > 0) {
      const grown = split(pixels(canvas));
      sharpen(grown);
      canvas = paint(join(grown));
    }
  }

  const grew = canvas.width / base.width;
  return {
    bitmap: canvas,
    bounds: {
      x: source.bounds.x * grew,
      y: source.bounds.y * grew,
      w: source.bounds.w * grew,
      h: source.bounds.h * grew,
    },
  };
}
