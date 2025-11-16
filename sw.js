
// Bump the cache version to bust the old cache and ensure updated assets
// like the redesigned white logo and social icons are served.  Each time
// assets are significantly modified, increment this version string.
const CACHE_NAME = 'leenelite-v2';
const ASSETS = [
  '/en/index.html','/en/events.html','/en/exhibitions.html','/en/marketing.html','/en/stand.html','/en/giveaways.html',
  '/ar/index.html','/ar/events.html','/ar/exhibitions.html','/ar/marketing.html','/ar/stand.html','/ar/giveaways.html',
  '/css/styles.min.css','/js/script.min.js',
  '/images/leenelite-logo-white.svg','/images/logo.png','/images/world.png','/images/map.png','/images/diamond.png','/images/wave.png'
];
self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS)));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))));
});
self.addEventListener('fetch', e => {
  e.respondWith(
    caches.match(e.request).then(resp => resp || fetch(e.request).then(r => {
      const copy = r.clone();
      caches.open(CACHE_NAME).then(cache => cache.put(e.request, copy));
      return r;
    }).catch(() => caches.match('/en/index.html')))
  );
});
