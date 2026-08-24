// Bump CACHE_NAME on every deploy that changes a cached asset.
const CACHE_NAME = "hoppynotes-v5";
const ASSETS = [
  "./",
  "./index.html",
  "./styles.css",
  "./app.js",
  "./manifest.webmanifest",
  "./bunny1.png",
  "./assets/bunny2.png",
  "./assets/bunny3.png",
  "./assets/bunny4.png",
  "./assets/bunny5.png",
  "./assets/brand/icon-192.png",
  "./assets/brand/icon-512.png",
  "./assets/brand/apple-touch-icon.png",
  "./assets/brand/favicon-32.png"
];

// Code and markup must be network-first: a cache-first shell pinned devices
// to an old app.js and no deploy could ever reach them. Images stay
// cache-first since they never change without a new filename.
const CODE_PATH = /\.(?:js|css|webmanifest)$/;

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

function networkFirst(request, cacheKey) {
  return fetch(request)
    .then((response) => {
      if (response && response.ok) {
        const copy = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(cacheKey, copy));
      }
      return response;
    })
    .catch(() => caches.match(cacheKey).then((cached) => cached || caches.match("./index.html")));
}

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") {
    return;
  }

  const url = new URL(request.url);
  // Never touch calls to the verification Worker.
  if (url.origin !== self.location.origin) {
    return;
  }

  // Navigations are cached under a fixed key so unlock links (?admin=,
  // ?session_id=) are never written into the cache with their secrets.
  if (request.mode === "navigate") {
    event.respondWith(networkFirst(request, "./index.html"));
    return;
  }

  if (CODE_PATH.test(url.pathname)) {
    event.respondWith(networkFirst(request, request));
    return;
  }

  event.respondWith(caches.match(request).then((cached) => cached || fetch(request)));
});
