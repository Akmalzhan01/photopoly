/**
 * Enlarging a photograph with a neural network, on the device.
 *
 * This is the one place in the app that *does* invent. Real-ESRGAN was trained
 * to turn small, compressed pictures into the larger ones they came from, so it
 * draws edges, texture and fine detail that the file no longer holds — which is
 * exactly why it looks so much better than resampling, and exactly why it is
 * kept off the document-photo path (see `enhance.ts`). A face it enlarges is a
 * plausible face, not necessarily the same one.
 *
 * ## The model
 *
 * `realesr-general-x4v3`: the compact Real-ESRGAN, about 1.2 million
 * parameters and under 5 MB, trained for real photographs rather than anime.
 * The export is Qualcomm AI Hub's, which fixes the input at 128 × 128 — a
 * fixed shape is what every backend handles best anyway — and the output at
 * 512 × 512. The weights are served from this app, the runtime from a CDN at
 * a pinned version; both are cached by the service worker after first use.
 *
 * The file served is not quite that export. onnxruntime-web 1.21 has no PRelu
 * on WebGPU, and this network is thirty-three of them between thirty-four
 * convolutions — so every layer went to the CPU and back, and a GTX 1060 took
 * 505 ms a window, barely ahead of the CPU's 2 s. `scripts/rewrite-prelu.py`
 * spells each one out as relu(x) + a·(x − relu(x)), which WebGPU has, with
 * output identical to the bit: 75 ms a window. It also embeds the weights, so
 * there is one file to fetch rather than a graph and its data.
 *
 * ## Tiles
 *
 * A picture of any size is cut into 128-pixel windows that overlap by
 * `PAD` on every side. Only each window's centre is kept: a convolution near
 * the edge of its input sees padding rather than picture, and those borders
 * are where seams would show. Past the picture's own edge the outermost pixels
 * are repeated, which is what the reference implementation does too.
 *
 * Measured on three photographs shrunk to 320 px and saved at JPEG quality 60,
 * then enlarged back ×4: no seam is visible at the joins, compression blocks
 * are gone, and edges come back crisp where Lanczos leaves them soft. PSNR
 * against the originals is a little *lower* than Lanczos (31.5 against
 * 33.4 dB on the most detailed) — the usual trade for a generative upscaler,
 * which is sharper than the truth rather than blurrier than it.
 */

import type { Tensor } from "onnxruntime-web";
import { MAX_EDGE } from "./imaging";
import { loadModel, type Backend } from "./onnx";

/** Kept in step with `public/sw.js`, which caches `/models/` with the runtime. */
const MODEL_URL = "/models/real-esrgan/realesr-general-x4v3-webgpu.onnx";

/** The network's input window, and how much it enlarges. Fixed by the export. */
const TILE = 128;
const FACTOR = 4;
/** Overlap kept on every side of a window and then thrown away. */
const PAD = 12;
const STEP = TILE - 2 * PAD;

/**
 * The largest photograph accepted, in pixels.
 *
 * Set by time rather than memory: two megapixels is about two hundred windows,
 * fifteen seconds on a five-year-old GPU and several minutes on a CPU without
 * WebGPU. Beyond that the picture is rarely the kind that needs this.
 */
export const MAX_INPUT_PIXELS = 2_000_000;

export const UPSCALE_FACTORS = [2, 4] as const;
export type UpscaleFactor = (typeof UPSCALE_FACTORS)[number];

/** Loads the runtime and the weights once per page; later calls share it. */
export function loadUpscaler() {
  return loadModel(MODEL_URL);
}

export type Size = { w: number; h: number };

export function upscaledSize(source: Size, factor: UpscaleFactor): Size {
  return { w: source.w * factor, h: source.h * factor };
}

/** Why a picture cannot be enlarged by this much, or null when it can. */
export function refusal(source: Size, factor: UpscaleFactor): string | null {
  if (source.w * source.h > MAX_INPUT_PIXELS) {
    return `Фото уже крупное (${source.w} × ${source.h}). Нейросеть увеличивает снимки до ${MAX_INPUT_PIXELS / 1_000_000} Мп.`;
  }
  const out = upscaledSize(source, factor);
  if (Math.max(out.w, out.h) > MAX_EDGE) {
    return `При ×${factor} сторона выйдет ${Math.max(out.w, out.h)} px — больше предела в ${MAX_EDGE}. Выберите ×2.`;
  }
  return null;
}

export function tileCount(source: Size): number {
  return Math.ceil(source.w / STEP) * Math.ceil(source.h / STEP);
}

export type Progress = { done: number; total: number; elapsed: number; backend: Backend };

function aborted(): DOMException {
  return new DOMException("Отменено", "AbortError");
}

/**
 * Enlarges `source` by `factor` and returns the result on a canvas.
 *
 * ×2 runs the same ×4 network and halves each window as it lands, so the
 * full ×4 picture never has to exist in memory at once. Windows are aligned so
 * that every kept centre is a whole number of pixels at both scales, which is
 * what keeps the halving from leaving seams of its own.
 */
