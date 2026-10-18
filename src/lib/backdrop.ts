/**
 * What goes behind a cut-out: nothing, a flat colour, or the photograph's own
 * background thrown out of focus.
 */

import type { Drawable } from "./imaging";

export type Backdrop =
  | { kind: "transparent" }
  | { kind: "colour"; colour: string }
  | { kind: "blur" };

/**
 * Blur radius as a share of the shorter side, so a phone photo and a scan get
 * the same look. Two per cent reads as a portrait lens without turning the
 * scene into fog.
 */
const BLUR_SHARE = 0.02;

/**
 * Draws `cutout` over `backdrop` at the cut-out's own size.
 *
 * The blurred copy is drawn a little larger than the frame: a blur samples
 * past the edge, finds nothing there, and would otherwise leave a pale rim
 * around the whole picture.
 */
export function composeBackdrop(
  cutout: Drawable,
  original: Drawable,
  backdrop: Backdrop,
): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = cutout.width;
  canvas.height = cutout.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return canvas;

  if (backdrop.kind === "colour") {
    ctx.fillStyle = backdrop.colour;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  } else if (backdrop.kind === "blur") {
    const radius = Math.max(2, Math.round(Math.min(canvas.width, canvas.height) * BLUR_SHARE));
    ctx.filter = `blur(${radius}px)`;
    ctx.drawImage(
      original,
      -radius * 2,
      -radius * 2,
      canvas.width + radius * 4,
      canvas.height + radius * 4,
    );
    ctx.filter = "none";
  }

  ctx.drawImage(cutout, 0, 0);
  return canvas;
}

/** A transparent result only survives as PNG; anything else is a photograph. */
export function backdropFormat(backdrop: Backdrop): "image/png" | "image/jpeg" {
  return backdrop.kind === "transparent" ? "image/png" : "image/jpeg";
}
