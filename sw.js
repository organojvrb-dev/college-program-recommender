const CACHE_NAME = 'pathfinder-v2';
const ASSETS = [
  './',
  './index.html',
  './css/style.css', 
  './js/app.js',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './data/questions.json',
  './data/programs.json',
  './data/students.json',
  './data/colleges.json'
];

self.addEventListener('install', (e) => {
  console.info(`[Service Worker] Installation initiated for ${CACHE_NAME}.`);
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.info('[Service Worker] Caching foundational assets for offline capability.');
      return cache.addAll(ASSETS);
    })
  );
  self.skipWaiting(); 
});

self.addEventListener('activate', (e) => {
  console.info('[Service Worker] Activation sequence engaged.');
  e.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME) {
            console.info(`[Service Worker] Pruning deprecated cache volume: ${cache}`);
            return caches.delete(cache);
          }
        })
      );
    })
  );
  return self.clients.claim();
});

self.addEventListener('fetch', (e) => {
  if (e.request.url.includes('firestore.googleapis.com') || 
      e.request.url.includes('counselor.html') || 
      e.request.url.includes('counselor.js')) {
      return;
  }

  e.respondWith(
    fetch(e.request)
      .then((networkResponse) => {
        return caches.open(CACHE_NAME).then((cache) => {
          cache.put(e.request, networkResponse.clone());
          return networkResponse;
        });
      })
      .catch(() => {
        console.warn(`[Network] Connection unreachable. Serving fallback asset from ${CACHE_NAME}: ${e.request.url}`);
        return caches.match(e.request);
      })
  );
});