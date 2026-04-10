const CACHE_VERSION = 'pdfiuh-v1';

self.addEventListener('install', (event) => {
  // Cache solo la shell HTML stabile
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) =>
      cache.addAll(['/pdfiuh/', '/pdfiuh/index.html'])
    )
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_VERSION)
          .map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  if (event.request.method !== 'GET') return;

  if (url.pathname.startsWith('/pdfiuh/assets/')) {
    // Asset hashed: cache-first strategy
    event.respondWith(
      caches.match(event.request).then(
        (cached) => cached ?? fetch(event.request).then((res) => {
          const clone = res.clone();
          caches.open(CACHE_VERSION).then((c) => c.put(event.request, clone));
          return res;
        })
      )
    );
  } else {
    // HTML e altro: network-first con fallback cache
    event.respondWith(
      fetch(event.request).catch(() => caches.match(event.request))
    );
  }
});
