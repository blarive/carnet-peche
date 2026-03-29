// ─── Service Worker — Carnet de Pêche V1.0 ──────────────
// Stratégie simplifiée et fiable :
// - index.html toujours depuis le réseau (jamais en cache)
// - Assets statiques (fonts, leaflet) en cache long terme
// - Détection de version côté app → purge + reload auto

const CACHE_NAME = 'carnet-peche-static-v1';

const STATIC_ASSETS = [
  'https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,700;1,400&family=DM+Sans:wght@300;400;500;600&display=swap',
  'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css',
  'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js',
  './icon-192.png',
  './icon-512.png',
  './manifest.json',
];

// ─── INSTALL ─────────────────────────────────────────────
self.addEventListener('install', event => {
  // Activation immédiate sans attendre la fermeture des onglets
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache =>
      Promise.allSettled(STATIC_ASSETS.map(url => cache.add(url).catch(() => {})))
    )
  );
});

// ─── ACTIVATE ────────────────────────────────────────────
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(k => k !== CACHE_NAME)
          .map(k => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

// ─── FETCH ───────────────────────────────────────────────
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  if (event.request.method !== 'GET') return;

  // API externe (GPS, tuiles carte) → réseau direct, pas de cache
  if (
    url.hostname === 'nominatim.openstreetmap.org' ||
    url.hostname.includes('tile.openstreetmap.org')
  ) return;

  // index.html et sw.js → TOUJOURS réseau, jamais de cache
  // C'est la clé : on ne met JAMAIS index.html en cache
  if (
    url.pathname === '/' ||
    url.pathname.endsWith('/index.html') ||
    url.pathname.endsWith('/sw.js')
  ) {
    event.respondWith(
      fetch(event.request, { cache: 'no-store' })
        .catch(() => caches.match('./index.html'))
    );
    return;
  }

  // Assets statiques → Cache First (fonts, leaflet, icônes)
  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;
      return fetch(event.request).then(response => {
        if (response && response.ok) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(c => c.put(event.request, clone));
        }
        return response;
      }).catch(() => new Response('', { status: 408 }));
    })
  );
});

// ─── MESSAGE ─────────────────────────────────────────────
self.addEventListener('message', event => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
});
