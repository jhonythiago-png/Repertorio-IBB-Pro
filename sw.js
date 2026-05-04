// ── Repertório IBB — Service Worker v5 ───────────────────────────────
// Estratégia: Network First para tudo (JS/CSS/HTML sempre frescos)
// Cache apenas como fallback offline

const CACHE_NAME = 'ibb-repertorio-v21';

const NEVER_CACHE = [
    'supabase.co',
    'youtube.com',
    'youtu.be',
    'ytimg.com'
];

// ── Install: ativa imediatamente sem esperar ─────────────────────────
self.addEventListener('install', () => {
    self.skipWaiting();
});

// ── Activate: limpa TODOS os caches anteriores ───────────────────────
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((keys) =>
            Promise.all(keys.map((key) => caches.delete(key)))
        )
    );
    self.clients.claim();
});

// ── Fetch: Network First — cache só como fallback offline ─────────────
self.addEventListener('fetch', (event) => {
    const url = new URL(event.request.url);

    // APIs externas: nunca cacheia, passa direto
    if (NEVER_CACHE.some(h => url.hostname.includes(h))) {
        event.respondWith(
            fetch(event.request).catch(() => new Response('', { status: 503 }))
        );
        return;
    }

    // Tudo mais: tenta rede primeiro, fallback no cache
    event.respondWith(
        fetch(event.request)
            .then((response) => {
                // Salva cópia nova no cache só se bem-sucedido
                if (response && response.status === 200 && event.request.method === 'GET') {
                    const clone = response.clone();
                    caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
                }
                return response;
            })
            .catch(() => {
                // Offline: tenta servir do cache
                return caches.match(event.request).then((cached) => {
                    if (cached) return cached;
                    if (event.request.mode === 'navigate') {
                        return caches.match('./index.html');
                    }
                    return new Response('', { status: 503 });
                });
            })
    );
});
