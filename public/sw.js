// Simple service worker for PWA / WebAPK installation on Android & mobile
const CACHE_NAME = 'webar-model-placer-v1';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (event) => {
  // Let network handle dynamic requests, fallback gracefully
  event.respondWith(
    fetch(event.request).catch(() => caches.match(event.request))
  );
});
