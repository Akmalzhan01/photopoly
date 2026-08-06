/**
 * The sRGB colour profile, as bytes, in the two shapes the image formats want.
 *
 * This is the very profile Chrome stamps into a canvas JPEG or WebP. Taking it
 * rather than shipping a different sRGB profile is deliberate: it means a PNG,
 * a JPEG and a WebP exported from the same photograph all claim exactly the
 * same colour space, so a print shop cannot get three answers from one studio.
 *
 * 456 bytes raw; 250 once deflated, which is the form a PNG `iCCP` chunk takes.
 * Both are stored pre-encoded so tagging stays synchronous — the alternative,
 * compressing at runtime with `CompressionStream`, would drag an async step
 * into every export for no gain.
 */

const RAW_BASE64 =
  "AAAByAAAAAAEMAAAbW50clJHQiBYWVogB+AAAQABAAAAAAAAYWNzcAAAAAAAAAAAAAAAAAAAAAAA" +
  "AAAAAAAAAAAAAAEAAPbWAAEAAAAA0y0AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
  "AAAAAAAAAAAAAAAAAAAAAAAJZGVzYwAAAPAAAAAkclhZWgAAARQAAAAUZ1hZWgAAASgAAAAUYlhZ" +
  "WgAAATwAAAAUd3RwdAAAAVAAAAAUclRSQwAAAWQAAAAoZ1RSQwAAAWQAAAAoYlRSQwAAAWQAAAAo" +
  "Y3BydAAAAYwAAAA8bWx1YwAAAAAAAAABAAAADGVuVVMAAAAIAAAAHABzAFIARwBCWFlaIAAAAAAA" +
  "AG+iAAA49QAAA5BYWVogAAAAAAAAYpkAALeFAAAY2lhZWiAAAAAAAAAkoAAAD4QAALbPWFlaIAAA" +
  "AAAAAPbWAAEAAAAA0y1wYXJhAAAAAAAEAAAAAmZmAADypwAADVkAABPQAAAKWwAAAAAAAAAAbWx1" +
  "YwAAAAAAAAABAAAADGVuVVMAAAAgAAAAHABHAG8AbwBnAGwAZQAgAEkAbgBjAC4AIAAyADAAMQA2";

const DEFLATED_BASE64 =
  "eNqVkK1Ow1AYhp8DS/gJC4IJxMQREzOQMUEQU0M0uKWDZB2qPetqtrY5LeEGwCGwODKzO4BbwEFC" +
  "gkBxCYQENDltyJmZ4FVPnrzi/T4QTwCVFkzjXLtOVw68oVz7QCAo4qssZXkE/LyV3dc9/p+NUZgp" +
  "4BNo6IE3BFEDalHJTcNByR3Dl3mag+gZ1qfuMYgR0IwWOFhglWrTvwE608mFsrvZCuOzPrAO1Mlw" +
  "ceia+8tKMoOjb1i9tS64g8dr2H23rnEP21fw8Gyd/Unqa79QFWBlPIavOVQ92HmBzfO/RyzZJott" +
  "DgkJERNCJCfEKPaRtGlxwOEvptY/Pw==";

/** Byte view backed by a plain ArrayBuffer, which is what `Blob` accepts. */
type Bytes = Uint8Array<ArrayBuffer>;

function decode(base64: string): Bytes {
  const binary = atob(base64);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
  return out;
}

// Decoded on first use rather than at import: these modules are pulled in by
// server-rendered pages too, and `atob` has no business running there.
let raw: Bytes | null = null;
let deflated: Bytes | null = null;

/** The profile as an ICC file — what a JPEG `APP2` segment carries. */
export function srgbProfile(): Bytes {
  return (raw ??= decode(RAW_BASE64));
}

/** The same profile, zlib-deflated — what a PNG `iCCP` chunk carries. */
export function srgbProfileDeflated(): Bytes {
  return (deflated ??= decode(DEFLATED_BASE64));
}
