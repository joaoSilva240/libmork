/* eslint-disable */
// NOTA: Este Service Worker sobrescreve a decisão D-16 (sem PWA/offline)
// por solicitação direta do dono do produto (SCAN oportunidade #18).
//
// Estratégia simples: network-first, cache-fallback.
// Em produção, registrado via <ServiceWorkerRegistrar /> em src/app/layout.tsx.

const CACHE_NAME = 'libmork-v1';
const PRECACHE_URLS = ['/'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  return self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  
  // API calls — apenas interceptam para evitar erro total
  if (event.request.url.includes('/api/')) {
    event.respondWith(
      fetch(event.request).catch(() => new Response(null, { status: 503 }))
    );
    return;
  }

  event.respondWith(
    fetch(event.request).catch(() => caches.match(event.request))
  );
});
