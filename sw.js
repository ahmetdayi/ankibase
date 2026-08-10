/* ============================================================
   sw.js – AnkiBase Service Worker
   Sürüm numarasını (CACHE) her uygulama güncellemesinde artır
   ============================================================ */

const CACHE = 'ankibase-v4';

const PRECACHE_ASSETS = [
    './',
    './index.html',
    './css/style.css',
    './js/storage.js',
    './js/algorithm.js',
    './js/cards.js',
    './js/study.js',
    './js/ui.js',
    './js/sync.js',
    './js/app.js',
    './manifest.json',
    './icons/icon.svg',
    './icons/icon-192.png',
    './icons/icon-512.png',
];

self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE)
            .then(cache => cache.addAll(PRECACHE_ASSETS))
            .then(() => self.skipWaiting())
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
    if (event.request.method !== 'GET') return;

    const url = new URL(event.request.url);

    // Supabase API: always network, never cache
    if (url.hostname.includes('supabase.co')) {
        event.respondWith(fetch(event.request));
        return;
    }

    // CDN kütüphaneleri: önce ağdan al, başarısız olursa önbellekten
    const isCDN = url.hostname.includes('cdnjs.cloudflare.com') ||
                  url.hostname.includes('cdn.jsdelivr.net');

    if (isCDN) {
        event.respondWith(
            fetch(event.request)
                .then(res => {
                    const clone = res.clone();
                    caches.open(CACHE).then(c => c.put(event.request, clone));
                    return res;
                })
                .catch(() => caches.match(event.request))
        );
        return;
    }

    // JS dosyaları: önce ağ (güncel kodu al), başarısız olursa önbellekten
    if (url.pathname.endsWith('.js')) {
        event.respondWith(
            fetch(event.request)
                .then(res => {
                    const clone = res.clone();
                    caches.open(CACHE).then(c => c.put(event.request, clone));
                    return res;
                })
                .catch(() => caches.match(event.request))
        );
        return;
    }

    // Diğer uygulama dosyaları (HTML, CSS, görseller): önce önbellek
    event.respondWith(
        caches.match(event.request)
            .then(cached => cached || fetch(event.request)
                .then(res => {
                    const clone = res.clone();
                    caches.open(CACHE).then(c => c.put(event.request, clone));
                    return res;
                })
            )
    );
});
