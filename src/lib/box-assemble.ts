/**
 * Where the panels actually end up once the box is folded.
 *
 * The preview folds with CSS transforms, which means the browser knows where
 * everything is and nothing else does — so the view could not be centred, could
 * not be scaled to fit, and could not be checked. This works the same
 * transforms out in millimetres, using exactly the rules CSS uses, so the
 * numbers describe what is on the screen rather than a second opinion about it.
 *
 * That it can be checked is the real gain: a fold model can hinge every panel
 * on the right edge and still assemble something that is not the box, and the
 * only way to notice is to measure the result and compare it with the box that
 * was asked for.
 */

import type { Face } from "./box";

type Vec = { x: number; y: number; z: number };
type Mat = number[];

const multiply = (a: Mat, b: Mat): Mat => {
  const out = new Array<number>(16).fill(0);
  for (let row = 0; row < 4; row++) {
    for (let col = 0; col < 4; col++) {
      let sum = 0;
      for (let k = 0; k < 4; k++) sum += a[row * 4 + k] * b[k * 4 + col];
      out[row * 4 + col] = sum;
    }
  }
  return out;
};

const identity = (): Mat => [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];

const shift = (x: number, y: number, z: number): Mat =>
  [1, 0, 0, x, 0, 1, 0, y, 0, 0, 1, z, 0, 0, 0, 1];

// The screen's axes, not a mathematician's: y grows downward and z comes toward
// the viewer, which is what CSS means by these rotations.
const turnX = (degrees: number): Mat => {
  const a = (degrees * Math.PI) / 180;
  const c = Math.cos(a);
  const s = Math.sin(a);
  return [1, 0, 0, 0, 0, c, -s, 0, 0, s, c, 0, 0, 0, 0, 1];
};

const turnY = (degrees: number): Mat => {
  const a = (degrees * Math.PI) / 180;
  const c = Math.cos(a);
  const s = Math.sin(a);
  return [c, 0, s, 0, 0, 1, 0, 0, -s, 0, c, 0, 0, 0, 0, 1];
};

const put = (m: Mat, p: Vec): Vec => ({
  x: m[0] * p.x + m[1] * p.y + m[2] * p.z + m[3],
  y: m[4] * p.x + m[5] * p.y + m[6] * p.z + m[7],
  z: m[8] * p.x + m[9] * p.y + m[10] * p.z + m[11],
});

/**
 * Where a panel sits inside its parent, and which point it turns about.
 *
 * Blank space has y going up and the screen has it going down; the parent's
 * own height cancels out of the difference, which is why only the two
 * rectangles are needed. Kept here so the renderer and the measurement cannot
 * drift apart — they call the same function.
 */
export function placement(node: Face, parent: Face | null) {
  const left = parent ? node.x - parent.x : 0;
  const top = parent ? parent.y + parent.h - (node.y + node.h) : 0;
  const origin = {
    left: { x: 0, y: node.h / 2, css: "left center", spin: true },
    right: { x: node.w, y: node.h / 2, css: "right center", spin: true },
    top: { x: node.w / 2, y: 0, css: "center top", spin: false },
    bottom: { x: node.w / 2, y: node.h, css: "center bottom", spin: false },
  }[node.hinge];
  return { left, top, origin };
}

function corners(node: Face, parent: Face | null, upto: Mat, fold: number, out: Vec[]) {
  const { left, top, origin } = placement(node, parent);
  const angle = parent ? node.angle * fold : 0;
  const spin = origin.spin ? turnY(angle) : turnX(angle);
  const local = multiply(
    shift(left, top, 0),
    multiply(shift(origin.x, origin.y, 0), multiply(spin, shift(-origin.x, -origin.y, 0))),
  );
  const here = multiply(upto, local);

  for (const [x, y] of [
    [0, 0],
    [node.w, 0],
    [0, node.h],
    [node.w, node.h],
  ]) {
    out.push(put(here, { x, y, z: 0 }));
  }
  for (const child of node.children) corners(child, node, here, fold, out);
}

export type Assembly = {
  /** Millimetres, in the same frame the renderer draws in. */
  min: Vec;
  max: Vec;
  size: Vec;
  centre: Vec;
};

/** The box the panels make at a given amount of folding. */
export function assemble(root: Face, fold: number): Assembly {
  const points: Vec[] = [];
  corners(root, null, identity(), fold, points);

  const min = { x: Infinity, y: Infinity, z: Infinity };
  const max = { x: -Infinity, y: -Infinity, z: -Infinity };
  for (const p of points) {
    min.x = Math.min(min.x, p.x);
    min.y = Math.min(min.y, p.y);
    min.z = Math.min(min.z, p.z);
    max.x = Math.max(max.x, p.x);
    max.y = Math.max(max.y, p.y);
    max.z = Math.max(max.z, p.z);
  }

  return {
    min,
    max,
    size: { x: max.x - min.x, y: max.y - min.y, z: max.z - min.z },
    centre: { x: (min.x + max.x) / 2, y: (min.y + max.y) / 2, z: (min.z + max.z) / 2 },
  };
}
