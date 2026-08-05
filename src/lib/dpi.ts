/**
 * Canvas exports carry no physical resolution, so a 300 DPI passport photo opens
 * in print software as a huge 72 DPI image. These helpers patch the density
 * metadata back in: a `pHYs` chunk for PNG, the JFIF `APP0` density fields for
 * JPEG. WebP is left untouched — it has no equivalent header.
 */

/** Byte views backed by a plain ArrayBuffer, which is what `Blob` accepts. */
type Bytes = Uint8Array<ArrayBuffer>;

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(bytes: Bytes): number {
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) {
    c = CRC_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function concat(parts: Bytes[]): Bytes {
  const total = parts.reduce((sum, p) => sum + p.length, 0);
  const out = new Uint8Array(total);
  let at = 0;
  for (const p of parts) {
    out.set(p, at);
    at += p.length;
  }
  return out;
}

function pixelsPerMetre(dpi: number): number {
  return Math.round(dpi / 0.0254);
}

function buildPhys(dpi: number): Bytes {
  // length(4) + "pHYs"(4) + ppuX(4) + ppuY(4) + unit(1) + crc(4)
  const chunk = new Uint8Array(21);
  const view = new DataView(chunk.buffer);
  const ppu = pixelsPerMetre(dpi);
  view.setUint32(0, 9);
  chunk.set([0x70, 0x48, 0x59, 0x73], 4); // "pHYs"
  view.setUint32(8, ppu);
  view.setUint32(12, ppu);
  chunk[16] = 1; // unit specifier: metre
  view.setUint32(17, crc32(chunk.subarray(4, 17)));
  return chunk;
}

function patchPng(src: Bytes, dpi: number): Bytes {
  const view = new DataView(src.buffer, src.byteOffset, src.byteLength);
  const parts: Bytes[] = [src.subarray(0, 8)]; // signature
  let offset = 8;

  while (offset + 8 <= src.length) {
    const length = view.getUint32(offset);
    const type = String.fromCharCode(
      src[offset + 4],
      src[offset + 5],
      src[offset + 6],
      src[offset + 7],
    );
    const size = length + 12;
    if (type !== "pHYs") parts.push(src.subarray(offset, offset + size));
    // pHYs must sit before the first IDAT; directly after IHDR is always valid.
    if (type === "IHDR") parts.push(buildPhys(dpi));
    offset += size;
    if (type === "IEND") break;
  }

  return concat(parts);
}

function patchJpeg(src: Bytes, dpi: number): Bytes {
  const density = Math.min(65535, Math.round(dpi));
  const hasJfif =
    src[2] === 0xff &&
    src[3] === 0xe0 &&
    src[6] === 0x4a && // J
    src[7] === 0x46 && // F
    src[8] === 0x49 && // I
    src[9] === 0x46; // F

  if (hasJfif) {
    const out = src.slice();
    const view = new DataView(out.buffer, out.byteOffset, out.byteLength);
    out[13] = 1; // units: dots per inch
    view.setUint16(14, density);
    view.setUint16(16, density);
    return out;
  }

  // No JFIF segment: splice a minimal one straight after the SOI marker.
  const app0 = new Uint8Array(18);
  const view = new DataView(app0.buffer);
  app0.set([0xff, 0xe0], 0);
  view.setUint16(2, 16); // segment length, marker excluded
  app0.set([0x4a, 0x46, 0x49, 0x46, 0x00], 4); // "JFIF\0"
  app0.set([1, 1], 9); // version 1.1
  app0[11] = 1; // units: dots per inch
  view.setUint16(12, density);
  view.setUint16(14, density);
  app0[16] = 0; // thumbnail width
  app0[17] = 0; // thumbnail height

  return concat([src.subarray(0, 2), app0, src.subarray(2)]);
}

/** Returns a new Blob carrying `dpi`, or the original when the format has nowhere to put it. */
export async function withDpi(blob: Blob, dpi: number): Promise<Blob> {
  if (!Number.isFinite(dpi) || dpi <= 0) return blob;

  const bytes = new Uint8Array(await blob.arrayBuffer());
  const isPng =
    bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47;
  const isJpeg = bytes[0] === 0xff && bytes[1] === 0xd8;

  try {
    if (isPng) return new Blob([patchPng(bytes, dpi)], { type: "image/png" });
    if (isJpeg) return new Blob([patchJpeg(bytes, dpi)], { type: "image/jpeg" });
  } catch {
    // A malformed patch is worse than missing metadata — fall back to the original.
    return blob;
  }
  return blob;
}
