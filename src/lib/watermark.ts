/**
 * Marks the on-screen preview once the export allowance is spent.
 *
 * The reason this exists: the visible canvas holds the finished photo at full
 * output resolution, so "save image as" is a complete export that never goes
 * near the counter. Refusing the download button alone would leave the limit
 * meaning nothing to anyone who right-clicks.
 *
 * It is applied to the visible canvas only, *after* the composition is drawn.
 * The export path composes into a separate canvas, so a marked preview cannot
 * turn into a marked download — the two never share a surface.
 *
 * Deliberately not a full stop: someone with devtools can still reach the clean
 * pixels. Closing that would mean rendering on the server, which would end the
 * promise that the photo never leaves the device.
 */

const TEXT = "photopoly";

export function drawWatermark(
  target: CanvasRenderingContext2D,
  width: number,
  height: number,
): void {
  if (width <= 0 || height <= 0) return;

  const size = Math.max(10, Math.round(Math.min(width, height) * 0.08));
  target.save();
  target.font = `600 ${size}px ui-sans-serif, system-ui, "Segoe UI", sans-serif`;
  target.textAlign = "center";
  target.textBaseline = "middle";

  // Rotate about the centre and cover the diagonal, so no corner is left clean
  // for a crop to rescue.
  const reach = Math.hypot(width, height);
  target.translate(width / 2, height / 2);
  target.rotate(-Math.PI / 6);

  const stepX = target.measureText(TEXT).width + size * 1.5;
  const stepY = size * 2.6;
  const offset = size * 0.06;

  for (let row = 0, y = -reach; y <= reach; y += stepY, row++) {
    // Alternate rows are shifted so the marks never line up into clean columns.
    const shift = (row % 2) * (stepX / 2);
    for (let x = -reach; x <= reach; x += stepX) {
      // Two passes: the light one survives dark hair, the dark one survives the
      // white background a document photo almost always has.
      target.fillStyle = "rgba(255, 255, 255, 0.5)";
      target.fillText(TEXT, x + shift + offset, y + offset);
      target.fillStyle = "rgba(0, 0, 0, 0.34)";
      target.fillText(TEXT, x + shift, y);
    }
  }

  target.restore();
}
