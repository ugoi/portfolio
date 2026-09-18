// One-time retirement of this site's old cache-first portfolio worker.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      for (const key of await caches.keys()) {
        if (key.startsWith("stefan-portfolio-")) await caches.delete(key);
      }
      await self.clients.claim();
      await self.registration.unregister();
    })(),
  );
});
