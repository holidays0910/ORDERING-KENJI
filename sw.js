// KusinaERP Service Worker
// BUMP ang version na ito tuwing may in-update na app.js / style.css / HTML para makuha agad ng lahat ng user.
const CACHE_NAME = 'kusina-erp-v4';
const urlsToCache = [
  './',
  './index.html',
  './admin.html',
  './branch.html',
  './commissary.html',
  './style.css',
  './app.js',
  './firebase-config.js',
  './kpos.js',
  './messenger.js',
  './errlog.js',
  './order.html',
  './pos.html'
];
// Mga library na hindi nagbabago — cache-first para makapag-load ang POS kahit WALANG internet
const LIBS = /^https:\/\/(www\.gstatic\.com\/firebasejs\/|cdnjs\.cloudflare\.com\/|cdn\.jsdelivr\.net\/)/;

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache =>
      // Isa-isang i-cache para hindi mabigo ang buong install kapag may isang file na wala
      Promise.all(urlsToCache.map(url => cache.add(url).catch(() => null)))
    )
  );
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cache => {
          if (cache !== CACHE_NAME) {
            return caches.delete(cache);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Network-first: laging pinakabagong style.css / app.js / HTML kapag online; cache lang kapag offline.
self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (LIBS.test(req.url)) { event.respondWith(caches.match(req).then(hit => hit || fetch(req).then(res => { if (res && (res.ok || res.type === 'opaque')) { const c = res.clone(); caches.open(CACHE_NAME).then(cache => cache.put(req, c)).catch(() => {}); } return res; }))); return; }
  if (url.origin !== self.location.origin) return; // Firestore API, fonts: hayaan ang browser
  event.respondWith(
    fetch(req)
      .then(res => {
        const copy = res.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(req, copy)).catch(() => {});
        return res;
      })
      .catch(() => caches.match(req))
  );
});

self.addEventListener('message', event => {
  if (event.data && event.data.action === 'skipWaiting') {
    self.skipWaiting();
  }
});
