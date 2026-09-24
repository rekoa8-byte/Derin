// Service Worker for high-speed offline access and slow network resilience
const CACHE_NAME = 'arishop-offline-v2';
const PRECACHE_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/derin-logo.svg',
  '/derin-logo.jpg',
  '/rebaz-rmt-logo.jpg'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(PRECACHE_ASSETS).catch((err) => {
        console.warn('[SW] Precache asset warning:', err);
      });
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // Skip non-GET requests and browser extensions
  if (req.method !== 'GET' || !url.protocol.startsWith('http')) {
    return;
  }

  // Never cache Server-Sent Events or real-time Firestore
  if (url.pathname.startsWith('/api/events') || url.pathname.includes('firestore.googleapis.com')) {
    return;
  }

  // API calls: Network-first, no persistent cache
  if (url.pathname.startsWith('/api/')) {
    return;
  }

  // Navigation requests (Opening the website link):
  // Network-First with a 2-second timeout. If network is slow or offline, serve cached HTML instantly!
  if (req.mode === 'navigate') {
    event.respondWith(
      (async () => {
        try {
          const timeoutPromise = new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Network timeout')), 2200)
          );
          const networkPromise = fetch(req);
          const response = await Promise.race([networkPromise, timeoutPromise]);
          if (response && response.status === 200) {
            const cache = await caches.open(CACHE_NAME);
            cache.put(req, response.clone());
            return response;
          }
        } catch (_) {
          // Slow network or offline: return cached index immediately
        }
        const cached = await caches.match(req);
        if (cached) return cached;
        const fallback = await caches.match('/');
        if (fallback) return fallback;
        return fetch(req);
      })()
    );
    return;
  }

  // Static assets (CSS, JS, Fonts, Images): Stale-While-Revalidate
  event.respondWith(
    caches.match(req).then((cached) => {
      const fetchPromise = fetch(req).then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200) {
          const resClone = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(req, resClone);
          });
        }
        return networkResponse;
      }).catch(() => cached);

      return cached || fetchPromise;
    })
  );
});
