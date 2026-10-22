// Service worker: lets the app start and run without internet once it has been opened online.
// Registered by js/sw-register.js from index.html and history.html. See "Offline use" in the README.
//
// Strategy: network first. Online, every file comes from the network (so people always get the
// newest version) and a copy is saved in the cache. Offline, or when the network hasn't answered
// within NETWORK_TIMEOUT_MS, the saved copy is used instead.
// Never touched: /api/* and /.netlify/* (backend), non-GET requests, other sites, Range requests.

// Bump CACHE_VERSION whenever PRECACHE changes (a startup file added, removed or renamed).
// On activate every older "concentraining-" cache is deleted.
const CACHE_VERSION = 1;
const CACHE_PREFIX = "concentraining-";
const CACHE_NAME = `${CACHE_PREFIX}v${CACHE_VERSION}`;

// Everything needed to open index.html, run a session to the summary and open history.html offline.
// stats.html stays online-only (it needs /api/stats anyway).
const PRECACHE = [
  "./",
  "index.html",
  "history.html",
  "css/style.css",
  "js/data/characters.js",
  "js/data/messages.js",
  "js/placeholder-art.js",
  "js/history-store.js",
  "js/app.js",
  "js/history.js",
  "js/sw-register.js",
  "manifest.webmanifest",
  "favicon.ico",
  "icons/icon-192.png",
  "icons/icon-512.png",
  "icons/icon-maskable-512.png",
  "icons/apple-touch-icon.png",
];

// A weak signal shouldn't leave the page hanging: after this long, use the cached copy.
const NETWORK_TIMEOUT_MS = 3000;
// The page itself just came from the network, so its files get longer before falling back to
// the cache (a fallback here would mix new and old files, see pageSources).
const FILE_TIMEOUT_AFTER_NETWORK_PAGE_MS = 10000;

// Mixed-version guard: where each open page came from, by client id ("cache" or "network").
// A page served from the cache gets its other files from the cache too, so an old page never
// runs with a new app.js. Lost when the browser stops the service worker, which is fine: by then
// the page has loaded all its files.
const pageSources = new Map();
const MAX_PAGE_SOURCES = 50;

// ---------- install / activate ----------

// Downloads every PRECACHE file fresh (bypassing the browser's HTTP cache) and only saves them
// once all have arrived. If any one fails, the install fails and the app works as without a
// service worker (online only); the browser tries again on a later visit.
self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const responses = await Promise.all(
        PRECACHE.map(async (url) => {
          const response = await fetch(new Request(url, { cache: "reload" }));
          if (!response.ok) throw new Error(`Precache failed: ${url} (${response.status})`);
          return withoutRedirect(response);
        })
      );
      const cache = await caches.open(CACHE_NAME);
      await Promise.all(PRECACHE.map((url, i) => cache.put(url, responses[i])));
      // Take over right away instead of waiting until every tab of the app is closed. This
      // never reloads or interrupts an open page: it keeps running the code it already loaded.
      await self.skipWaiting();
    })()
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys();
      await Promise.all(
        names
          .filter((name) => name.startsWith(CACHE_PREFIX) && name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      );
      // Handle requests from pages that are already open (e.g. the very first visit), without reloading them.
      await self.clients.claim();
    })()
  );
});

// Chrome refuses to show a page from a response that was redirected, so save a plain copy.
async function withoutRedirect(response) {
  if (!response.redirected) return response;
  return new Response(await response.blob(), {
    status: response.status,
    statusText: response.statusText,
    headers: response.headers,
  });
}

// ---------- fetch ----------

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/") || url.pathname.startsWith("/.netlify/")) return;
  if (request.headers.has("range")) return;

  event.respondWith(request.mode === "navigate" ? handlePage(event) : handleFile(event));
});

// A page (index.html, history.html, ...). Remembers where it came from for its files.
async function handlePage(event) {
  // ignoreSearch: "/?anything" still opens offline from the cached "/".
  const { response, fromCache } = await networkFirst(event, NETWORK_TIMEOUT_MS, { ignoreSearch: true });
  if (event.resultingClientId) {
    pageSources.set(event.resultingClientId, fromCache ? "cache" : "network");
    if (pageSources.size > MAX_PAGE_SOURCES) pageSources.delete(pageSources.keys().next().value);
  }
  return response;
}

// A file used by a page (CSS, JS, icons, artwork).
async function handleFile(event) {
  const source = pageSources.get(event.clientId);
  if (source === "cache") {
    const cached = await caches.match(event.request);
    if (cached) {
      // Still refresh the cache in the background, like the page itself, so the next start is up to date.
      refreshInBackground(event);
      return cached;
    }
  }
  const timeout = source === "network" ? FILE_TIMEOUT_AFTER_NETWORK_PAGE_MS : NETWORK_TIMEOUT_MS;
  return (await networkFirst(event, timeout)).response;
}

// Fetches from the network and saves a good same-origin answer in the cache. The service worker
// is kept alive until the copy is saved, even if the page was already answered from the cache.
function fetchAndSave(event) {
  const request = event.request;
  const network = fetch(request);
  event.waitUntil(
    network
      .then((response) => {
        if (!response.ok || response.type !== "basic") return;
        const copy = response.clone(); // before the page reads the body
        return caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
      })
      .catch(() => {})
  );
  return network;
}

function refreshInBackground(event) {
  fetchAndSave(event).catch(() => {});
}

// Network first, cache as the fallback. Resolves to { response, fromCache }.
// After timeoutMs without an answer the cached copy is used if there is one; the network request
// keeps going and still refreshes the cache. With nothing cached it keeps waiting for the network.
// A network error with nothing cached fails the request, just like without a service worker.
function networkFirst(event, timeoutMs, matchOptions) {
  const request = event.request;
  const network = fetchAndSave(event);

  return new Promise((resolve, reject) => {
    let done = false;
    let timer;
    const finish = (response, fromCache) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      resolve({ response, fromCache });
    };
    const tryCache = () =>
      caches
        .match(request, matchOptions)
        .then((cached) => {
          if (cached) finish(cached, true);
          return cached;
        })
        .catch(() => undefined);

    timer = setTimeout(tryCache, timeoutMs);
    network.then(
      (response) => finish(response, false),
      (error) =>
        tryCache().then((cached) => {
          if (!cached && !done) {
            done = true;
            clearTimeout(timer);
            reject(error);
          }
        })
    );
  });
}
