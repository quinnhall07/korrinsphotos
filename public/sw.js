// public/sw.js
// Minimal service worker for Korrin's Photography PWA.
// Strategy:
//   - Network-first for /admin/*, /gallery/*, /portal/*, /api/* (always fresh, never serve stale auth/data).
//   - Cache-first for /_next/static/* (immutable build assets — long-lived).
//   - Cache-first with precache fallback for public routes (/, /booking, /portfolio).

const CACHE_VERSION = "korrin-v1";
const PRECACHE_URLS = ["/", "/booking", "/portfolio"];

// Install: precache the public shell so first visit can warm the cache.
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) => cache.addAll(PRECACHE_URLS)).catch(() => {})
  );
  self.skipWaiting();
});

// Activate: claim clients immediately and drop any stale caches from prior versions.
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Fetch: route by URL pattern.
self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return; // never cache mutations
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // skip cross-origin (CDN images handle themselves)

  const path = url.pathname;

  // Network-first for anything auth-gated or API. Never serve stale.
  if (
    path.startsWith("/admin") ||
    path.startsWith("/gallery") ||
    path.startsWith("/portal") ||
    path.startsWith("/api")
  ) {
    event.respondWith(fetch(req).catch(() => caches.match(req)));
    return;
  }

  // Cache-first for immutable Next.js build assets.
  if (path.startsWith("/_next/static/")) {
    event.respondWith(
      caches.match(req).then((hit) =>
        hit ||
        fetch(req).then((res) => {
          const copy = res.clone();
          caches.open(CACHE_VERSION).then((c) => c.put(req, copy)).catch(() => {});
          return res;
        })
      )
    );
    return;
  }

  // Cache-first with network fallback for public pages.
  event.respondWith(
    caches.match(req).then((hit) =>
      hit ||
      fetch(req).then((res) => {
        if (res.ok) {
          const copy = res.clone();
          caches.open(CACHE_VERSION).then((c) => c.put(req, copy)).catch(() => {});
        }
        return res;
      }).catch(() => caches.match("/"))
    )
  );
});
