const CACHE_NAME = 'practice-timer-v2';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/favicon.svg',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png',
  '/icons/icon-monochrome.svg'
];

// Timer state for background operation
let backgroundTimerState = {
  isRunning: false,
  startTime: null,
  duration: 0,
  timeRemaining: 0,
  mode: 'work',
  currentIteration: 1,
  totalIterations: 4
};

// Background sync registration
let backgroundSyncRegistered = false;

// Install event - cache static assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        return cache.addAll(STATIC_ASSETS).catch(error => {
          console.error('Failed to cache resources:', error);
          // Continue installation even if caching fails
          return Promise.resolve();
        });
      })
  );
});

// Activate event - clean up old caches and register background sync
self.addEventListener('activate', (event) => {
  event.waitUntil(
    Promise.all([
      // Clean up old caches
      caches.keys().then((cacheNames) => {
        return Promise.all(
          cacheNames
            .filter((name) => name !== CACHE_NAME)
            .map((name) => caches.delete(name))
        );
      }),
      // Register background sync if supported
      registerBackgroundSync()
    ])
  );
});

// Register background sync for iOS background operation
async function registerBackgroundSync() {
  if ('serviceWorker' in navigator && 'sync' in window.ServiceWorkerRegistration.prototype) {
    try {
      const registration = await navigator.serviceWorker.ready;
      
      // Register periodic background sync if supported
      if ('periodicSync' in window.ServiceWorkerRegistration.prototype) {
        const status = await navigator.permissions.query({
          name: 'periodic-background-sync'
        });
        
        if (status.state === 'granted') {
          await registration.periodicSync.register('timer-sync', {
            minInterval: 60000 // Minimum 1 minute interval
          });
          console.log('Periodic background sync registered');
        }
      }
      
      backgroundSyncRegistered = true;
    } catch (error) {
      console.log('Background sync registration failed:', error);
    }
  }
}

// Handle periodic background sync
self.addEventListener('periodicsync', (event) => {
  if (event.tag === 'timer-sync') {
    event.waitUntil(updateBackgroundTimer());
  }
});

// Handle background sync
self.addEventListener('sync', (event) => {
  if (event.tag === 'timer-sync') {
    event.waitUntil(updateBackgroundTimer());
  }
});

// Update timer state in background
async function updateBackgroundTimer() {
  if (!backgroundTimerState.isRunning || !backgroundTimerState.startTime) {
    return;
  }

  const now = Date.now();
  const elapsed = Math.floor((now - backgroundTimerState.startTime) / 1000);
  const newTimeRemaining = Math.max(0, backgroundTimerState.duration - elapsed);

  backgroundTimerState.timeRemaining = newTimeRemaining;

  // Check if timer is complete
  if (newTimeRemaining <= 0) {
    backgroundTimerState.isRunning = false;
    
    // Show notification
    await showBackgroundNotification();
    
    // Store completion state for when app becomes active
    await storeTimerCompletion();
  }
}

// Show notification when timer completes in background
async function showBackgroundNotification() {
  const title = backgroundTimerState.mode === 'work' ? 'Work Time Complete!' : 'Break Time Complete!';
  const body = backgroundTimerState.mode === 'work' ? 'Time for a break!' : 'Time to get back to work!';
  
  try {
    await self.registration.showNotification(title, {
      body,
      icon: '/icons/icon-192x192.png',
      badge: '/icons/icon-192x192.png',
      tag: 'timer-complete',
      requireInteraction: true,
      silent: false,
      actions: [
        {
          action: 'start-next',
          title: 'Start Next Session'
        },
        {
          action: 'dismiss',
          title: 'Dismiss'
        }
      ]
    });
  } catch (error) {
    console.log('Failed to show background notification:', error);
  }
}

// Store timer completion state
async function storeTimerCompletion() {
  try {
    const completionData = {
      completedAt: Date.now(),
      mode: backgroundTimerState.mode,
      iteration: backgroundTimerState.currentIteration,
      totalIterations: backgroundTimerState.totalIterations
    };
    
    // Store in IndexedDB or localStorage equivalent
    const db = await openDB();
    await db.put('timerCompletions', completionData);
  } catch (error) {
    console.log('Failed to store timer completion:', error);
  }
}

// Simple IndexedDB implementation for background storage
async function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('PracticeTimerDB', 1);
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains('timerCompletions')) {
        db.createObjectStore('timerCompletions', { keyPath: 'completedAt' });
      }
    };
  });
}

// Handle notification clicks
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  
  if (event.action === 'start-next') {
    // Start next session
    event.waitUntil(
      clients.openWindow('/').then((windowClient) => {
        if (windowClient) {
          windowClient.postMessage({
            type: 'START_NEXT_SESSION',
            payload: backgroundTimerState
          });
        }
      })
    );
  }
});

// Handle messages from main thread
self.addEventListener('message', (event) => {
  const { type, payload } = event.data;
  
  switch (type) {
    case 'UPDATE_BACKGROUND_TIMER':
      backgroundTimerState = { ...backgroundTimerState, ...payload };
      break;
      
    case 'START_BACKGROUND_TIMER':
      backgroundTimerState = {
        ...backgroundTimerState,
        ...payload,
        startTime: Date.now(),
        isRunning: true
      };
      break;
      
    case 'STOP_BACKGROUND_TIMER':
      backgroundTimerState.isRunning = false;
      break;
      
    case 'GET_BACKGROUND_STATE':
      event.ports[0].postMessage(backgroundTimerState);
      break;
  }
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