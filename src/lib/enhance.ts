/**
 * Making a poor photograph print better — without making anything up.
 *
 * Everything here is arithmetic on the pixels that are already there: the
 * exposure is stretched to the range the photo actually occupies, the noise is
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
 * What it is worth, measured by enlarging a known picture threefold and
 * comparing against the original that was still on hand:
 *
 *     browser's own scaling   23.69 dB   edge energy 2.38
 *     + sharpening            23.88 dB               2.72
 *     Lanczos                 23.91 dB               3.04
 *     Lanczos + sharpening    24.02 dB               3.53
 *     the original itself                            6.66
 *
 * Read that honestly: the print comes out visibly crisper, and barely any more
 * faithful. Detail thrown away by a messaging app is gone, and no amount of
 * filtering brings it back. What this does is stop the enlargement from making
 * matters worse.
 *
 * ## Where this stops, measured
 *
 * On a compressed, underexposed phone photograph, with grain measured as a
 * share of the picture's own range and detail as edge energy:
 *
 *     off                    grain 23.1%   detail 5.97
 *     smoothing at 0.45      grain 22.3%   detail 5.71
 *     smoothing at 1.00      grain 18.7%   detail 3.68
 *     exposure only          grain 21.0%   detail 10.85
 *     the defaults           grain 22.5%   detail 11.15
 *
 * Exposure and sharpening are solved here: detail nearly doubles. Grain is
 * not, and the middle rows say why — smoothing takes detail away in step with
 * the grain it removes, because arithmetic cannot tell a compression artefact
 * from an eyelash. Telling those apart is the one thing a trained model is
 * genuinely better at, and that is what it would be for. Until then the
 * smoothing dial is left where it costs almost nothing, and whoever is looking
 * at a truly grainy photograph can push it themselves and watch what it takes.
 */

import type { Bounds, Drawable, Source } from "./imaging";
import { MAX_EDGE } from "./imaging";

export type Enhance = {
  on: boolean;
  /** Exposure and white balance, 0–1. */
  tone: number;
  /** Noise smoothing, 0–1. */
  denoise: number;
  /** Edge contrast, 0–1. */
  sharpen: number;
};

export function initialEnhance(): Enhance {
  return { on: false, tone: 0.75, denoise: 0.45, sharpen: 0.45 };
}

