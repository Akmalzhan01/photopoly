import type { Bounds, Source } from "./imaging";

export type Adjustments = {
  /** Each runs -1…1, where 0 leaves the pixel alone. */
  brightness: number;
  contrast: number;
  saturation: number;
  warmth: number;
};

export const NEUTRAL: Adjustments = {
  brightness: 0,
  contrast: 0,
  saturation: 0,
  warmth: 0,
};

export function isNeutral(adj: Adjustments): boolean {
  return (
    adj.brightness === 0 && adj.contrast === 0 && adj.saturation === 0 && adj.warmth === 0
  );
}

/** ±1 shifts a channel by this much before contrast is applied. */
const BRIGHTNESS_RANGE = 90;
/** ±1 pushes the red/blue channels this far apart. */
const WARMTH_RANGE = 0.18;

/** Brightness and contrast are the same curve for every channel, so precompute it. */
function buildCurve(brightness: number, contrast: number): Uint8ClampedArray {
  const curve = new Uint8ClampedArray(256);
  const shift = brightness * BRIGHTNESS_RANGE;
  const slope = 1 + contrast;
  for (let i = 0; i < 256; i++) {
    curve[i] = (i + shift - 128) * slope + 128;
  }
  return curve;
}

/**
 * Adjusts RGBA pixels in place. Alpha is never touched, so a cut-out keeps its
 * edges, and fully transparent pixels are skipped entirely.
 */
export function applyAdjustments(
  data: Uint8ClampedArray,
  adj: Adjustments,
): Uint8ClampedArray {
  const curve = buildCurve(adj.brightness, adj.contrast);
  const sat = 1 + adj.saturation;
  const warmR = 1 + adj.warmth * WARMTH_RANGE;
  const warmB = 1 - adj.warmth * WARMTH_RANGE;
  const flatSat = adj.saturation === 0;
  const flatWarm = adj.warmth === 0;

  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] === 0) continue;

    let r = curve[data[i]];
    let g = curve[data[i + 1]];
    let b = curve[data[i + 2]];

    if (!flatSat) {
      // Rec. 709 luma, so a saturation pull lands on perceived grey.
      const grey = 0.2126 * r + 0.7152 * g + 0.0722 * b;
      r = grey + (r - grey) * sat;
      g = grey + (g - grey) * sat;
      b = grey + (b - grey) * sat;
    }

    if (!flatWarm) {
      r *= warmR;
      b *= warmB;
    }

    data[i] = r;
    data[i + 1] = g;
    data[i + 2] = b;
  }

  return data;
}

/**
 * Bakes the adjustments into a fresh canvas cropped to the subject, so the work
 * scales with the visible area rather than the whole photograph.
 */
export function adjustSource(source: Source, adj: Adjustments): Source {
  if (isNeutral(adj)) return source;

  const { bounds } = source;
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(bounds.w));
  canvas.height = Math.max(1, Math.round(bounds.h));

  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return source;

  ctx.drawImage(
    source.bitmap,
    bounds.x,
    bounds.y,
    bounds.w,
    bounds.h,
    0,
    0,
    canvas.width,
    canvas.height,
  );

  const image = ctx.getImageData(0, 0, canvas.width, canvas.height);
  applyAdjustments(image.data, adj);
  ctx.putImageData(image, 0, 0);

  const cropped: Bounds = { x: 0, y: 0, w: canvas.width, h: canvas.height };
  return { bitmap: canvas, bounds: cropped };
}
