const CACHE_NAME = 'hisaabbot-v1';
const STATIC_ASSETS = [
  '/',
  '/loans',
  '/alerts',
  '/reports',
  '/expenses',
  '/settings',
];

// Install — cache static shell
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    })
  );
  self.skipWaiting();
});

// Activate — clean old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      );
    })
  );
  self.clients.claim();
});

// Fetch — network-first for API, cache-first for static
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  // API calls → network only (need real-time data)
  if (event.request.url.includes('/api/')) return;

  event.respondWith(
    caches.match(event.request).then((cached) => {
      const fetchPromise = fetch(event.request)
        .then((response) => {
          if (response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, clone);
            });
          }
          return response;
        })
        .catch(() => {
          // Network failed — if navigating, return cached home
          if (event.request.mode === 'navigate') {
            return caches.match('/');
          }
          return cached;
        });

      // Return cached immediately, update in background (stale-while-revalidate)
      return cached || fetchPromise;
    })
  );
});
