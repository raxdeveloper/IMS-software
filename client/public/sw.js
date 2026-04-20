/* Ophthalmic IMS — cache-first static, network-first API GET with cache fallback */
const STATIC_CACHE = "ims-static-v1";
const API_CACHE = "ims-api-get-v1";

const PRECACHE_URLS = ["/", "/index.html", "/manifest.json", "/favicon.svg", "/icons/icon-192.png", "/icons/icon-512.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => cache.addAll(PRECACHE_URLS)).then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.map((k) => {
          if (k !== STATIC_CACHE && k !== API_CACHE) return caches.delete(k);
          return Promise.resolve();
        }),
      ),
    ).then(() => self.clients.claim()),
  );
});

function isApiRequest(url) {
  return url.pathname.startsWith("/api/");
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  const url = new URL(req.url);
  if (req.method !== "GET") {
    return;
  }

  if (isApiRequest(url)) {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          if (res.ok) {
            caches.open(API_CACHE).then((c) => c.put(req, copy)).catch(() => {});
          }
          return res;
        })
        .catch(() =>
          caches.match(req).then((cached) => {
            if (cached) return cached;
            return new Response(
              JSON.stringify({
                error: "offline",
                message: "No internet connection",
              }),
              { status: 503, headers: { "Content-Type": "application/json" } },
            );
          }),
        ),
    );
    return;
  }

  if (url.origin !== self.location.origin) {
    return;
  }

  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached;
      return fetch(req)
        .then((res) => {
          if (res.ok && (url.pathname.endsWith(".js") || url.pathname.endsWith(".css") || url.pathname.match(/\.(woff2?|ttf)$/))) {
            const copy = res.clone();
            caches.open(STATIC_CACHE).then((c) => c.put(req, copy)).catch(() => {});
          }
          return res;
        })
        .catch(() => caches.match("/index.html"));
    }),
  );
});

self.addEventListener("sync", (event) => {
  if (event.tag === "ims-sync") {
    event.waitUntil(Promise.resolve());
  }
});