/** Whether running this would change anything. */
export function idle(settings: Enhance): boolean {
  return (
    !settings.on || (settings.tone === 0 && settings.denoise === 0 && settings.sharpen === 0)
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

/**
 * A blurred copy, drawn by the browser.
 *
 * `ctx.filter` runs on the GPU and is an order of magnitude faster than the
 * same convolution written here. It is used only as the *reference* for the two
 * filters below — neither returns it — so its exact kernel does not matter.
 *
 * Drawn over an opaque matte first. A cut-out photograph has transparent
 * surroundings, and blurring across that edge pulls nothing into the rim and
 * leaves a dark halo on every head in the shop.
 */
function blurred(canvas: HTMLCanvasElement, radius: number): ImageData {
  const out = surface(canvas.width, canvas.height);
  const ctx = out.getContext("2d", { willReadFrequently: true })!;
  ctx.fillStyle = "#808080";
  ctx.fillRect(0, 0, out.width, out.height);
  ctx.filter = `blur(${radius}px)`;
  ctx.drawImage(canvas, 0, 0);
  ctx.filter = "none";
  return ctx.getImageData(0, 0, out.width, out.height);
}

/**
 * Exposure and colour, from the photograph's own histogram.
 *
 * The black and white points are the levels a quarter of a percent of the
 * picture falls outside — not the darkest and lightest pixels, which are
 * usually a speck of dust and a highlight. The stretch between them is capped,
 * because a flat scan would otherwise be pulled into a poster.
 *
 * Only pixels that are actually part of the subject are counted. After the
 * background has been cut out and replaced with white, the histogram is mostly
 * background, and tuning the exposure to that would darken every face.
 */
function tone(data: ImageData, strength: number): ImageData {
  if (strength <= 0) return data;
  const { data: px } = data;

  const histogram = new Uint32Array(256);
  const channelSum = [0, 0, 0];
  let counted = 0;
  for (let i = 0; i < px.length; i += 4) {
    if (px[i + 3] < 128) continue;
    const luma = (px[i] * 299 + px[i + 1] * 587 + px[i + 2] * 114) / 1000;
    histogram[Math.round(luma)]++;
    channelSum[0] += px[i];
    channelSum[1] += px[i + 1];
    channelSum[2] += px[i + 2];
    counted++;
  }
  if (counted < 64) return data;

  const edge = Math.max(1, Math.floor(counted * 0.0025));
  let low = 0;
  let high = 255;
  for (let seen = 0, v = 0; v < 256; v++) {
    seen += histogram[v];
    if (seen >= edge) {
      low = v;
      break;
    }
  }
  for (let seen = 0, v = 255; v >= 0; v--) {
    seen += histogram[v];
    if (seen >= edge) {
      high = v;
      break;
    }
  }
  if (high - low < 8) return data;

  const stretch = Math.min(255 / (high - low), 2.5);

  // Grey-world, held back hard. A photograph that is legitimately warm — a red
  // jumper filling the frame — is not a white balance error, and correcting it
  // fully would drain it.
  const mean = channelSum.map((sum) => sum / counted);
  const grey = (mean[0] + mean[1] + mean[2]) / 3;
  const gains = mean.map((m) => (m > 8 ? Math.min(1.25, Math.max(0.8, grey / m)) : 1));

  const out = new ImageData(data.width, data.height);
  for (let i = 0; i < px.length; i += 4) {
    for (let k = 0; k < 3; k++) {
      const stretched = (px[i + k] - low) * stretch * gains[k];
      const mixed = px[i + k] + (stretched - px[i + k]) * strength;
      out.data[i + k] = Math.max(0, Math.min(255, mixed));
    }
    out.data[i + 3] = px[i + 3];
  }
  return out;
}

/**
 * How grainy this photograph actually is, measured rather than assumed.
 *
 * Both filters below need to know, and a fixed figure was tried first and was
 * wrong in exactly the case this exists for. Opening out an underexposed
 * photograph multiplies its grain along with everything else, so by the time
 * the smoothing ran the grain stood well above any threshold set for a
 * normally exposed picture, and every speck of it was spared as though it were
 * an eyelash — and then the sharpening put back what little had been taken.
 *
 * The median, not the mean: half the picture would have to be edges before
 * genuine detail could drag this upward and get itself smoothed away.
 */
function grainOf(sharp: ImageData, soft: ImageData): number {
  const samples: number[] = [];
  // Green, and every seventeenth pixel: enough to find a median, cheap enough
  // not to show up beside the filters it informs.
  for (let i = 1; i < sharp.data.length; i += 4 * 17) {
    samples.push(Math.abs(sharp.data[i] - soft.data[i]));
  }
  samples.sort((a, b) => a - b);
  return Math.max(1, samples[samples.length >> 1] ?? 1);
}

/**
 * Noise smoothing that leaves edges alone.
 *
 * Each pixel moves toward its blurred self only as far as it already agrees
 * with it. Where the two differ — an eyelash, a collar, the edge of a face —
 * the pixel stays where it is. Blurring everything equally would take the
 * detail with the grain, which is the usual way a "cleaned up" photo ends up
 * looking like plastic.
 */
function denoise(canvas: HTMLCanvasElement, strength: number): ImageData {
  const sharp = pixels(canvas);
  if (strength <= 0) return sharp;
  /**
   * Wide enough to be worth moving toward, whatever the dial says.
   *
   * The radius used to grow with the setting, which made the low half of the
   * dial useless: at a small radius the blurred copy still carries most of the
   * grain, so a pixel moving toward it arrives somewhere just as noisy.
   * Measured on a compressed phone photograph, the setting at 0.3 took two per
   * cent off the grain and at 1.0 took eighteen — a dial that does nothing
   * until it is nearly at the end is a dial nobody can use.
   */
  const soft = blurred(canvas, 1.6 + strength * 1.2);
  const out = new ImageData(sharp.width, sharp.height);

  const tolerance = Math.max(4, grainOf(sharp, soft) * (2 + strength * 4));
  // How far a pixel may be moved toward its blurred self at most — which is
  // what the dial now means, near enough to read as a percentage.
  const ceiling = Math.min(0.92, strength * 1.05);

  for (let i = 0; i < sharp.data.length; i += 4) {
    for (let k = 0; k < 3; k++) {
      const gap = Math.abs(sharp.data[i + k] - soft.data[i + k]);
      const share = ceiling * Math.max(0, 1 - gap / tolerance);
      out.data[i + k] = sharp.data[i + k] + (soft.data[i + k] - sharp.data[i + k]) * share;
    }
    out.data[i + 3] = sharp.data[i + 3];
  }
  return out;
}

/**
 * Unsharp mask: the difference between the picture and a blurred copy of it,
 * added back.
 *
 * Below the threshold nothing happens, so film grain, skin and paper texture
 * are left as they are rather than being promoted into detail. The threshold
 * is taken from the photograph's own grain, because a fixed one undid the
 * smoothing that had just run: on a grainy picture every speck stands well
 * above three levels, and sharpening put back what had been taken out.
 */
function sharpen(canvas: HTMLCanvasElement, amount: number): ImageData {
  const sharp = pixels(canvas);
  if (amount <= 0) return sharp;
  const soft = blurred(canvas, 1.1);
  const out = new ImageData(sharp.width, sharp.height);
  const threshold = Math.max(2, grainOf(sharp, soft) * 1.8);
  const gain = amount * 1.2;

  for (let i = 0; i < sharp.data.length; i += 4) {
    for (let k = 0; k < 3; k++) {
      const difference = sharp.data[i + k] - soft.data[i + k];
      const used = Math.abs(difference) <= threshold ? 0 : difference;
      out.data[i + k] = Math.max(0, Math.min(255, sharp.data[i + k] + used * gain));
    }
    out.data[i + 3] = sharp.data[i + 3];
  }
  return out;
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
  const table: { start: number; w: Float32Array }[] = new Array(to);
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
    table[i] = { start: first, w };
  }
  return table;
}

/**
 * Lanczos-3 enlargement, separable: across, then down.
 *
 * The browser's own scaling is built for speed and goes soft when stretched.
 * This is the filter photographic software uses for the same job, and it is
 * worth about two thirds of a point of edge energy on a threefold enlargement
 * — see the table at the top.
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
      const { start, w: taps } = across[x];
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
      middle[o] = r;
      middle[o + 1] = g;
      middle[o + 2] = b;
      middle[o + 3] = a;
    }
  }

  const out = new ImageData(w, h);
  for (let y = 0; y < h; y++) {
    const { start, w: taps } = down[y];
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
      out.data[o] = Math.max(0, Math.min(255, r));
      out.data[o + 1] = Math.max(0, Math.min(255, g));
      out.data[o + 2] = Math.max(0, Math.min(255, b));
      out.data[o + 3] = Math.max(0, Math.min(255, a));
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
function growth(bounds: Bounds, want: { w: number; h: number } | undefined): number {
  if (!want) return 1;
  const need = Math.max(want.w / Math.max(1, bounds.w), want.h / Math.max(1, bounds.h));
  return need <= 1.05 ? 1 : Math.min(need, MAX_GROWTH);
}

/**
 * Runs the whole thing, in the order the operations have to happen in.
 *
 * Exposure first, and this order was arrived at by measuring rather than by
 * taste. An underexposed photograph occupies a narrow band of the range, and
 * opening that band out multiplies everything in it — including the grain, by
 * the same factor. Smoothing beforehand therefore works on grain that is about
 * to be doubled, against a threshold calibrated for a normal photograph, and
 * the result comes out noisier than it went in. Correcting the exposure first
 * puts the picture at the size the next two steps expect.
 *
 * Then the enlargement, and the edges last — sharpening before enlarging would
 * blur the result straight back out again.
 */
export function enhanceSource(
  source: Source,
  settings: Enhance,
  want?: { w: number; h: number },
): Source {
  if (idle(settings)) return source;

  const scale = growth(source.bounds, want);
  const base = asCanvas(source.bitmap);
  const target = {
    w: Math.min(MAX_EDGE, Math.round(base.width * scale)),
    h: Math.min(MAX_EDGE, Math.round(base.height * scale)),
  };

  let canvas = base;
  if (settings.tone > 0) canvas = paint(tone(pixels(canvas), settings.tone));
  if (settings.denoise > 0) canvas = paint(denoise(canvas, settings.denoise));
  if (target.w !== canvas.width || target.h !== canvas.height) {
    canvas = resample(canvas, target.w, target.h);
  }
  if (settings.sharpen > 0) canvas = paint(sharpen(canvas, settings.sharpen));

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
