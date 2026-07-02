/* Simple versioned service worker for SDA Contribute PWA.
 * - NetworkFirst for HTML navigations (so users get fresh app shell).
 * - CacheFirst for same-origin static assets (images, fonts).
 * - Versioned cache name so updates evict old caches.
 */
const VERSION = "v1.3.4-report-title";
const STATIC_CACHE = `sda-static-${VERSION}`;
const RUNTIME_CACHE = `sda-runtime-${VERSION}`;

const PRECACHE_URLS = [
  "/",
  "/manifest.webmanifest",
  "/sdaLogo.png",
  "/sda_clean_super.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(STATIC_CACHE)
      .then((cache) => cache.addAll(PRECACHE_URLS).catch(() => undefined))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys();
      await Promise.all(
        names
          .filter((n) => n.startsWith("sda-") && n !== STATIC_CACHE && n !== RUNTIME_CACHE)
          .map((n) => caches.delete(n)),
      );
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("message", (event) => {
  if (event.data === "SKIP_WAITING") self.skipWaiting();
});

function isStaticAsset(url) {
  return /\.(?:png|jpg|jpeg|gif|svg|webp|ico|woff2?|ttf|otf|css|js)$/i.test(url.pathname);
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // Never cache API / auth / supabase calls
  if (url.pathname.startsWith("/api/") || url.pathname.startsWith("/_server")) return;

  // NetworkFirst for navigations
  if (req.mode === "navigate") {
    event.respondWith(
      (async () => {
        try {
          const fresh = await fetch(req);
          const cache = await caches.open(RUNTIME_CACHE);
          cache.put(req, fresh.clone()).catch(() => undefined);
          return fresh;
        } catch {
          const cached = await caches.match(req);
          return cached || caches.match("/") || Response.error();
        }
      })(),
    );
    return;
  }

  // CacheFirst for static assets
  if (isStaticAsset(url)) {
    event.respondWith(
      (async () => {
        const cached = await caches.match(req);
        if (cached) return cached;
        try {
          const fresh = await fetch(req);
          const cache = await caches.open(STATIC_CACHE);
          cache.put(req, fresh.clone()).catch(() => undefined);
          return fresh;
        } catch {
          return cached || Response.error();
        }
      })(),
    );
  }
});
