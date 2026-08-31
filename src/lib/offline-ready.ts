/**
 * Whether the editor would actually survive losing the connection.
 *
 * This exists because the answer is not obvious and getting it wrong is
 * expensive: "not ready yet" and "does not work" look identical from the
 * outside, and somebody who unplugs too early concludes the second.
 *
 * Read straight from the Cache API rather than from a flag the app sets
 * hopefully — what matters is what is genuinely on the device, not what we
 * believe we asked for.
 */

import type { ModelQuality } from "./cutout";

/** Kept in step with `public/sw.js`; a stale prefix silently reports "not ready". */
const CACHE_PREFIX = "photopoly-";

/** Mirrors `cutout.ts`; the manifest keys the weights by these names. */
const MODEL_BY_QUALITY: Record<ModelQuality, string> = {
  fast: "isnet_quint8",
  fine: "isnet_fp16",
};

export type Readiness =
  /** The editor itself is not stored yet. */
  | "none"
  /** The editor opens offline, but the weights are not all here yet. */
  | "partial"
  /** Everything the studio needs is on the device. */
  | "full";

async function cacheNamed(fragment: string): Promise<Cache | null> {
  const names = await caches.keys();
  const match = names.find((name) => name.startsWith(CACHE_PREFIX + fragment));
  return match ? caches.open(match) : null;
}

/**
 * Whether the weights for one model are genuinely all there.
 *
 * "The cache is not empty" is not the same question, and answering that one
 * instead is how this badge came to report `Офлайн готов` when the only thing
 * stored was the manifest — the very failure it exists to prevent. So the
 * manifest is read back out of the cache and every chunk it names is checked.
 *
 * The runtime is a family of builds — simd, threaded, jsep — and which one a
 * browser picks depends on what it supports. Any one of them complete is
 * enough; demanding a particular one would report "not ready" forever on the
 * browsers that chose differently.
 */
async function weightsReady(cache: Cache, quality: ModelQuality): Promise<boolean> {
  const stored = await cache.keys();
  const manifestRequest = stored.find((request) => request.url.endsWith("resources.json"));
  if (!manifestRequest) return false;

  const manifest = await cache.match(manifestRequest);
  if (!manifest) return false;

  const map: Record<string, { chunks?: { name: string }[] }> = await manifest.json();
  const base = manifestRequest.url.replace(/resources\.json$/, "");
  const urlsFor = (key: string) => (map[key]?.chunks ?? []).map((chunk) => base + chunk.name);
  const held = new Set(stored.map((request) => request.url));

  const weights = urlsFor(`/models/${MODEL_BY_QUALITY[quality]}`);
  if (weights.length === 0 || !weights.every((url) => held.has(url))) return false;

  return Object.keys(map)
    .filter((key) => key.startsWith("/onnxruntime-web/"))
    .some((key) => {
      const chunks = urlsFor(key);
      return chunks.length > 0 && chunks.every((url) => held.has(url));
    });
}

export async function checkReadiness(quality: ModelQuality): Promise<Readiness> {
  if (typeof window === "undefined" || !("caches" in window)) return "none";

  try {
    const pages = await cacheNamed("pages");
    // `ignoreVary` for the same reason the worker uses it: the stored copy was
    // fetched as a plain request, this one is not, and Next varies on router
    // headers that have nothing to do with the bytes.
    const studio = pages ? await pages.match("/studio", { ignoreVary: true }) : undefined;
    if (!studio) return "none";

    const assets = await cacheNamed("assets");
    // The page without its scripts is a blank screen, so it does not count.
    const scripts = assets
      ? (await assets.keys()).some((request) => request.url.includes("/_next/static/"))
      : false;
    if (!scripts) return "none";

    const model = await cacheNamed("model");
    return model && (await weightsReady(model, quality)) ? "full" : "partial";
  } catch {
    // A browser that refuses the Cache API cannot promise anything offline.
    return "none";
  }
}

export const READINESS_COPY: Record<Readiness, { label: string; title: string }> = {
  none: {
    label: "Офлайн не готов",
    title: "Сохраняем редактор на устройство — подождите несколько секунд",
  },
  partial: {
    label: "Офлайн без удаления фона",
    title:
      "Редактор откроется без интернета, но удаление фона — нет: модель ещё скачивается. Не отключайтесь, пока не появится «Офлайн готов»",
  },
  full: {
    label: "Офлайн готов",
    title: "Редактор и модель на устройстве — можно работать без интернета",
  },
};
