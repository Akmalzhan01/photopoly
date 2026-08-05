import "server-only";

/**
 * Reads a PNG's dimensions straight from its header.
 *
 * This doubles as the file-type check. Trusting the browser's `file.type` or
 * the extension would mean an admin could put arbitrary bytes in a public
 * bucket under a name the studio then loads — the signature is the only part
 * that cannot be renamed.
 */

/** \x89PNG\r\n\x1a\n — the eight bytes every PNG starts with. */
const SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

/** IHDR is required by the spec to be the first chunk, at a fixed offset. */
const IHDR_TYPE_OFFSET = 12;
const WIDTH_OFFSET = 16;
const HEIGHT_OFFSET = 20;
const HEADER_BYTES = 24;

/** Beyond this the studio gains nothing and the browser pays for it. */
export const MAX_ATTIRE_EDGE = 4000;

export type PngInfo = { width: number; height: number };

export function readPngInfo(bytes: Uint8Array): PngInfo | null {
  if (bytes.length < HEADER_BYTES) return null;
  for (let i = 0; i < SIGNATURE.length; i++) {
    if (bytes[i] !== SIGNATURE[i]) return null;
  }

  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (String.fromCharCode(...bytes.subarray(IHDR_TYPE_OFFSET, IHDR_TYPE_OFFSET + 4)) !== "IHDR") {
    return null;
  }

  const width = view.getUint32(WIDTH_OFFSET, false);
  const height = view.getUint32(HEIGHT_OFFSET, false);
  if (width < 1 || height < 1) return null;
  if (width > MAX_ATTIRE_EDGE || height > MAX_ATTIRE_EDGE) return null;

  return { width, height };
}
