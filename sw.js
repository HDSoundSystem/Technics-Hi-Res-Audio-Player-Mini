const CACHE_NAME = 'Technics Mini';
const ASSETS = [
  './',
  './index.html',
  './style.css',
  './script.js',
  './img/technics_brand.png',
  './img/technics-logo-cover-footer.png',
  './img/art-Technics-cover.png',
  './img/classAA.png',
  './img/favicon.png'
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS)));
});

self.addEventListener('fetch', (e) => {
  e.respondWith(caches.match(e.request).then(res => res || fetch(e.request)));
});

