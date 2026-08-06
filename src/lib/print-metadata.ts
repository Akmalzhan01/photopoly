/**
 * A canvas export describes itself badly, and the print shop only ever sees the
 * file. Two things are missing, and each one changes what comes out of the
 * printer.
 *
 * **Physical size.** Canvas output carries no resolution, so a 300 DPI passport
 * photo opens in print software as a huge 72 DPI image and gets rescaled by
 * whatever that software assumes.
 *
 * **Colour space.** Untagged RGB is just three numbers per pixel with no stated
 * meaning. Receiving software then assigns its own working space — frequently
 * Adobe RGB, sometimes a CMYK space — and the identical numbers print as
 * different colours: skin goes ruddy, a light grey background turns blue,
 * saturated blues go muddy. Chrome tags JPEG and WebP, but writes PNG entirely
 * bare — and PNG is both the default format here and the only format the print
 * path uses, so in practice *every printed photo* left the studio unlabelled.
 *
 * Hence: `pHYs` + `iCCP` (plus `gAMA`/`cHRM` for software that reads no
 * profiles) on PNG, and JFIF `APP0` density + `APP2 ICC_PROFILE` on JPEG. WebP
 * is returned untouched: the browser already tags it, and it has no density
 * field to patch.
 *
 * None of this converts anything to CMYK — a browser canvas cannot produce
 * CMYK. What it does is make the RGB unambiguous, so the shop's conversion
 * starts from a known place instead of a guess.
 */

import { srgbProfile, srgbProfileDeflated } from "./srgb-profile";

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

function ascii(bytes: Bytes, from: number, length: number): string {
  let out = "";
  for (let i = 0; i < length; i++) out += String.fromCharCode(bytes[from + i]);
  return out;
}

// --- PNG --------------------------------------------------------------------

function buildChunk(type: string, data: Bytes): Bytes {
  const out = new Uint8Array(data.length + 12);
  const view = new DataView(out.buffer);
  view.setUint32(0, data.length);
  for (let i = 0; i < 4; i++) out[4 + i] = type.charCodeAt(i);
  out.set(data, 8);
  view.setUint32(8 + data.length, crc32(out.subarray(4, 8 + data.length)));
  return out;
}

function physData(dpi: number): Bytes {
  const data = new Uint8Array(9);
  const view = new DataView(data.buffer);
  const perMetre = Math.round(dpi / 0.0254);
  view.setUint32(0, perMetre);
  view.setUint32(4, perMetre);
  data[8] = 1; // unit specifier: metre
  return data;
}

function iccpData(): Bytes {
  const profile = srgbProfileDeflated();
  // keyword + NUL + compression method (0 = deflate) + the deflated profile.
  const keyword = "sRGB";
  const data = new Uint8Array(keyword.length + 2 + profile.length);
  for (let i = 0; i < keyword.length; i++) data[i] = keyword.charCodeAt(i);
  data[keyword.length] = 0;
  data[keyword.length + 1] = 0;
  data.set(profile, keyword.length + 2);
  return data;
}

function gamaData(): Bytes {
  const data = new Uint8Array(4);
  new DataView(data.buffer).setUint32(0, 45455); // 1/2.2, the conventional sRGB value
  return data;
}

function chrmData(): Bytes {
  // sRGB white point and primaries, each ×100000, in the order the chunk wants.
  const values = [31270, 32900, 64000, 33000, 30000, 60000, 15000, 6000];
  const data = new Uint8Array(32);
  const view = new DataView(data.buffer);
  values.forEach((v, i) => view.setUint32(i * 4, v));
  return data;
}

/** Chunks we replace outright, so nothing left in the file can contradict us. */
const REPLACED = new Set(["pHYs", "iCCP", "sRGB", "gAMA", "cHRM"]);

