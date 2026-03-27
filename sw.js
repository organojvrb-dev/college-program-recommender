const CACHE_NAME = 'pathfinder-v1';
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
  if (e.request.url.includes('firestore.googleapis.com') || 
        e.request.url.includes('counselor.html') || 
        e.request.url.includes('counselor.js')) {
        return;
    }

  e.respondWith(
    caches.match(e.request).then((response) => {
      return response || fetch(e.request);
    })
  );
});