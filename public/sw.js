/**
 * Offline support.
 *
 * Everything this app does happens on the device, so the only thing standing
 * between it and working with no connection is fetching its own assets and the
 * segmentation model. Both are content-addressed and safe to keep forever, so
 * they are cached on first use and served from cache thereafter.
 *
 * What is deliberately *not* cached: rendered HTML. Since accounts arrived, the
 * studio, account and admin pages carry one particular person's data, and a
 * shared cache on a shared computer would hand it to whoever browsed next. The
 * app shell is JS and CSS, which is cached; the personalised part is fetched
 * fresh every time or not at all.
 */

/**
 * Bump this whenever anything cached under an *unhashed* URL changes.
 *
 * Next.js fingerprints its own JS and CSS, so those correct themselves. The
 * offline page and the web manifest do not: they are fetched by a fixed path
 * and served cache-first, so without a bump an installed PWA keeps the old
 * copies indefinitely. v3 is the switch to Russian — v2 held the Uzbek offline
 * page and an Uzbek app name on the home screen.
 */
const VERSION = "v3";
const SHELL = `photopoly-shell-${VERSION}`;
const ASSETS = `photopoly-assets-${VERSION}`;
const MODEL = `photopoly-model-${VERSION}`;

/** The segmentation weights, which is the download worth never repeating. */
const MODEL_HOST = "staticimgly.com";

/** Shown when a navigation fails with no connection. Identical for everyone. */
const OFFLINE_URL = "/oflayn";

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(SHELL)
      .then((cache) => cache.addAll([OFFLINE_URL, "/manifest.webmanifest"]))
      .catch(() => undefined)
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          // Drops every older version, including v1 caches that may hold
          // another account's rendered pages.
          keys
            .filter((key) => key.startsWith("photopoly-") && !key.endsWith(VERSION))
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  const hit = await cache.match(request);
  if (hit) return hit;

  const response = await fetch(request);
  // Opaque responses report status 0; storing them would poison the cache.
  if (response.ok) cache.put(request, response.clone());
  return response;
}

/** Never writes to the cache — only reaches for the offline page when the network is gone. */
async function networkOnlyWithFallback(request) {
  try {
    return await fetch(request);
  } catch (error) {
    const cache = await caches.open(SHELL);
    const hit = await cache.match(OFFLINE_URL);
    if (hit) return hit;
    throw error;
  }
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);

  if (url.hostname === MODEL_HOST) {
    event.respondWith(cacheFirst(request, MODEL));
    return;
  }

  if (url.origin !== self.location.origin) return;

  // Next.js fingerprints these, so a cached copy is always the right copy.
  if (
    url.pathname.startsWith("/_next/static/") ||
    /\.(png|svg|ico|webmanifest)$/.test(url.pathname)
  ) {
    event.respondWith(cacheFirst(request, ASSETS));
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(networkOnlyWithFallback(request));
  }
});

/** Logging out clears everything this worker holds, on the account's way out. */
self.addEventListener("message", (event) => {
  if (event.data === "photopoly:signout") {
    event.waitUntil(
      caches.keys().then((keys) =>
        Promise.all(
          keys.filter((key) => key.startsWith("photopoly-")).map((key) => caches.delete(key)),
        ),
      ),
    );
  }
});
