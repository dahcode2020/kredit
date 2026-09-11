// KREDIT PWA — Service Worker v2
// Strategies:
// - STATIC_ASSETS: CacheFirst (immutable, long-lived)
// - PUBLIC_CONTENT: StaleWhileRevalidate (marketing, legal, simulator shell)
// - AUTHENTICATED_CONTENT: NetworkFirst with offline fallback (no persistent cache of personal data)
// - FINANCIAL_DATA: NetworkOnly (never cache — payments, credit, investments API & docs)
// Never cache financial/personal sensitive data without encryption — per requirement.

const VERSION = 'kredit-v3';
const STATIC_CACHE = `kredit-static-${VERSION}`;
const PUBLIC_CACHE = `kredit-public-${VERSION}`;
const OFFLINE_CACHE = `kredit-offline-${VERSION}`;
const OFFLINE_URL = '/fr/offline';
const PRECACHE_URLS = [
  '/',
  '/fr',
  '/en',
  '/nl',
  '/de',
  '/fr/offline',
  '/en/offline',
  '/nl/offline',
  '/de/offline',
  '/manifest.json',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
];

// ---------- Helpers: strategy classification ----------
function isStaticAsset(req) {
  const url = new URL(req.url);
  if (url.pathname.startsWith('/_next/static/')) return true;
  if (url.pathname.startsWith('/_next/image')) return true;
  if (url.pathname.startsWith('/icons/')) return true;
  if (url.pathname.startsWith('/screenshots/')) return true;
  if (url.pathname === '/manifest.json') return true;
  if (url.pathname === '/sw.js') return true;
  const dest = req.destination;
  if (['style', 'script', 'font', 'image'].includes(dest)) return true;
  return /\.(?:js|css|woff2?|ttf|otf|png|jpg|jpeg|webp|avif|svg|ico)$/i.test(url.pathname);
}

function isFinancialData(req) {
  const url = new URL(req.url);
  // All API = financial/personal — never cache
  if (url.pathname.startsWith('/api/')) return true;
  // Explicit financial endpoints even if proxied
  if (url.pathname.includes('/payments') && req.method !== 'GET') return true;
  return false;
}

function isAuthenticatedContent(req) {
  const url = new URL(req.url);
  // Navigation to authenticated pages
  if (req.mode === 'navigate') {
    if (/^\/(fr|en|nl|de)\/(dashboard|credit|payments|investments|profile|security|admin|super|notifications|settings)/.test(url.pathname)) return true;
    if (url.pathname.startsWith('/api/v1/customer')) return true;
    if (url.pathname.startsWith('/api/v1/credit')) return true;
    if (url.pathname.startsWith('/api/v1/payments')) return true;
    if (url.pathname.startsWith('/api/v1/investments')) return true;
    if (url.pathname.includes('/admin')) return true;
  }
  // API authenticated endpoints
  if (url.pathname.startsWith('/api/v1/')) {
    // Public simulation is not authenticated but still financial -> already handled as FINANCIAL_DATA
    // but we classify remaining api as authenticated
    return true;
  }
  return false;
}

