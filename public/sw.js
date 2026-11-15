// Service worker: lets the installed app open offline.
// - App code, fonts and icons are cached as you use them (cache-first). Music is never cached here.
// - Pages try the network first and fall back to the last cached page.
// - /api/* is never cached (AI answers always come from the server).
const CACHE = "knowit-v5";

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(["/", "/manifest.webmanifest"])).catch(() => {}));
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then(async (ks) => {
      const old = ks.filter((k) => k !== CACHE);
      await Promise.all(old.map((k) => caches.delete(k)));
      await self.clients.claim();
      // A newer worker replaced an older one: reload any open pages so nobody stays on a stale copy.
      if (old.length) {
        const wins = await self.clients.matchAll({ type: "window" });
        wins.forEach((c) => c.navigate(c.url).catch(() => {}));
      }
    }),
  );
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== location.origin || url.pathname.startsWith("/api/")) return;
  // Music: let the browser handle it. iOS plays audio with byte-range requests and fails if a
  // cached full file is returned instead, so the worker must stay out of the way.
  if (req.destination === "audio" || req.destination === "video" || req.headers.has("range") || url.pathname.startsWith("/music/")) return;

  const isStatic = url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/icons/") || /\.(woff2?|ttf|png|svg|ico)$/.test(url.pathname);
  if (isStatic) {
    e.respondWith(
      caches.match(req).then(
        (hit) =>
          hit ||
          fetch(req).then((res) => {
            if (res.ok) caches.open(CACHE).then((c) => c.put(req, res.clone()));
            return res;
          }),
      ),
    );
    return;
  }

  // pages: network first, cached copy when offline
  e.respondWith(
    fetch(req)
      .then((res) => {
        if (res.ok) caches.open(CACHE).then((c) => c.put(req, res.clone()));
        return res;
      })
      .catch(() => caches.match(req).then((r) => r || caches.match("/"))),
  );
});
