// Minimal no-cache service worker.
// This exists to satisfy stale browser registrations from older local builds.
// It intentionally does not cache API responses, uploads, preview videos, or app assets.

self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", () => {
  // Let the browser/network handle every request.
});
