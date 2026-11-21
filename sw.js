// Service Worker FitTrack — semua path relatif terhadap scope, kompatibel dengan GitHub Pages (subpath).
// precache.js dihasilkan oleh `node tools/gen-precache.mjs` (daftar file + versi cache).
importScripts('./precache.js');

const CACHE = 'fittrack-' + self.FT_VERSION;
const scopeURL = (p) => new URL(p, self.registration.scope).href;

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) =>
      Promise.all(self.FT_PRECACHE.map((p) => cache.add(new Request(scopeURL(p), { cache: 'reload' }))))
    ).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('fittrack-') && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // jangan mencegat ChatGPT/Claude/CDN
  if (req.mode === 'navigate') {
    event.respondWith(
      caches.match(scopeURL('index.html')).then((hit) => hit || fetch(req).catch(() => new Response('Offline', { status: 503 })))
    );
    return;
  }
  event.respondWith(
    caches.match(req, { ignoreSearch: true }).then((hit) => hit || fetch(req).then((res) => {
      if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); }
      return res;
    }))
  );
});
