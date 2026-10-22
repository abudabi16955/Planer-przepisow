/* Build replaces these constants with a content hash and the emitted shell files. */
const CACHE_NAME = '__BUILD_CACHE__';
/** @type {string[]} */
const SHELL = [];
const shellPaths = new Set(SHELL);
const worker = /** @type {ServiceWorkerGlobalScope} */ (
  /** @type {unknown} */ (self)
);

worker.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      await cache.addAll(SHELL);
      await worker.skipWaiting();
    }),
  );
});
worker.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(async (keys) => {
      await Promise.all(
        keys
          .filter(
            (key) => key.startsWith('planer-shell-') && key !== CACHE_NAME,
          )
          .map((key) => caches.delete(key)),
      );
      await worker.clients.claim();
    }),
  );
});
worker.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);
  if (
    request.method !== 'GET' ||
    url.origin !== worker.location.origin ||
    /^\/(api|files)(\/|$)/.test(url.pathname) ||
    request.headers.has('range')
  )
    return;
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(async () => {
        const cached = await (
          await caches.open(CACHE_NAME)
        ).match('/index.html');
        return cached || Response.error();
      }),
    );
  } else if (shellPaths.has(url.pathname)) {
    event.respondWith(
      caches
        .open(CACHE_NAME)
        .then(
          async (cache) => (await cache.match(url.pathname)) || fetch(request),
        ),
    );
  }
});
