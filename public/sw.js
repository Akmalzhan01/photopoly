/**
 * Offline support.
 *
 * Everything this app does happens on the device, so the only thing standing
 * between it and working with no connection is having its own assets, the
 * segmentation model and the editor's page on hand. Those are cached on first
 * use and served from cache thereafter.
 *
 * What is deliberately *not* cached: any page carrying one person's data. The
 * account, till, orders and admin pages are fetched fresh every time or not at
 * all, because a shared cache on a shared computer would hand the last
 * operator's figures to whoever browsed next.
 *
 * The studio is the exception, and only because it was changed to earn it: the
 * allowance no longer renders into its HTML, so the markup is now byte-for-byte
 * the same for every account. Nothing personal is stored by storing it. That is
 * a property of the page, not a promise made here — `CACHEABLE_PAGES` must not
 * grow to include a page that has not been checked the same way.
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
const VERSION = "v4";
const SHELL = `photopoly-shell-${VERSION}`;
const ASSETS = `photopoly-assets-${VERSION}`;
const MODEL = `photopoly-model-${VERSION}`;
const PAGES = `photopoly-pages-${VERSION}`;

/** The segmentation weights, which is the download worth never repeating. */
const MODEL_HOST = "staticimgly.com";

/** Attire cut-outs, served from the project's storage bucket. */
const ASSET_HOST_SUFFIX = ".supabase.co";

/**
 * Pages whose rendered HTML is identical for every account, and may therefore
 * be kept for offline use.
 *
 * Checked by diffing the markup two different accounts receive. Adding a path
 * here without doing that is how a shared computer starts leaking.
 */
const CACHEABLE_PAGES = new Set(["/studio", "/oflayn"]);

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

/**
 * Fetches the offline-capable pages once, so the first visit is enough.
 *
 * A worker only starts intercepting after the navigation that registered it has
 * already been served, so without this the studio would not be in the cache
 * until the *second* visit — and a shop whose connection dropped after one look
 * at the editor would find nothing there. Signed-out visitors are redirected to
 * the sign-in page, and a redirect is not cached.
 */
async function warmPages() {
  const pages = await caches.open(PAGES);
  const assets = await caches.open(ASSETS);

  await Promise.all(
    [...CACHEABLE_PAGES].map(async (path) => {
      try {
        const response = await fetch(path, { credentials: "same-origin" });
        if (!response.ok || response.redirected) return;

        const html = await response.clone().text();
        await pages.put(path, response);

        // The page alone is not enough to open it. Everything the browser
        // fetched to render this visit went out before the worker existed, so
        // none of it was seen — the scripts and styles have to be pulled in
        // deliberately, from the markup that names them.
        const referenced = new Set(
          [...html.matchAll(/["'(](\/_next\/static\/[^"')\s]+)["')]/g)].map((m) => m[1]),
        );
        await Promise.all(
          [...referenced].map(async (asset) => {
            try {
              if (await assets.match(asset)) return;
              const file = await fetch(asset);
              if (file.ok) await assets.put(asset, file);
            } catch {
              // One missing file should not abandon the rest.
            }
          }),
        );
      } catch {
        // No connection during activation; the next visit will fill this in.
      }
    }),
  );
}

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
      .then(() => self.clients.claim())
      .then(() => warmPages()),
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

/**
 * The network first, the stored copy only when it cannot be reached.
 *
 * Cache-first would be faster, but it would also keep serving a stale editor
 * after a deploy until something evicted it. This way an online shop always
 * gets the current build and an offline one still opens.
 */
async function networkFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  try {
    const response = await fetch(request);
    // A redirect to the sign-in page is a 200 the cache must not keep: storing
    // it would pin every later visit to the login screen.
    if (response.ok && !response.redirected) cache.put(request, response.clone());
    return response;
  } catch (error) {
    // `ignoreVary` because the warmed copy was fetched as a plain request while
    // this one is a navigation, and Next varies on router headers. Ignoring
    // that is only safe because these pages are the same for every account —
    // which is the whole condition for being in `CACHEABLE_PAGES`.
    const hit = await cache.match(request, { ignoreVary: true });
    if (hit) return hit;

    const shell = await caches.open(SHELL);
    const offline = await shell.match(OFFLINE_URL);
    if (offline) return offline;
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

  if (url.hostname.endsWith(ASSET_HOST_SUFFIX)) {
    event.respondWith(cacheFirst(request, ASSETS));
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
    event.respondWith(
      CACHEABLE_PAGES.has(url.pathname)
        ? networkFirst(request, PAGES)
        : networkOnlyWithFallback(request),
    );
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
