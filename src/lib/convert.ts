/**
 * Converting and shrinking photographs in the browser — above all the HEIC
 * files iPhones take, which most printers, kiosks and Windows machines still
 * cannot open.
 *
 * Every file is decoded to pixels and encoded again through a canvas. That is
 * also what strips the metadata: the camera model, the date and — the one
 * that matters — the GPS position a phone writes into every photo it takes.
 * Orientation is not lost with it, because `createImageBitmap` turns the
 * pixels upright before the EXIF tag is discarded.
 */

import { zipSync } from "fflate";
import { extensionFor, fileStem, type ExportFormat } from "./imaging";

export type OutputFormat = Extract<ExportFormat, "image/jpeg" | "image/png" | "image/webp">;

export type ConvertOptions = {
  format: OutputFormat;
  /** 0–1; ignored for PNG. */
  quality: number;
  /** Longest side in pixels, or null to keep the original size. */
  maxEdge: number | null;
};

export const MAX_EDGES = [null, 3000, 2000, 1280] as const;

/** A file is worth a look as HEIC by its type, or by its name when the browser leaves the type blank. */
export function looksHeic(file: File): boolean {
  return /image\/hei[cf]/i.test(file.type) || /\.hei[cf]$/i.test(file.name);
}

/**
 * Pixels from any image the browser opens, plus HEIC.
 *
 * The HEIC decoder is three megabytes of WebAssembly, so it is fetched only
 * when a HEIC file actually turns up. Safari decodes HEIC itself; trying the
 * browser first saves that download where it can.
 */
export async function decode(file: File): Promise<ImageBitmap> {
  try {
    return await createImageBitmap(file);
  } catch (error) {
    if (!looksHeic(file)) throw error;
  }
  const { heicTo } = await import("heic-to/next");
  return heicTo({ blob: file, type: "bitmap" });
}

export function fittedSize(
  width: number,
  height: number,
  maxEdge: number | null,
): { w: number; h: number } {
  const longest = Math.max(width, height);
  if (!maxEdge || longest <= maxEdge) return { w: width, h: height };
  const ratio = maxEdge / longest;
  return { w: Math.max(1, Math.round(width * ratio)), h: Math.max(1, Math.round(height * ratio)) };
}

export async function encode(bitmap: ImageBitmap, options: ConvertOptions): Promise<Blob> {
  const { w, h } = fittedSize(bitmap.width, bitmap.height, options.maxEdge);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas unavailable");
  // JPEG has no transparency, and a canvas left empty encodes it as black.
  if (options.format === "image/jpeg") {
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, w, h);
  }
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(bitmap, 0, 0, w, h);

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, options.format, options.quality),
  );
  if (!blob) throw new Error("Encode failed");
  // A browser that cannot write WebP quietly writes PNG instead; say so.
  if (blob.type !== options.format) throw new Error(`Формат ${options.format} не поддерживается этим браузером.`);
  return blob;
}

export function outputName(file: File, format: OutputFormat): string {
  return `${fileStem(file.name)}.${extensionFor(format)}`;
}

/**
 * One archive of everything converted. Stored rather than deflated: the
 * images are compressed already, and squeezing them again costs time for
 * nothing. Clashing names get a number, so no file overwrites another.
 */
export async function zipFiles(files: { name: string; blob: Blob }[]): Promise<Blob> {
  const used = new Map<string, number>();
  const entries: Record<string, Uint8Array> = {};
  for (const { name, blob } of files) {
    const seen = used.get(name) ?? 0;
    used.set(name, seen + 1);
    const unique = seen === 0 ? name : name.replace(/(\.[^.]+)$/, `-${seen + 1}$1`);
    entries[unique] = new Uint8Array(await blob.arrayBuffer());
  }
  const zipped = zipSync(entries, { level: 0 });
  return new Blob([zipped.buffer as ArrayBuffer], { type: "application/zip" });
}
