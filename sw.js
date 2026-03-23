// GarageGPT Service Worker v2.1
// PWABuilder Compatible

const CACHE = 'garagegpt-v2';
const SHELL = [
  '/GARAGEGPT/',
  '/GARAGEGPT/index.html',
  '/GARAGEGPT/app.html',
  '/GARAGEGPT/manifest.json',
  '/GARAGEGPT/sw.js'
];

self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE).then(cache =>
      cache.addAll(SHELL).catch(err => console.warn('Cache error:', err))
    )
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(k => k !== CACHE).map(k => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  // Skip non-GET and external API calls
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (url.hostname.includes('supabase.co')) return;
  if (url.hostname.includes('cloudinary.com')) return;
  if (url.hostname.includes('wa.me')) return;
  if (url.hostname.includes('api.anthropic.com')) return;

  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;
      return fetch(event.request).then(response => {
        if (!response || response.status !== 200 || response.type === 'opaque') {
          return response;
        }
        const clone = response.clone();
        caches.open(CACHE).then(cache => cache.put(event.request, clone));
        return response;
      }).catch(() => {
        // Offline fallback for navigation
        if (event.request.mode === 'navigate') {
          return caches.match('/GARAGEGPT/');
        }
      });
    })
  );
});

self.addEventListener('push', event => {
  const data = event.data ? event.data.json() : {};
  event.waitUntil(
    self.registration.showNotification(data.title || 'GarageGPT', {
      body: data.body || 'Vehicle service reminder',
      icon: '/GARAGEGPT/icon-192.png',
      badge: '/GARAGEGPT/icon-72.png',
      tag: 'garagegpt',
      data: { url: data.url || '/GARAGEGPT/' }
    })
  );
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil(clients.openWindow(event.notification.data?.url || '/GARAGEGPT/'));
});
