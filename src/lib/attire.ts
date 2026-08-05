/**
 * Formal wear laid over the photo.
 *
 * The artwork is a PNG an admin uploaded; nothing is drawn by hand any more.
 *
 * It is positioned against the **frame**, not against the subject. Anchoring it
 * to the subject made the two move as one — enlarging the person enlarged the
 * suit — which is not what "position the suit" should mean. Frame anchoring
 * costs a nudge after a big change to the photo's own zoom, and buys two
 * controls that are genuinely independent.
 */

/**
 * An uploaded PNG, already decoded.
 *
 * It arrives decoded rather than as a URL because `compose()` is synchronous —
 * it runs on every slider drag — and awaiting an image mid-render would stall
 * the preview. Loading happens once, in the component, before compose is called.
 */
export type AttireImage = HTMLImageElement | ImageBitmap;

/** An uploaded suit as the studio sees it — metadata only, no bytes. */
export type AttireAssetView = { id: string; name: string; url: string };

export type Attire = {
  /** Width as a multiple of the frame width. */
  scale: number;
  /** Nudge, as a fraction of the frame dimension. */
  offsetX: number;
  offsetY: number;
  /** Null while the artwork is still loading, or if it failed to load. */
  image: AttireImage | null;
};

/** Where the artwork's top edge sits by default, as a fraction down the frame. */
const ATTIRE_TOP = 0.5;

/**
 * The artwork's last row of pixels, isolated onto its own canvas.
 *
 * Stretching that row straight from the source bleeds the row above it into the
 * result: sampling a one-pixel-tall slice still interpolates against its
 * neighbours, which tints the fill. Copying the row 1:1 first gives it no
 * neighbours to bleed from. Cached per image — this runs on every slider drag,
 * and the strip only changes when the suit does.
 */
const bottomStrips = new WeakMap<AttireImage, HTMLCanvasElement>();

function bottomStrip(image: AttireImage): HTMLCanvasElement | null {
  const cached = bottomStrips.get(image);
  if (cached) return cached;

  const strip = document.createElement("canvas");
  strip.width = image.width;
  strip.height = 1;
  const ctx = strip.getContext("2d");
  if (!ctx) return null;

  // Same size in and out, so this is a copy rather than a resample.
  ctx.drawImage(image, 0, image.height - 1, image.width, 1, 0, 0, image.width, 1);
  bottomStrips.set(image, strip);
  return strip;
}

/** Paints `attire` onto a frame that is `frameW` × `frameH`. */
export function drawAttire(
  target: CanvasRenderingContext2D,
  attire: Attire,
  frameW: number,
  frameH: number,
): void {
  const image = attire.image;
  if (!image || attire.scale <= 0 || !image.width || !image.height) return;

  // The aspect ratio comes from the artwork, so a tall coat and a wide pair of
  // shoulders both land the way they were drawn.
  const width = Math.max(1, Math.round(frameW * attire.scale));
  const height = Math.max(1, Math.round((width * image.height) / image.width));

  const x = Math.round(frameW / 2 + attire.offsetX * frameW - width / 2);
  const y = Math.round(frameH * (ATTIRE_TOP + attire.offsetY));

  target.imageSmoothingEnabled = true;
  target.imageSmoothingQuality = "high";
  target.drawImage(image, x, y, width, height);

  // If the artwork stops above the bottom edge, stretch its final pixel row
  // down to meet it. Filling with a flat colour would need to guess one, and
  // guessing wrong shows as a hard seam across the chest.
  const bottom = y + height;
  if (bottom < frameH) {
    const strip = bottomStrip(image);
    if (strip) target.drawImage(strip, x, bottom - 1, width, frameH - bottom + 1);
  }
}
