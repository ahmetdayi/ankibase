/* ============================================================
   sw.js – AnkiBase Service Worker
   Sürüm numarasını (CACHE) her uygulama güncellemesinde artır
   ============================================================ */

const CACHE = 'ankibase-v1';

const PRECACHE_ASSETS = [
    './',
    './index.html',
    './css/style.css',
    './js/storage.js',
    './js/algorithm.js',
    './js/cards.js',
    './js/study.js',
    './js/ui.js',
    './js/app.js',
    './manifest.json',
    './icons/icon.svg',
    './icons/icon-192.png',
    './icons/icon-512.png',
];

// Kurulum: tüm uygulama dosyalarını önbelleğe al
self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE)
            .then(cache => cache.addAll(PRECACHE_ASSETS))
            .then(() => self.skipWaiting())
    );
});

// Aktifleştirme: eski önbellek sürümlerini temizle
self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(keys =>
            Promise.all(
                keys.filter(k => k !== CACHE).map(k => caches.delete(k))
            )
        ).then(() => self.clients.claim())
    );
});

// Fetch: önce önbellekten sun, yoksa ağdan al
self.addEventListener('fetch', event => {
    if (event.request.method !== 'GET') return;

    // CDN kütüphanelerini (JSZip, sql.js) ağdan al, başarısız olursa önbellekten
    const url = new URL(event.request.url);
    const isCDN = url.hostname.includes('cdnjs.cloudflare.com');

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

    // Uygulama dosyaları: önce önbellek
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