export async function upscale(
  source: CanvasImageSource & { width: number; height: number },
  factor: UpscaleFactor,
  onProgress?: (progress: Progress) => void,
  signal?: AbortSignal,
): Promise<HTMLCanvasElement> {
  const { ort, session, backend } = await loadUpscaler();
  if (signal?.aborted) throw aborted();

  const { width: W, height: H } = source;
  const reader = document.createElement("canvas");
  reader.width = W;
  reader.height = H;
  const readCtx = reader.getContext("2d", { willReadFrequently: true });
  if (!readCtx) throw new Error("Canvas unavailable");
  readCtx.drawImage(source, 0, 0, W, H);
  const pixels = readCtx.getImageData(0, 0, W, H).data;

  let transparent = false;
  for (let i = 3; i < pixels.length; i += 4) {
    if (pixels[i] < 255) {
      transparent = true;
      break;
    }
  }

  const result = document.createElement("canvas");
  result.width = W * factor;
  result.height = H * factor;
  const ctx = result.getContext("2d");
  if (!ctx) throw new Error("Canvas unavailable");
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";

  const OUT = TILE * FACTOR;
  const KEEP = STEP * FACTOR;
  const window = new Float32Array(3 * TILE * TILE);
  const plane = TILE * TILE;
  const piece = new ImageData(KEEP, KEEP);
  // Only needed for ×2: the ×4 centre is put here, then drawn at half size.
  const stage = factor === FACTOR ? null : document.createElement("canvas");
  if (stage) {
    stage.width = KEEP;
    stage.height = KEEP;
  }
  const stageCtx = stage?.getContext("2d") ?? null;

  const cols = Math.ceil(W / STEP);
  const rows = Math.ceil(H / STEP);
  const total = cols * rows;
  const started = performance.now();
  let done = 0;

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      if (signal?.aborted) throw aborted();

      const x0 = col * STEP - PAD;
      const y0 = row * STEP - PAD;
      for (let y = 0; y < TILE; y++) {
        const sy = Math.min(H - 1, Math.max(0, y0 + y));
        for (let x = 0; x < TILE; x++) {
          const sx = Math.min(W - 1, Math.max(0, x0 + x));
          const at = (sy * W + sx) * 4;
          const to = y * TILE + x;
          window[to] = pixels[at] / 255;
          window[plane + to] = pixels[at + 1] / 255;
          window[2 * plane + to] = pixels[at + 2] / 255;
        }
      }

      const input = new ort.Tensor("float32", window, [1, 3, TILE, TILE]);
      const outputs = await session.run({ [session.inputNames[0]]: input });
      const output = outputs[session.outputNames[0]] as Tensor;
      const data = output.data as Float32Array;

      // The kept centre, cropped where it runs past the picture's edge.
      const keepW = Math.min(STEP, W - col * STEP) * FACTOR;
      const keepH = Math.min(STEP, H - row * STEP) * FACTOR;
      const target = piece.data;
      for (let y = 0; y < keepH; y++) {
        const from = (PAD * FACTOR + y) * OUT + PAD * FACTOR;
        for (let x = 0; x < keepW; x++) {
          const at = from + x;
          const to = (y * KEEP + x) * 4;
          target[to] = Math.max(0, Math.min(255, data[at] * 255 + 0.5));
          target[to + 1] = Math.max(0, Math.min(255, data[OUT * OUT + at] * 255 + 0.5));
          target[to + 2] = Math.max(0, Math.min(255, data[2 * OUT * OUT + at] * 255 + 0.5));
          target[to + 3] = 255;
        }
      }
      output.dispose();

      const left = col * STEP;
      const top = row * STEP;
      if (stageCtx && stage) {
        stageCtx.putImageData(piece, 0, 0, 0, 0, keepW, keepH);
        const scale = factor / FACTOR;
        ctx.drawImage(stage, 0, 0, keepW, keepH, left * factor, top * factor, keepW * scale, keepH * scale);
      } else {
        ctx.putImageData(piece, left * FACTOR, top * FACTOR, 0, 0, keepW, keepH);
      }

      done++;
      onProgress?.({ done, total, elapsed: performance.now() - started, backend });
      // On the CPU each window holds the main thread for a second or so;
      // letting a frame through between them keeps the progress bar moving.
      if (backend === "wasm") await new Promise((resolve) => setTimeout(resolve, 0));
    }
  }

  // The network sees colour only. Transparency is carried over by enlarging
  // the original's alpha the ordinary way and cutting the result to it.
  if (transparent) {
    ctx.globalCompositeOperation = "destination-in";
    ctx.drawImage(source, 0, 0, result.width, result.height);
    ctx.globalCompositeOperation = "source-over";
  }

  return result;
}