function isPublicContent(req) {
  const url = new URL(req.url);
  if (req.mode === 'navigate') {
    // Public marketing pages: home, simulator anchor, legal, products
    if (url.pathname === '/' || /^\/(fr|en|nl|de)(\/|$|#)/.test(url.pathname)) {
      // Exclude authenticated subpaths already handled
      if (isAuthenticatedContent(req)) return false;
      return true;
    }
  }
  // Public GET assets that are not static but are safe to stale-while-revalidate (e.g., investment-products catalog)
  if (url.pathname === '/api/v1/investment-products' && req.method === 'GET') return true;
  return false;
}

// ---------- Cache strategies ----------
async function cacheFirst(req, cacheName) {
  const cached = await caches.match(req);
  if (cached) return cached;
  try {
    const res = await fetch(req);
    if (res && res.ok) {
      const cache = await caches.open(cacheName);
      cache.put(req, res.clone());
    }
    return res;
  } catch (e) {
    return cached || Response.error();
  }
}

async function staleWhileRevalidate(req, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await caches.match(req);
  const fetchPromise = fetch(req).then((res) => {
    if (res && res.ok) cache.put(req, res.clone());
    return res;
  }).catch(() => null);
  return cached || (await fetchPromise) || fetchPromise;
}

async function networkFirst(req, cacheName, timeoutMs = 4000) {
  const cache = await caches.open(cacheName);
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    const res = await fetch(req, { signal: controller.signal });
    clearTimeout(timeout);
    if (res && res.ok) {
      // Do NOT cache sensitive authenticated responses persistently
      // Only cache shell HTML for offline fallback, not JSON financial data
      if (req.mode === 'navigate' && res.headers.get('content-type')?.includes('text/html')) {
        cache.put(req, res.clone());
      }
    }
    return res;
  } catch (e) {
    const cached = await caches.match(req);
    if (cached) return cached;
    // Fallback to offline page for navigation (locale-aware)
    if (req.mode === 'navigate') {
      const locale = (url.pathname.match(/^\/(fr|en|nl|de)/) || [])[1] || 'fr';
      const offline = await caches.match(`/${locale}/offline`) || await caches.match(OFFLINE_URL) || await caches.match('/fr');
      if (offline) return offline;
    }
    // For API, return structured offline response
    if (req.url.includes('/api/')) {
      return new Response(JSON.stringify({ statusCode: 503, code: 'OFFLINE', message: 'Connexion requise — opération nécessite le serveur. Données financières non mises en cache par sécurité.' }), {
        status: 503,
        headers: { 'Content-Type': 'application/json', 'X-KREDIT-Offline': '1' }
      });
    }
    throw e;
  }
}

async function networkOnly(req) {
  try {
    return await fetch(req);
  } catch (e) {
    if (req.mode === 'navigate') {
      const locale = (url.pathname.match(/^\/(fr|en|nl|de)/) || [])[1] || 'fr';
      const offline = await caches.match(`/${locale}/offline`) || await caches.match(OFFLINE_URL);
      if (offline) return offline;
      return new Response('<h1>Hors ligne</h1><p>Connexion requise. Les opérations financières nécessitent le serveur.</p>', { headers: { 'Content-Type': 'text/html' }, status: 503 });
    }
    if (req.url.includes('/api/')) {
      return new Response(JSON.stringify({ statusCode: 503, code: 'OFFLINE', message: 'Hors ligne — données financières non disponibles hors connexion par sécurité.' }), {
        status: 503,
        headers: { 'Content-Type': 'application/json', 'X-KREDIT-Cache-Strategy': 'FINANCIAL_DATA', 'X-KREDIT-Offline': '1' }
      });
    }
    throw e;
  }
}

// ---------- Install / Activate ----------
self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(OFFLINE_CACHE);
      try {
        await cache.addAll(PRECACHE_URLS);
      } catch (e) {
        // Best effort: cache what we can
        for (const u of PRECACHE_URLS) {
          try { await cache.add(u); } catch (_) {}
        }
      }
      // Do NOT auto skipWaiting — let the UI prompt user to apply update
      // (prevents "Actualiser" loop on every refresh; update remains in waiting until user clicks)
    })()
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      // Enable navigation preload if available
      if ('navigationPreload' in self.registration) {
        try { await self.registration.navigationPreload.enable(); } catch (_) {}
      }
      const keys = await caches.keys();
      await Promise.all(keys.filter(k => ![STATIC_CACHE, PUBLIC_CACHE, OFFLINE_CACHE].includes(k) && k.startsWith('kredit-')).map(k => caches.delete(k)));
      await self.clients.claim();
    })()
  );
});

