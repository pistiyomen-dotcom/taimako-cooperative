const fs = require('fs');

const sw = `const CACHE = 'taimako-v16';
const ASSETS = ['./','./index.html','./styles.css','./config.js','./app.js','./manifest.webmanifest'];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE)
      .then(cache => cache.addAll(ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(key => key !== CACHE).map(key => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET' || event.request.url.includes('/api/')) return;

  event.respondWith(
    fetch(event.request)
      .then(response => {
        const copy = response.clone();
        caches.open(CACHE).then(cache => cache.put(event.request, copy));
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});
`;

fs.writeFileSync('www/sw.js', sw);

let index = fs.readFileSync('www/index.html', 'utf8');
index = index.replace('<script src="app.js"></script>', '<script src="app.js?v=16"></script>');
index = index.replace('<link rel="stylesheet" href="styles.css">', '<link rel="stylesheet" href="styles.css?v=16">');
fs.writeFileSync('www/index.html', index);

let app = fs.readFileSync('www/app.js', 'utf8');
const oldReg = "if ('serviceWorker' in navigator) window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js'));";
const newReg = `if ('serviceWorker' in navigator) window.addEventListener('load', async () => {
  try {
    const reg = await navigator.serviceWorker.register('./sw.js?v=16', { updateViaCache: 'none' });
    await reg.update();
  } catch (err) {
    console.warn('Service worker update failed:', err);
  }
});`;
if (!app.includes(oldReg)) {
  console.error('Stage 16 service-worker registration target not found');
  process.exit(1);
}
app = app.replace(oldReg, newReg);
fs.writeFileSync('www/app.js', app);

console.log('TAIMAKO Stage 16 browser cache refresh fix applied.');