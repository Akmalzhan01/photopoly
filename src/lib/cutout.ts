export type ModelQuality = "fast" | "fine";

export type Progress = { label: string; ratio: number };

/** isnet_quint8 downloads roughly a quarter of what fp16 does, at some edge quality. */
const MODEL_BY_QUALITY = {
  fast: "isnet_quint8",
  fine: "isnet_fp16",
} as const;

function describe(key: string): string {
  if (key.startsWith("fetch")) return "Загрузка модели";
  if (key.startsWith("compute")) return "Удаление фона";
  return "Подготовка";
}

/**
 * Where the weights are stored for offline use.
 *
 * The library does **not** cache them — it refetches on every cold start — so
 * the service worker serves them from here, and `cacheModel` below is what puts
 * them there. The name is shared with `public/sw.js` and `offline-ready.ts`;
 * changing it in one place silently breaks offline background removal.
 */
const MODEL_CACHE = "photopoly-model";
const MODEL_HOST = "staticimgly.com";

/**
 * Downloads the weights and keeps them, so background removal survives losing
 * the connection.
 *
 * The obvious approach — let the service worker cache them as they fly past —
 * does not work when it matters most: a worker cannot intercept the visit that
 * registered it, so on a first visit the model bypasses the cache entirely and
 * the shop is offline-capable only from the visit after. Doing it here works on
 * the first visit and needs no worker at all.
 *
 * `fetch` is wrapped rather than the URLs guessed. The library resolves them
 * from a manifest at runtime and does not expose the result, so the only honest
 * way to learn what it downloaded is to watch it download. The wrapper stores
 * the bytes already in flight instead of asking for them a second time, which
 * on a shop's connection is the difference that matters.
 */
export async function cacheModel(quality: ModelQuality): Promise<void> {
  if (typeof window === "undefined" || !("caches" in window)) return;

  const cache = await caches.open(MODEL_CACHE);
  const original = window.fetch;

  window.fetch = async (input, init) => {
    const response = await original(input, init);
    try {
      const url =
        typeof input === "string"
          ? input
          : input instanceof Request
            ? input.url
            : String(input);
      if (response.ok && url.includes(MODEL_HOST)) {
        await cache.put(url, response.clone());
      }
    } catch {
      // A failed store costs offline background removal, not this run.
    }
    return response;
  };

  try {
    const { preload } = await import("@imgly/background-removal");
    await preload({ model: MODEL_BY_QUALITY[quality] });
  } finally {
    // Restored even if preload throws: leaving a wrapper on the global fetch
    // would outlive the reason for it.
    window.fetch = original;
  }
}

/**
 * Runs the segmentation model in the browser. The weights come from a CDN on
 * first use; `cacheModel` is what keeps them for later.
 */
export async function removeBackground(
  image: Blob,
  quality: ModelQuality,
  onProgress?: (progress: Progress) => void,
): Promise<Blob> {
  const { removeBackground: run } = await import("@imgly/background-removal");

  return run(image, {
    model: MODEL_BY_QUALITY[quality],
    output: { format: "image/png" },
    progress: (key: string, current: number, total: number) => {
      onProgress?.({
        label: describe(key),
        ratio: total > 0 ? Math.min(1, current / total) : 0,
      });
    },
  });
}
