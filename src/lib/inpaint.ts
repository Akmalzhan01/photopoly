/**
 * Erasing something from a photograph and filling the hole with what would
 * plausibly have been behind it — on the device.
 *
 * The model is MI-GAN (Picsart AI Research, ICCV 2023, MIT licence), built for
 * phones: about 28 MB, against two hundred for LaMa, and quick enough to feel
 * like a brush rather than a job. The export used is the authors' own
 * "pipeline" graph, which does the fiddly parts itself — it finds the painted
 * region, crops a window around it, fills that at the network's resolution and
 * blends the result back — so a small mark on a twelve-megapixel photo is
 * filled at full detail rather than at whatever 512 pixels of the whole frame
 * could hold.
 *
 * On a GTX 1060 the first stroke takes about three seconds while WebGPU
 * compiles its shaders, and every one after about a third of a second. The
 * CPU fallback is near three seconds each.
 *
 * Like the upscaler, this invents. It belongs nowhere near a document photo.
 */

import { loadModel } from "./onnx";

/** Kept in step with `public/sw.js`, which caches `/models/` with the runtime. */
const MODEL_URL = "/models/migan/migan_pipeline_v2.onnx";

/**
 * The longest side a photo is worked at. Every pass reads and writes the whole
 * frame as tensors, so this bounds both memory and the cost of each stroke.
 */
export const MAX_EDGE = 4000;

export function loadEraser() {
  return loadModel(MODEL_URL);
}

/**
 * Fills whatever is painted on `mask` (any pixel with alpha) in `image`.
 *
 * Both canvases must be the same size. Returns the whole frame; the model
 * leaves everything outside the painted region exactly as it was.
 */
export async function erase(image: HTMLCanvasElement, mask: HTMLCanvasElement): Promise<ImageData> {
  const { ort, session } = await loadEraser();
  const W = image.width;
  const H = image.height;
  const plane = W * H;

  const rgba = image.getContext("2d", { willReadFrequently: true })!.getImageData(0, 0, W, H).data;
  const painted = mask.getContext("2d", { willReadFrequently: true })!.getImageData(0, 0, W, H).data;

  const chw = new Uint8Array(3 * plane);
  // The model's convention: 255 keeps a pixel, 0 asks for it to be filled.
  const keep = new Uint8Array(plane);
  for (let i = 0; i < plane; i++) {
    chw[i] = rgba[i * 4];
    chw[plane + i] = rgba[i * 4 + 1];
    chw[2 * plane + i] = rgba[i * 4 + 2];
    keep[i] = painted[i * 4 + 3] > 0 ? 0 : 255;
  }

  const outputs = await session.run({
    image: new ort.Tensor("uint8", chw, [1, 3, H, W]),
    mask: new ort.Tensor("uint8", keep, [1, 1, H, W]),
  });
  const result = outputs[session.outputNames[0]];
  const data = result.data as Uint8Array;

  const out = new ImageData(W, H);
  for (let i = 0; i < plane; i++) {
    out.data[i * 4] = data[i];
    out.data[i * 4 + 1] = data[plane + i];
    out.data[i * 4 + 2] = data[2 * plane + i];
    // Transparency is not something the model sees; keep the photo's own.
    out.data[i * 4 + 3] = rgba[i * 4 + 3];
  }
  result.dispose();
  return out;
}
