// Simple PWA service worker — production would use Workbox/Serwist
const CACHE = "kredit-v1";
const ASSETS = ["/", "/fr", "/en", "/nl", "/de", "/manifest.json"];
self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(()=> self.skipWaiting()));
});
self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then(keys=> Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=> self.clients.claim()));
});
self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  if (url.pathname.startsWith("/api/")) return; // network only for API
  e.respondWith(
    fetch(e.request).then(res=> {
      const copy = res.clone();
      caches.open(CACHE).then(c=> c.put(e.request, copy));
      return res;
    }).catch(()=> caches.match(e.request).then(m=> m || caches.match("/fr")))
  );
});
