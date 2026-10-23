// Service worker : app shell en cache, mise à jour sans manœuvre manuelle.
// Stratégie : réseau d'abord pour HTML/JS/CSS (une correction déployée arrive au
// rechargement suivant), cache en secours pour tenir hors ligne.
const CACHE = 'frigo-shell-v4';
const ASSETS = [
  './',
  './index.html',
  './styles.css',
  './js/app.js',
  './js/model.js',
  './js/cerfa.js',
  './js/bilan.js',
  './js/trackdechets.js',
  './js/settings.js',
  './manifest.webmanifest',
];
const NETWORK_FIRST = /\/(index\.html)?$|\.(js|css|webmanifest)$/i;

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    await cache.addAll(ASSETS);
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  const networkFirst = request.mode === 'navigate' || NETWORK_FIRST.test(url.pathname);

  if (networkFirst) {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE);
      try {
        const fresh = await fetch(request);
        if (fresh && fresh.status === 200) {
          cache.put(request.mode === 'navigate' ? './index.html' : request, fresh.clone());
        }
        return fresh;
      } catch {
        const hit = (request.mode === 'navigate')
          ? (await cache.match('./index.html')) || (await cache.match('./'))
          : await cache.match(request);
        return hit || Response.error();
      }
    })());
    return;
  }

  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const hit = await cache.match(request);
    if (hit) return hit;
    try {
      const fresh = await fetch(request);
      if (fresh && fresh.status === 200 && fresh.type === 'basic') cache.put(request, fresh.clone());
      return fresh;
    } catch {
      return Response.error();
    }
  })());
});
