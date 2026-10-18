/**
 * Running an ONNX model in the browser: WebGPU where there is a GPU, WASM
 * where there is not.
 *
 * Shared by the upscaler and the eraser. The runtime comes from a CDN at a
 * pinned version, the weights from this app's `/models/`; the service worker
 * keeps both after first use.
 */

import type { InferenceSession } from "onnxruntime-web";

const ORT_VERSION = "1.21.0";
/** Kept in step with `public/sw.js`, which caches this prefix with the models. */
const RUNTIME_BASE = `https://cdn.jsdelivr.net/npm/onnxruntime-web@${ORT_VERSION}/dist/`;

export type Backend = "webgpu" | "wasm";

export type Engine = {
  ort: typeof import("onnxruntime-web");
  session: InferenceSession;
  backend: Backend;
};

async function bytes(url: string): Promise<Uint8Array> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${url}: ${response.status}`);
  return new Uint8Array(await response.arrayBuffer());
}

type GpuNavigator = Navigator & { gpu?: { requestAdapter(): Promise<unknown | null> } };

async function open(url: string): Promise<Engine> {
  const ort = await import("onnxruntime-web/webgpu");
  ort.env.wasm.wasmPaths = RUNTIME_BASE;
  // Its warnings are about the shape operators it keeps on the CPU — normal,
  // and printed as console errors that look like failures.
  ort.env.logLevel = "error";
  // Threads need a cross-origin-isolated page, which this one is not; asking
  // for them anyway only produces a warning and a fallback.
  ort.env.wasm.numThreads = globalThis.crossOriginIsolated
    ? Math.min(4, navigator.hardwareConcurrency || 1)
    : 1;

  const graph = await bytes(url);
  const options = (backend: Backend): InferenceSession.SessionOptions => ({
    executionProviders: [backend],
    graphOptimizationLevel: "all",
    // The environment's level does not reach the session's own warnings.
    logSeverityLevel: 3,
  });

  // WebGPU is tried only where an adapter really exists: the provider itself
  // happily loads on a machine with no usable GPU and then fails mid-run.
  const gpu = (navigator as GpuNavigator).gpu;
  if (gpu) {
    try {
      if (await gpu.requestAdapter()) {
        const session = await ort.InferenceSession.create(graph, options("webgpu"));
        return { ort, session, backend: "webgpu" };
      }
    } catch {
      // Fall through to the CPU, which always works.
    }
  }
  const session = await ort.InferenceSession.create(graph, options("wasm"));
  return { ort, session, backend: "wasm" };
}

const engines = new Map<string, Promise<Engine>>();

/** Loads a model once per page; later calls for the same URL share it. */
export function loadModel(url: string): Promise<Engine> {
  let engine = engines.get(url);
  if (!engine) {
    engine = open(url).catch((error) => {
      // A failed download must not be remembered as the answer forever.
      engines.delete(url);
      throw error;
    });
    engines.set(url, engine);
  }
  return engine;
}
