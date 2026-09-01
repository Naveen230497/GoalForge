const CACHE_NAME = 'goalforge-v4';

self.addEventListener('install', (event) => {
  const version = Date.now();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      const urlsToCache = [
        '/', 
        '/dashboard.html', 
        '/css/styles.css',
        '/js/api.js',
        '/js/auth.js',
        '/js/goals.js',
        '/js/chat.js',
        '/js/checkin.js',
        '/js/utils.js'
      ];
      // Append a cache-busting string to force the browser to bypass its HTTP cache
      const cacheBustedUrls = urlsToCache.map(url => `${url}?v=${version}`);
      return cache.addAll(cacheBustedUrls);
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  // Use Network-First strategy for HTML files and API calls
  if (event.request.mode === 'navigate' || event.request.url.includes('/api/')) {
    event.respondWith(
      fetch(event.request).catch(() => caches.match(event.request, {ignoreSearch: true}))
    );
  } else {
    // Cache-First for static assets
    event.respondWith(
      caches.match(event.request, {ignoreSearch: true}).then((response) => {
        return response || fetch(event.request);
      })
    );
  }
});
