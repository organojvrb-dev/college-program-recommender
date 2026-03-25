const CACHE_NAME = 'pathfinder-v1';
const ASSETS = [
  './',
  './index.html',
  './css/style.css', 
  './js/app.js',
  './data/questions.json',
  './data/programs.json'
];

// Install Event
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS);
    })
  );
});

// Fetch Event (Allows app to load from cache)
self.addEventListener('fetch', (e) => {
  e.respondWith(
    caches.match(e.request).then((response) => {
      return response || fetch(e.request);
    })
  );
});