// ── Repertório IBB — Service Worker ──────────────────────────────────
// Cache os arquivos estáticos para funcionamento offline

const CACHE_NAME = 'ibb-repertorio-v4';

// Arquivos essenciais que ficam disponíveis offline
// IMPORTANTE: os query-strings devem bater exatamente com os do index.html
const STATIC_ASSETS = [
    './',
    './index.html',
    './script.js?v=PRO_DEFINITIVO_V3',
    './style.css?v=19',
    './hero_banner.png',
    './manifest.json',
    'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css',
    'https://fonts.googleapis.com/css2?family=Roboto:wght@300;400;700&display=swap'
];

// ── Install: cacheia arquivos estáticos ───────────────────────────────
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.addAll(STATIC_ASSETS).catch((err) => {
                console.warn('[SW] Alguns assets não puderam ser cacheados:', err);
            });
        })
    );
    self.skipWaiting();
});

// ── Activate: limpa caches antigos ───────────────────────────────────
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((keys) =>
            Promise.all(
                keys
                    .filter((key) => key !== CACHE_NAME)
                    .map((key) => caches.delete(key))
            )
        )
    );
    self.clients.claim();
});

// ── Fetch: Network First para Supabase, Cache First para estáticos ───
self.addEventListener('fetch', (event) => {
    const url = new URL(event.request.url);

    // Supabase e YouTube: sempre tenta rede, sem cache
    if (
        url.hostname.includes('supabase.co') ||
        url.hostname.includes('youtube.com') ||
        url.hostname.includes('youtu.be') ||
        url.hostname.includes('ytimg.com')
    ) {
        event.respondWith(fetch(event.request).catch(() => new Response('', { status: 503 })));
        return;
    }

    // Arquivos estáticos: Cache First com fallback para rede
    event.respondWith(
        caches.match(event.request).then((cached) => {
            if (cached) return cached;
            return fetch(event.request).then((response) => {
                // Cacheia respostas bem-sucedidas de recursos estáticos
                if (response && response.status === 200 && event.request.method === 'GET') {
                    const clone = response.clone();
                    caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
                }
                return response;
            }).catch(() => {
                // Offline fallback: retorna index.html para navegação
                if (event.request.mode === 'navigate') {
                    return caches.match('./index.html');
                }
                return new Response('', { status: 503 });
            });
        })
    );
});