function patchPng(src: Bytes, dpi: number): Bytes {
  const view = new DataView(src.buffer, src.byteOffset, src.byteLength);
  const parts: Bytes[] = [src.subarray(0, 8)]; // signature
  let offset = 8;

  while (offset + 8 <= src.length) {
    const length = view.getUint32(offset);
    const type = ascii(src, offset + 4, 4);
    const size = length + 12;
    if (!REPLACED.has(type)) parts.push(src.subarray(offset, offset + size));
    // All of these must precede the first IDAT; directly after IHDR is always
    // valid, and keeps them ahead of PLTE too.
    if (type === "IHDR") {
      parts.push(buildChunk("gAMA", gamaData()));
      parts.push(buildChunk("cHRM", chrmData()));
      parts.push(buildChunk("iCCP", iccpData()));
      parts.push(buildChunk("pHYs", physData(dpi)));
    }
    offset += size;
    if (type === "IEND") break;
  }

  return concat(parts);
}

// --- JPEG -------------------------------------------------------------------

function buildApp0(density: number): Bytes {
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
  return app0;
}

function buildApp2(): Bytes {
  const profile = srgbProfile();
  // marker(2) + length(2) + "ICC_PROFILE\0"(12) + chunk number(1) + count(1)
  const out = new Uint8Array(18 + profile.length);
  const view = new DataView(out.buffer);
  out.set([0xff, 0xe2], 0);
  view.setUint16(2, 16 + profile.length);
  const tag = "ICC_PROFILE\0";
  for (let i = 0; i < tag.length; i++) out[4 + i] = tag.charCodeAt(i);
  out[16] = 1; // this is chunk 1…
  out[17] = 1; // …of 1. The profile is far below the 64 KB segment limit.
  out.set(profile, 18);
  return out;
}

function patchJpeg(src: Bytes, dpi: number): Bytes {
  const density = Math.min(65535, Math.round(dpi));
  const view = new DataView(src.buffer, src.byteOffset, src.byteLength);

  let at = 2; // past the SOI marker
  let jfifAt = -1;
  let hasProfile = false;
  // Metadata segments come before the image data; once the scan starts there is
  // nothing left to read and nowhere left to insert.
  let insertAt = 2;

  while (at + 4 <= src.length && src[at] === 0xff) {
    const marker = src[at + 1];
    if (marker === 0xda || marker === 0xd9) break; // start of scan / end of image
    const length = view.getUint16(at + 2);
    if (length < 2) break;
    if (marker === 0xe0 && ascii(src, at + 4, 5) === "JFIF\0") {
      jfifAt = at;
      // An APP0 JFIF segment has to stay first, so anything we add goes after it.
      insertAt = at + 2 + length;
    }
    if (marker === 0xe2 && ascii(src, at + 4, 12) === "ICC_PROFILE\0") hasProfile = true;
    at += 2 + length;
  }

  const app2 = hasProfile ? null : buildApp2();

  if (jfifAt >= 0) {
    const out = src.slice();
    const outView = new DataView(out.buffer, out.byteOffset, out.byteLength);
    out[jfifAt + 11] = 1; // units: dots per inch
    outView.setUint16(jfifAt + 12, density);
    outView.setUint16(jfifAt + 14, density);
    if (!app2) return out;
    return concat([out.subarray(0, insertAt), app2, out.subarray(insertAt)]);
  }

  // No JFIF segment at all: splice a minimal one straight after the SOI marker.
  const head = src.subarray(0, 2);
  const tail = src.subarray(2);
  const app0 = buildApp0(density);
  return concat(app2 ? [head, app0, app2, tail] : [head, app0, tail]);
}

// --- entry point ------------------------------------------------------------

/**
 * Returns a new Blob carrying the print resolution and an sRGB tag, or the
 * original when the format has nowhere to put them.
 */
export async function withPrintMetadata(blob: Blob, dpi: number): Promise<Blob> {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  const isPng =
    bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47;
  const isJpeg = bytes[0] === 0xff && bytes[1] === 0xd8;
  // A photo with no stated resolution still benefits from a colour tag, so the
  // density is clamped rather than used as a reason to skip the whole pass.
  const density = Number.isFinite(dpi) && dpi > 0 ? dpi : 72;

  try {
    if (isPng) return new Blob([patchPng(bytes, density)], { type: "image/png" });
    if (isJpeg) return new Blob([patchJpeg(bytes, density)], { type: "image/jpeg" });
  } catch {
    // A malformed patch is worse than missing metadata — fall back to the original.
    return blob;
  }
  return blob;
}
