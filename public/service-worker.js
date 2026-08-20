const CACHE_NAME = 'controle-financeiro-saas-v3-ios';
const APP_SHELL = [
  '/manifest.webmanifest',
  '/assets/icons/icon-192.png',
  '/assets/icons/icon-512.png',
  '/assets/icons/icon-maskable-512.png',
  '/assets/icons/apple-touch-icon.png',
  '/assets/icons/favicon-16.png',
  '/assets/icons/favicon-32.png',
  '/assets/icons/favicon.ico'
];

const isCacheable = (response, url) =>
  response &&
  response.ok &&
  !response.redirected &&
  response.type === 'basic' &&
  url.origin === self.location.origin;

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      for (const path of APP_SHELL) {
        try {
          const request = new Request(path, { cache: 'reload', redirect: 'error' });
          const response = await fetch(request);
          const url = new URL(request.url);
          if (isCacheable(response, url)) await cache.put(request, response);
        } catch (_) {
          // Um recurso opcional não deve impedir a atualização do Service Worker.
        }
      }
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);

  // Navegações sempre vêm da rede. Isso evita que o Safari/iOS receba
  // uma resposta redirecionada anteriormente pelo Service Worker.
  if (event.request.mode === 'navigate') return;

  // Nunca intercepta API, autenticação, cobrança ou dados privados.
  if (url.pathname.startsWith('/api/') || url.pathname === '/config.js') return;

  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached && !cached.redirected) return cached;

      return fetch(event.request).then((response) => {
        if (isCacheable(response, url)) {
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, response.clone()));
        }
        return response;
      });
    })
  );
});
