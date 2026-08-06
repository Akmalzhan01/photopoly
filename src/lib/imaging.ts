import { drawAttire, type Attire } from "./attire";
import { withPrintMetadata } from "./print-metadata";
import type { FitMode } from "./presets";

export type Bounds = { x: number; y: number; w: number; h: number };

/** Anything `drawImage` accepts that also reports its own pixel dimensions. */
export type Drawable = ImageBitmap | HTMLCanvasElement;

export type Source = {
  bitmap: Drawable;
  /** Tight crop around the visible pixels, in bitmap coordinates. */
  bounds: Bounds;
};

export type ComposeSpec = {
  targetW: number;
  targetH: number;
  fit: FitMode;
  /** Fraction of the shorter side kept clear around the subject. */
  padding: number;
  zoom: number;
  /** Nudge, as a fraction of the target dimension. */
  offsetX: number;
  offsetY: number;
  background: string;
  /** Formal wear laid over the subject, or null to leave the photo alone. */
  attire: Attire | null;
  /** Inset frame drawn last, in output pixels. Zero means no border. */
  borderWidth: number;
  borderColour: string;
};

export type ExportFormat = "image/png" | "image/jpeg" | "image/webp";

/** Largest edge we are willing to rasterise, to keep memory sane on phones. */
export const MAX_EDGE = 6000;

/** Alpha scan runs on a downscaled copy — a couple of pixels of slack costs nothing. */
const SCAN_MAX = 640;
const ALPHA_THRESHOLD = 12;

export function fullBounds(bitmap: Drawable): Bounds {
  return { x: 0, y: 0, w: bitmap.width, h: bitmap.height };
}

export function alphaBounds(bitmap: Drawable): Bounds {
  const scale = Math.min(1, SCAN_MAX / Math.max(bitmap.width, bitmap.height));
  const w = Math.max(1, Math.round(bitmap.width * scale));
  const h = Math.max(1, Math.round(bitmap.height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return fullBounds(bitmap);

  ctx.drawImage(bitmap, 0, 0, w, h);
  const { data } = ctx.getImageData(0, 0, w, h);

  let minX = w;
  let minY = h;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (data[(y * w + x) * 4 + 3] > ALPHA_THRESHOLD) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }

  if (maxX < 0) return fullBounds(bitmap);

  const inv = 1 / scale;
  const x = Math.max(0, Math.floor((minX - 1) * inv));
  const y = Math.max(0, Math.floor((minY - 1) * inv));
  const right = Math.min(bitmap.width, Math.ceil((maxX + 2) * inv));
  const bottom = Math.min(bitmap.height, Math.ceil((maxY + 2) * inv));
  return { x, y, w: Math.max(1, right - x), h: Math.max(1, bottom - y) };
}

export function compose(
  source: Source,
  spec: ComposeSpec,
  target?: HTMLCanvasElement,
): HTMLCanvasElement {
  const canvas = target ?? document.createElement("canvas");
  canvas.width = spec.targetW;
  canvas.height = spec.targetH;

  const ctx = canvas.getContext("2d");
  if (!ctx) return canvas;

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  if (spec.background !== "transparent") {
    ctx.fillStyle = spec.background;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  const inset = Math.min(spec.targetW, spec.targetH) * spec.padding;
  const availW = Math.max(1, spec.targetW - inset * 2);
  const availH = Math.max(1, spec.targetH - inset * 2);
  const { bounds } = source;

  const ratioW = availW / bounds.w;
  const ratioH = availH / bounds.h;
  const base = spec.fit === "cover" ? Math.max(ratioW, ratioH) : Math.min(ratioW, ratioH);
  const scale = base * spec.zoom;

  const dw = bounds.w * scale;
  const dh = bounds.h * scale;
  const dx = (spec.targetW - dw) / 2 + spec.offsetX * spec.targetW;
  const dy = (spec.targetH - dh) / 2 + spec.offsetY * spec.targetH;

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(source.bitmap, bounds.x, bounds.y, bounds.w, bounds.h, dx, dy, dw, dh);

  // Positioned against the frame, deliberately independent of where the subject
  // above was placed — see the note in attire.ts.
  if (spec.attire) drawAttire(ctx, spec.attire, canvas.width, canvas.height);

  // The border sits inside the frame, so the output keeps its exact dimensions.
  const border = Math.min(spec.borderWidth, Math.floor(Math.min(canvas.width, canvas.height) / 2));
  if (border > 0) {
    ctx.strokeStyle = spec.borderColour;
    ctx.lineWidth = border;
    ctx.strokeRect(border / 2, border / 2, canvas.width - border, canvas.height - border);
  }

  return canvas;
}

export async function exportCanvas(
  canvas: HTMLCanvasElement,
  format: ExportFormat,
  quality: number,
  dpi: number,
): Promise<Blob> {
  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, format, quality),
  );
  if (!blob) throw new Error("Не удалось экспортировать изображение.");
  return withPrintMetadata(blob, dpi);
}

export function download(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  // Give the browser a tick to start the download before revoking.
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

export function extensionFor(format: ExportFormat): string {
  if (format === "image/jpeg") return "jpg";
  if (format === "image/webp") return "webp";
  return "png";
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
