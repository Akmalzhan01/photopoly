/**
 * A CMYK soft proof: what the screen colour will look like once ink puts it on
 * paper.
 *
 * The studio works in RGB and exports RGB, because a browser canvas has no
 * other option. Ink does not. Four inks reach a distinctly smaller set of
 * colours than a screen does, and the gap is not spread evenly — neutrals and
 * skin come through nearly untouched, while saturated blues, greens and reds
 * lose a great deal. An operator who never sees that gap until the print comes
 * back has no way to compensate for it.
 *
 * ## The model
 *
 * Trilinear interpolation across the RGB cube, with each corner replaced by the
 * colour that ink actually achieves there:
 *
 * | Corner | Ink | Why it moves |
 * | --- | --- | --- |
 * | white | bare paper | stays put |
 * | red, green, blue | two inks overprinted | much darker, much less saturated |
 * | cyan, magenta, yellow | one ink | close, but never as bright |
 * | black | all three | ink cannot reach screen black |
 *
 * That is the Neugebauer equation with the separation `c = 1 − r`, and it is
 * the standard cheap proof. It is not a substitute for a measured ICC profile
 * from a specific press: it shows *that* a colour will shift and roughly how
 * far, not the exact value a particular shop will print. Said plainly in the UI
 * for the same reason it is said here.
 *
 * Black point compensation is applied, so paper white lands on screen white and
 * composite black on screen black. Without it every proof would look flat and
 * grey, and the operator would "correct" a difference that is really just the
 * paper — hiding the hue shifts that actually matter.
 */

/**
 * Solid ink patches of coated offset stock (FOGRA39-like), rendered to sRGB.
 * Indexed by the RGB cube corner they stand in for.
 */
const CORNERS = {
  white: [255, 255, 255],
  /** Yellow + magenta. */
  red: [227, 30, 36],
  /** Cyan + yellow. */
  green: [0, 150, 64],
  /** Cyan + magenta. */
  blue: [46, 20, 132],
  cyan: [0, 158, 224],
  magenta: [227, 0, 123],
  yellow: [255, 237, 0],
  /** All three inks together. */
  black: [35, 31, 32],
} as const;

/**
 * The eight corners in cube order, so a bit pattern indexes them directly:
 * bit 0 = red is high, bit 1 = green is high, bit 2 = blue is high.
 *
 * Flattened to `corner * 3 + channel` rather than kept as an array of arrays.
 * This runs once per pixel of a preview that can reach twenty-five megapixels,
 * and a nested lookup there costs more than the arithmetic around it.
 */
const CUBE = Float64Array.from(
  [
    CORNERS.black, // 000
    CORNERS.red, // 100
    CORNERS.green, // 010
    CORNERS.yellow, // 110  red + green
    CORNERS.blue, // 001
    CORNERS.magenta, // 101  red + blue
    CORNERS.cyan, // 011  green + blue
    CORNERS.white, // 111
  ].flat(),
);

/**
 * How far a channel must move before an operator would call it a different
 * colour. Below this the shift is real but invisible next to paper and lighting
 * variation, and counting it would make the warning cry wolf on every photo.
 */
const NOTICEABLE = 12;

/** Maps composite black to 0 and paper white to 255, per channel. */
const BLACK = Float64Array.from(CORNERS.black);
const SCALE = Float64Array.from(
  [0, 1, 2].map((ch) => 255 / (CORNERS.white[ch] - CORNERS.black[ch])),
);

function mixChannel(r: number, g: number, b: number, ch: number): number {
  // Trilinear across the cube, unrolled into lerps: blue, then green, then red.
  const c000 = CUBE[ch] + (CUBE[12 + ch] - CUBE[ch]) * b;
  const c100 = CUBE[3 + ch] + (CUBE[15 + ch] - CUBE[3 + ch]) * b;
  const c010 = CUBE[6 + ch] + (CUBE[18 + ch] - CUBE[6 + ch]) * b;
  const c110 = CUBE[9 + ch] + (CUBE[21 + ch] - CUBE[9 + ch]) * b;
  const c00 = c000 + (c010 - c000) * g;
  const c10 = c100 + (c110 - c100) * g;
  const mixed = c00 + (c10 - c00) * r;
  return (mixed - BLACK[ch]) * SCALE[ch];
}

