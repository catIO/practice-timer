const CACHE_NAME = 'practice-timer-v1';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/favicon.ico',
  '/assets/index.css',
  '/assets/index.js',
  '/assets/vendor.js',
  '/assets/beep.mp3',
  '/assets/notification.mp3',
  '/assets/icon-192x192.png',
  '/assets/icon-512x512.png',
  '/assets/icon-192x192-maskable.png',
  '/assets/icon-512x512-maskable.png'
];

// Install event - cache static assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        return cache.addAll([
          '/',
          '/index.html',
          '/manifest.json',
          '/vite.svg'
        ]).catch(error => {
          console.error('Failed to cache resources:', error);
          // Continue installation even if caching fails
          return Promise.resolve();
        });
      })
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      );
    })
  );
});

// Fetch event - serve from cache, fallback to network
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  
  // Skip caching for:
  // 1. Vite's development server requests
  // 2. Source files
  // 3. API requests
  // 4. HMR (Hot Module Replacement) requests
  if (url.hostname === 'localhost' || 
      url.pathname.includes('/src/') ||
      url.pathname.includes('/@vite/') ||
      url.pathname.includes('/api/') ||
      url.pathname.includes('hmr')) {
    return;
  }

  event.respondWith(
    caches.match(event.request)
      .then(response => {
        if (response) {
          return response;
        }
        return fetch(event.request)
          .then(response => {
            // Check if we received a valid response
            if (!response || response.status !== 200 || response.type !== 'basic') {
              return response;
            }

            const responseToCache = response.clone();
            caches.open(CACHE_NAME)
              .then(cache => {
                cache.put(event.request, responseToCache);
              })
              .catch(error => {
                console.error('Failed to cache response:', error);
              });

            return response;
          })
          .catch(error => {
            console.error('Fetch failed:', error);
            // Return a fallback response or let the error propagate
            throw error;
          });
      })
  );
}); 