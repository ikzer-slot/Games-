// Service worker : le jeu fonctionne entièrement hors-ligne.
const CACHE = 'potager-gardien-v1';
const FILES = ['./', 'index.html', 'css/style.css', 'manifest.webmanifest',
  'js/main.js', 'js/game.js', 'js/ui.js', 'js/data.js', 'js/map.js', 'js/swarm.js', 'js/advisor.js', 'js/audio.js',
  'icons/icon-192.png', 'icons/icon-512.png'];
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES))); self.skipWaiting(); });
self.addEventListener('activate', e => e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())));
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  e.respondWith(caches.match(e.request).then(r => r || fetch(e.request).then(res => {
    if (res.ok && new URL(e.request.url).origin === location.origin) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(e.request, copy)); }
    return res;
  }).catch(() => r)));
});