/**
 * Grey balance.
 *
 * Equal parts cyan, magenta and yellow do not print grey — they print a warm
 * brown, which is why presses carry a black ink and why separations are grey
 * balanced rather than naive. The mix above knows nothing about that, so on its
 * own it puts a colour cast on every neutral: mid grey came out (111, 91, 88).
 * No press would print that, and an operator trusting the proof would "correct"
 * a fault that existed only in the proof — worse than showing nothing at all.
 *
 * The cure is to measure the model's own answer along the neutral ramp and map
 * it back onto itself, one curve per channel. Greys then pass through exactly,
 * and every other colour carries the same correction — which is what a grey
 * balanced separation does to it in the press room too.
 */
const GREY_FIX: Float64Array[] = [0, 1, 2].map((ch) => {
  const response = new Float64Array(256);
  for (let i = 0; i < 256; i++) {
    const v = i / 255;
    response[i] = Math.max(0, Math.min(255, mixChannel(v, v, v, ch)));
  }

  // Invert it: for every value the mix can emit, the neutral that produced it.
  const fix = new Float64Array(256);
  for (let y = 0; y < 256; y++) {
    let i = 0;
    while (i < 255 && response[i + 1] < y) i++;
    const lo = response[i];
    const hi = response[Math.min(255, i + 1)];
    fix[y] = i + (hi > lo ? (y - lo) / (hi - lo) : 0);
  }
  return fix;
});

function proofChannel(r: number, g: number, b: number, ch: number): number {
  const mixed = Math.max(0, Math.min(255, mixChannel(r, g, b, ch)));
  const fix = GREY_FIX[ch];
  const i = Math.floor(mixed);
  if (i >= 255) return fix[255];
  return fix[i] + (fix[i + 1] - fix[i]) * (mixed - i);
}

/** One colour through the proof, for swatches and other single-value checks. */
export function proofColour(r: number, g: number, b: number): [number, number, number] {
  const nr = r / 255;
  const ng = g / 255;
  const nb = b / 255;
  return [
    Math.max(0, Math.min(255, Math.round(proofChannel(nr, ng, nb, 0)))),
    Math.max(0, Math.min(255, Math.round(proofChannel(nr, ng, nb, 1)))),
    Math.max(0, Math.min(255, Math.round(proofChannel(nr, ng, nb, 2)))),
  ];
}

export type ProofResult = {
  /** Opaque pixels examined. Zero when the frame is entirely transparent. */
  counted: number;
  /** Of those, how many move by more than `NOTICEABLE` in some channel. */
  shifted: number;
};

/**
 * Rewrites RGBA pixels in place to their printed appearance, reporting how much
 * of the picture ink cannot hold. Alpha is left alone and clear pixels are
 * skipped — there is no ink where there is no image.
 */
export function applyProof(data: Uint8ClampedArray): ProofResult {
  let counted = 0;
  let shifted = 0;

  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] === 0) continue;
    const r = data[i] / 255;
    const g = data[i + 1] / 255;
    const b = data[i + 2] / 255;

    const pr = proofChannel(r, g, b, 0);
    const pg = proofChannel(r, g, b, 1);
    const pb = proofChannel(r, g, b, 2);

    counted++;
    const worst = Math.max(
      Math.abs(pr - data[i]),
      Math.abs(pg - data[i + 1]),
      Math.abs(pb - data[i + 2]),
    );
    if (worst > NOTICEABLE) shifted++;

    data[i] = pr;
    data[i + 1] = pg;
    data[i + 2] = pb;
  }

  return { counted, shifted };
}

/** Share of the picture that ink will visibly change, 0–1. */
export function shiftedShare(result: ProofResult): number {
  return result.counted === 0 ? 0 : result.shifted / result.counted;
}
