const CACHE = 'lucrascan-v17';
const OFFLINE_DOCUMENT = './';
const PRECACHE = ['./manifest.webmanifest'];

self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    await cache.addAll(PRECACHE);
    try {
      const response = await fetch(OFFLINE_DOCUMENT, { cache: 'no-store' });
      if (response.ok) await cache.put(OFFLINE_DOCUMENT, response.clone());
    } catch {
      // A instalação ainda pode concluir; a navegação online preencherá o fallback.
    }
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(key => key !== CACHE).map(key => caches.delete(key)));
    await self.clients.claim();

    // Atualiza imediatamente janelas que foram abertas pela versão anterior.
    const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    await Promise.all(clients.map(client => client.navigate(client.url).catch(() => undefined)));
  })());
});

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;

  if (request.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        const response = await fetch(request, { cache: 'no-store' });
        if (response.ok) {
          const cache = await caches.open(CACHE);
          await cache.put(OFFLINE_DOCUMENT, response.clone());
        }
        return response;
      } catch {
        return (await caches.match(OFFLINE_DOCUMENT)) || Response.error();
      }
    })());
    return;
  }

  event.respondWith((async () => {
    const cached = await caches.match(request);
    if (cached) return cached;
    const response = await fetch(request);
    if (response.ok && new URL(request.url).origin === self.location.origin) {
      const cache = await caches.open(CACHE);
      await cache.put(request, response.clone());
    }
    return response;
  })());
});