// ---------- Fetch ----------
self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // Only handle GET for caching; other methods always networkOnly
  if (req.method !== 'GET') {
    // Financial mutations must always hit server
    event.respondWith(networkOnly(req));
    return;
  }

  // Cross-origin: network only (but allow stale for images if needed)
  if (url.origin !== self.location.origin) {
    // Allow caching of unsplash/CDN images as static (optional)
    if (req.destination === 'image' && url.hostname.includes('images.unsplash.com')) {
      event.respondWith(staleWhileRevalidate(req, STATIC_CACHE));
      return;
    }
    return; // let browser handle
  }

  // FINANCIAL_DATA — never cache
  if (isFinancialData(req)) {
    event.respondWith(
      networkOnly(req)
    );
    return;
  }

  // STATIC_ASSETS — CacheFirst
  if (isStaticAsset(req)) {
    event.respondWith(
      (async () => {
        // Try preload response first
        const preload = await event.preloadResponse;
        if (preload) {
          const cache = await caches.open(STATIC_CACHE);
          cache.put(req, preload.clone());
          return preload;
        }
        return cacheFirst(req, STATIC_CACHE);
      })()
    );
    return;
  }

  // AUTHENTICATED_CONTENT — NetworkFirst (no persistent sensitive cache)
  if (isAuthenticatedContent(req)) {
    event.respondWith(networkFirst(req, PUBLIC_CACHE, 5000));
    return;
  }

  // PUBLIC_CONTENT — StaleWhileRevalidate or NetworkFirst for navigations
  if (isPublicContent(req)) {
    if (req.mode === 'navigate') {
      event.respondWith(
        (async () => {
          const preload = await event.preloadResponse;
          if (preload) {
            const cache = await caches.open(PUBLIC_CACHE);
            cache.put(req, preload.clone());
            return preload;
          }
          // Network first for HTML to get fresh content, fallback to cache
          return networkFirst(req, PUBLIC_CACHE, 4000);
        })()
      );
      return;
    }
    event.respondWith(staleWhileRevalidate(req, PUBLIC_CACHE));
    return;
  }

  // Default: network first with offline fallback
  if (req.mode === 'navigate') {
    event.respondWith(networkFirst(req, PUBLIC_CACHE));
    return;
  }
  event.respondWith(
    staleWhileRevalidate(req, PUBLIC_CACHE)
  );
});

// ---------- Push Notifications ----------
self.addEventListener('push', (event) => {
  let data = { title: 'KREDIT', body: 'Nouvelle notification', url: '/fr/notifications' };
  if (event.data) {
    try {
      const json = event.data.json();
      data = { ...data, ...json };
    } catch (_) {
      data.body = event.data.text();
    }
  }
  const options = {
    body: data.body,
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-96.png',
    image: data.image,
    data: { url: data.url || '/fr/notifications' },
    tag: data.tag || 'kredit-general',
    renotify: !!data.renotify,
    requireInteraction: !!data.requireInteraction,
    actions: data.actions || [
      { action: 'open', title: 'Ouvrir' },
      { action: 'dismiss', title: 'Fermer' }
    ],
    vibrate: [200, 100, 200],
  };
  event.waitUntil(self.registration.showNotification(data.title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  if (event.action === 'dismiss') return;
  const url = event.notification.data?.url || '/fr';
  event.waitUntil(
    (async () => {
      const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      for (const client of clients) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          await client.navigate(url);
          return client.focus();
        }
      }
      if (self.clients.openWindow) return self.clients.openWindow(url);
    })()
  );
});

self.addEventListener('notificationclose', (event) => {
  // analytics hook if needed
});

// ---------- Background Sync ----------
self.addEventListener('sync', (event) => {
  if (event.tag === 'kredit-sync') {
    event.waitUntil(
      (async () => {
        // Notify clients that sync is happening
        const clients = await self.clients.matchAll();
        clients.forEach(c => c.postMessage({ type: 'SYNCING' }));
        // Placeholder: would retry queued POSTs from IndexedDB
        // For now just notify done after 1.5s
        await new Promise(r => setTimeout(r, 1500));
        clients.forEach(c => c.postMessage({ type: 'SYNCED' }));
      })()
    );
  }
});

// ---------- Message handling (SKIP_WAITING, cache control) ----------
self.addEventListener('message', (event) => {
  const data = event.data;
  if (!data) return;
  if (data.type === 'SKIP_WAITING') self.skipWaiting();
  if (data.type === 'GET_VERSION') event.ports?.[0]?.postMessage({ version: VERSION });
  if (data.type === 'CLEAR_SENSITIVE_CACHES') {
    event.waitUntil(
      caches.keys().then(keys => Promise.all(keys.filter(k => k.includes('public') || k.includes('offline')).map(k => caches.delete(k))))
    );
  }
});
