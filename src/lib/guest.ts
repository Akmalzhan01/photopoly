/**
 * What a visitor without an account may take away: the finished picture, at
 * a size good for a screen but not for print.
 *
 * The tools are open so people arriving from a search can see them work on
 * their own photo. A reduced copy answers "does this do what I need?"; the
 * full size is what the free account is for.
 */

/** Longest side of a guest's download, in pixels. */
export const GUEST_EDGE = 1000;

export function guestCopy(source: HTMLCanvasElement): HTMLCanvasElement {
  const longest = Math.max(source.width, source.height);
  if (longest <= GUEST_EDGE) return source;
  const ratio = GUEST_EDGE / longest;
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(source.width * ratio));
  canvas.height = Math.max(1, Math.round(source.height * ratio));
  const ctx = canvas.getContext("2d");
  if (ctx) {
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
  }
  return canvas;
}
