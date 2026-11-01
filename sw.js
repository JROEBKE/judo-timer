const CACHE_NAME = 'judo-timer-v1';
const assets = [
  './',
  './index.html',
  './style.css',
  './app.js',
  './bluetooth.js',
  './sounds.js'
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(assets);
    })
  );
});

self.addEventListener('fetch', e => {
  e.respondWith(
    caches.match(e.request).then(cachedResponse => {
      return cachedResponse || fetch(e.request);
    })
  );
});