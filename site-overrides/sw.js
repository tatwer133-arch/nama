const CACHE = 'nama-shell-v14';
const APP_SCOPE = self.registration.scope;
const APP_INDEX = new URL('index.html', APP_SCOPE).href;
const APP_ASSETS = [
  APP_SCOPE,
  APP_INDEX,
  new URL('manifest.json', APP_SCOPE).href,
  new URL('icon.svg', APP_SCOPE).href
];

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    await Promise.all(APP_ASSETS.map(async asset => {
      const response = await fetch(asset, { cache: 'reload' });
      if (!response.ok) throw new Error(`Could not precache ${asset}: ${response.status}`);
      await cache.put(asset, response);
    }));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys
      .filter(key => key.startsWith('nama-shell-') && key !== CACHE)
      .map(key => caches.delete(key)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const scopeUrl = new URL(APP_SCOPE);
  const url = new URL(request.url);
  if (url.origin !== scopeUrl.origin || !url.pathname.startsWith(scopeUrl.pathname)) return;

  if (request.mode === 'navigate') {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE);
      try {
        const response = await fetch(request, { cache: 'no-store' });
        if (response.ok) await cache.put(request, response.clone());
        return response;
      } catch {
        return (await cache.match(request)) || (await cache.match(APP_INDEX)) || Response.error();
      }
    })());
    return;
  }

  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const cached = await cache.match(request);
    if (cached) return cached;
    try {
      const response = await fetch(request);
      if (response.ok) await cache.put(request, response.clone());
      return response;
    } catch {
      return (await cache.match(APP_INDEX)) || Response.error();
    }
  })());
});
