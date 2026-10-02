// Plays offline (Offline.js registers this): every file the game loads is
// kept, fresh from the network when there is one, from the keep when there
// isn't. The page also hands over the list of everything it loaded, so it's
// all kept after the first visit.
const CACHE = "fluffy-industries-v1";

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));

self.addEventListener("message", (e) => {
  const d = e.data || {};
  if (d.type !== "keep" || !Array.isArray(d.urls)) return;
  e.waitUntil(
    caches.open(CACHE).then((cache) =>
      Promise.all(
        d.urls
          .filter((u) => typeof u === "string" && u.startsWith(self.location.origin))
          .map((u) =>
            cache.match(u).then((hit) =>
              hit
                ? null
                : fetch(u)
                    .then((res) => (res && res.status === 200 ? cache.put(u, res) : null))
                    .catch(() => null),
            ),
          ),
      ),
    ),
  );
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  let url;
  try {
    url = new URL(req.url);
  } catch (err) {
    return;
  }
  if (url.origin !== self.location.origin) return;
  e.respondWith(
    (async () => {
      const cache = await caches.open(CACHE);
      try {
        const res = await fetch(req);
        if (res && res.status === 200) cache.put(req, res.clone()).catch(() => {});
        return res;
      } catch (err) {
        const hit = (await cache.match(req)) || (await cache.match(req, { ignoreSearch: true }));
        if (hit) return hit;
        if (req.mode === "navigate") {
          const page = (await cache.match("./index.html", { ignoreSearch: true })) || (await cache.match("./", { ignoreSearch: true }));
          if (page) return page;
        }
        throw err;
      }
    })(),
  );
});
