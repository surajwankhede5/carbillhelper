// ════════════════════════════════════════════════
// GarageGPT — Service Worker v2.0
// Offline-first PWA with smart caching
// ════════════════════════════════════════════════

const CACHE_NAME = 'garagegpt-v2';
const APP_SHELL = [
  '/garagegpt/',
  '/garagegpt/index.html',
  '/garagegpt/manifest.json',
  'https://fonts.googleapis.com/css2?family=Orbitron:wght@400;600;700;900&family=DM+Sans:ital,wght@0,300;0,400;0,500;0,600;1,400&display=swap'
];

// ── Install: Cache app shell ──
self.addEventListener('install', e => {
  self.skipWaiting();
  e.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      console.log('[GarageGPT SW] Caching app shell');
      return cache.addAll(APP_SHELL).catch(err => {
        console.warn('[GarageGPT SW] Some assets failed to cache:', err);
      });
    })
  );
});

// ── Activate: Clean old caches ──
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => {
          console.log('[GarageGPT SW] Deleting old cache:', k);
          return caches.delete(k);
        })
      )
    ).then(() => self.clients.claim())
  );
});

// ── Fetch: Stale-while-revalidate strategy ──
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);

  // Skip non-GET, chrome-extension, API calls
  if (e.request.method !== 'GET') return;
  if (url.protocol === 'chrome-extension:') return;
  if (url.hostname.includes('supabase.co')) return;
  if (url.hostname.includes('cloudinary.com')) return;
  if (url.hostname.includes('wa.me')) return;
  if (url.hostname.includes('api.anthropic.com')) return;

  // For navigation requests (HTML pages) — network first, fallback to cache
  if (e.request.mode === 'navigate') {
    e.respondWith(
      fetch(e.request)
        .then(res => {
          const clone = res.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(e.request, clone));
          return res;
        })
        .catch(() => caches.match(e.request).then(r => r || caches.match('/garagegpt/')))
    );
    return;
  }

  // For other requests — cache first, then network
  e.respondWith(
    caches.match(e.request).then(cached => {
      const networkFetch = fetch(e.request).then(res => {
        if (res && res.status === 200 && res.type !== 'opaque') {
          const clone = res.clone();
          caches.open(CACHE_NAME).then(c => c.put(e.request, clone));
        }
        return res;
      }).catch(() => null);

      return cached || networkFetch;
    })
  );
});

// ── Background sync for offline bill submissions ──
self.addEventListener('sync', e => {
  if (e.tag === 'sync-bill-advisory') {
    e.waitUntil(syncPendingSubmissions());
  }
});

async function syncPendingSubmissions() {
  console.log('[GarageGPT SW] Syncing pending submissions...');
  // Sync logic handled in main app
}

// ── Push notifications for service reminders ──
self.addEventListener('push', e => {
  const data = e.data ? e.data.json() : {};
  const options = {
    body: data.body || 'Your vehicle service reminder from GarageGPT',
    icon: '/garagegpt/icon-192.png',
    badge: '/garagegpt/icon-72.png',
    vibrate: [200, 100, 200],
    tag: data.tag || 'garagegpt-reminder',
    data: { url: data.url || '/garagegpt/' },
    actions: [
      { action: 'view', title: 'View Details' },
      { action: 'dismiss', title: 'Dismiss' }
    ]
  };
  e.waitUntil(
    self.registration.showNotification(data.title || 'GarageGPT Reminder', options)
  );
});

self.addEventListener('notificationclick', e => {
  e.notification.close();
  if (e.action === 'view') {
    const url = e.notification.data?.url || '/garagegpt/';
    e.waitUntil(clients.openWindow(url));
  }
});
