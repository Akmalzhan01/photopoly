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

/** Kept in step with `public/sw.js`; a stale prefix silently reports "not ready". */
const CACHE_PREFIX = "photopoly-";

export type Readiness =
  /** No worker, or the editor is not stored yet. */
  | "none"
  /**
   * Stored, but this tab is not going through the worker.
   *
   * A worker cannot intercept the visit that installed it, and `clients.claim()`
   * does not reliably change that. So anything this tab fetches from here on —
   * the segmentation model above all — bypasses the cache entirely. One reload
   * fixes it, and nothing else will.
   */
  | "reload"
  /** Going through the worker, editor stored, model still missing. */
  | "partial"
  /** Everything the studio needs is on the device. */
  | "full";

async function cacheNamed(fragment: string): Promise<Cache | null> {
  const names = await caches.keys();
  const match = names.find((name) => name.startsWith(CACHE_PREFIX + fragment));
  return match ? caches.open(match) : null;
}

export async function checkReadiness(): Promise<Readiness> {
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
    const weights = model ? (await model.keys()).length > 0 : false;
    if (weights) return "full";

    // Order matters: an uncontrolled tab cannot fetch the model *into* the
    // cache, so telling it to process a photo would be advice that cannot work.
    return navigator.serviceWorker?.controller ? "partial" : "reload";
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
  reload: {
    label: "Офлайн: нужна перезагрузка",
    title:
      "Редактор сохранён. Обновите страницу (F5) при работающем интернете — после этого удаление фона тоже станет доступно без связи",
  },
  partial: {
    label: "Офлайн без удаления фона",
    title:
      "Редактор откроется без интернета, но удаление фона — нет. Обработайте одно фото со связью, чтобы модель сохранилась",
  },
  full: {
    label: "Офлайн готов",
    title: "Редактор и модель на устройстве — можно работать без интернета",
  },
};
