// Service worker: lets the app start and run without internet once it has been opened online.
// Registered by js/sw-register.js from index.html, history.html and avatar.html. See "Offline use" in the README.
//
// Strategy: network first. Online, every file comes from the network (so people always get the
// newest version) and a copy is saved in the cache. Offline, or when the network hasn't answered
// within NETWORK_TIMEOUT_MS, the saved copy is used instead.
// Never touched: api/* and .netlify/* (backend), non-GET requests, other sites, Range requests.
// Also handles taps on the leave reminder notification (see "notifications" at the end).
//
// Netlify's Pretty URLs can serve history.html as /history (redirecting /history.html there and
// rewriting links to it), so every copy is saved and looked up under one address: see cacheKey.
//
// Every address is relative to the service worker's scope (the folder sw.js is in), so it works
// both at the domain root (Netlify) and under a subpath (GitHub Pages, /ConcenTraining/).

// Bump CACHE_VERSION whenever PRECACHE changes (a startup file added, removed or renamed).
// On activate every older "concentraining-" cache is deleted.
const CACHE_VERSION = 7;
const CACHE_PREFIX = "concentraining-";
const CACHE_NAME = `${CACHE_PREFIX}v${CACHE_VERSION}`;

// Everything needed to open index.html, run a session to the summary, and open history.html and the
// character editor (avatar.html) offline. Every language's texts are here (js/i18n/*.js), not only
// English: each app update starts a new cache, so a language that was only saved while it was used
// would be gone right after an update and the app would open in English offline. A new language
// file goes in this list (and CACHE_VERSION goes up). See "Languages" in the README.
// stats.html stays online-only (it needs api/stats anyway). index.html is saved as the scope (cacheKey).
const PRECACHE = [
  "index.html",
  "history.html",
  "avatar.html",
  "css/style.css",
  "js/i18n/languages.js",
  "js/i18n/en.js",
  "js/i18n/hu.js",
  "js/i18n/es.js",
  "js/i18n/pt-BR.js",
  "js/i18n/id.js",
  "js/i18n/fr.js",
  "js/i18n/de.js",
  "js/i18n/it.js",
  "js/i18n/pl.js",
  "js/i18n.js",
  "js/language-picker.js",
  "js/data/characters.js",
  "js/data/messages.js",
  "js/placeholder-art.js",
  "js/avatar-parts.js",
  "js/avatar-costumes.js",
  "js/avatar-art.js",
  "js/custom-characters.js",
  "js/avatar.js",
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

// The app's folder, e.g. "https://example.org/" on Netlify or
// "https://kantorhorvathambrus-source.github.io/ConcenTraining/" on GitHub Pages. Always ends in "/".
const SCOPE_URL = new URL(self.registration.scope);
const SCOPE_PATH = SCOPE_URL.pathname;

// ---------- install / activate ----------

// Gets every PRECACHE file as the server has it now and only saves them once all have arrived.
// cache: "no-cache" checks each file with the server first: a file the page has just downloaded
// comes back as a tiny "not modified" answer instead of a second full download, and a changed
// one is downloaded fresh. (Before, "reload" downloaded all of them again on the first visit.)
// If any one fails, the install fails and the app works as without a service worker (online
// only); the browser tries again on a later visit.
self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const responses = await Promise.all(
        PRECACHE.map(async (url) => {
          const response = await fetch(new Request(url, { cache: "no-cache" }));
          if (!response.ok) throw new Error(`Precache failed: ${url} (${response.status})`);
          return withoutRedirect(response);
        })
      );
      const cache = await caches.open(CACHE_NAME);
      await Promise.all(PRECACHE.map((url, i) => cache.put(cacheKey(url), responses[i])));
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

// Chrome refuses to show a page from a response that was redirected (e.g. history.html → /history),
// so save a plain copy.
async function withoutRedirect(response) {
  if (!response.redirected) return response;
  return new Response(await response.blob(), {
    status: response.status,
    statusText: response.statusText,
    headers: response.headers,
  });
}

// The one address a file is saved and looked up under, whichever address was asked for
// (shown here at the root; under a subpath the same rules apply inside the scope):
//   /index.html (and /index) → /     /history → /history.html     the ?query is dropped.
// A path ending in "/" (other than the scope) is left alone: relative links on it would break.
function cacheKey(url) {
  const { origin, pathname } = new URL(url, self.location.href);
  if (pathname === `${SCOPE_PATH}index.html` || pathname === `${SCOPE_PATH}index`) {
    return `${origin}${SCOPE_PATH}`;
  }
  const lastPart = pathname.slice(pathname.lastIndexOf("/") + 1);
  if (lastPart && !lastPart.includes(".")) return `${origin}${pathname}.html`;
  return `${origin}${pathname}`;
}

// The saved copy of a request, or undefined. ignoreVary: the copies are keyed by address only.
function fromCache(request) {
  return caches.match(cacheKey(request.url), { ignoreVary: true });
}

// ---------- fetch ----------

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith(`${SCOPE_PATH}api/`) || url.pathname.startsWith(`${SCOPE_PATH}.netlify/`)) {
    return;
  }
  if (request.headers.has("range")) return;

  event.respondWith(request.mode === "navigate" ? handlePage(event) : handleFile(event));
});

// A page (index.html, history.html, ...). Remembers where it came from for its files.
async function handlePage(event) {
  const { response, cached } = await networkFirst(event, NETWORK_TIMEOUT_MS);
  if (event.resultingClientId) {
    pageSources.set(event.resultingClientId, cached ? "cache" : "network");
    if (pageSources.size > MAX_PAGE_SOURCES) pageSources.delete(pageSources.keys().next().value);
  }
  return response;
}

// A file used by a page (CSS, JS, icons, artwork).
async function handleFile(event) {
  const source = pageSources.get(event.clientId);
  if (source === "cache") {
    const cached = await fromCache(event.request);
    if (cached) {
      // Still refresh the cache in the background, like the page itself, so the next start is up to date.
      refreshInBackground(event);
      return cached;
    }
  }
  const timeout = source === "network" ? FILE_TIMEOUT_AFTER_NETWORK_PAGE_MS : NETWORK_TIMEOUT_MS;
  return (await networkFirst(event, timeout)).response;
}

// Fetches from the network and saves a good same-origin answer in the cache, under cacheKey and
// never as a redirected response. A redirect itself (a page navigation gets it unfollowed, e.g.
// history.html → /history) isn't saved: the browser follows it and the page at the new address is.
// The service worker is kept alive until the copy is saved, even if the page was already answered
// from the cache.
function fetchAndSave(event) {
  const request = event.request;
  const network = fetch(request);
  event.waitUntil(
    network
      .then(async (response) => {
        if (!response.ok || response.type !== "basic") return;
        const copy = response.clone(); // before the page reads the body
        const cache = await caches.open(CACHE_NAME);
        await cache.put(cacheKey(request.url), await withoutRedirect(copy));
      })
      .catch(() => {})
  );
  return network;
}

function refreshInBackground(event) {
  fetchAndSave(event).catch(() => {});
}

// Network first, cache as the fallback. Resolves to { response, cached }.
// After timeoutMs without an answer the cached copy is used if there is one; the network request
// keeps going and still refreshes the cache. With nothing cached it keeps waiting for the network.
// A network error with nothing cached fails the request, just like without a service worker.
function networkFirst(event, timeoutMs) {
  const request = event.request;
  const network = fetchAndSave(event);

  return new Promise((resolve, reject) => {
    let done = false;
    let timer;
    const finish = (response, cached) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      resolve({ response, cached });
    };
    const tryCache = () =>
      fromCache(request)
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

// ---------- notifications ----------

// The leave reminder, shown by js/app.js while a session runs and the app has been left. Its text is
// set there, in the page's language: this file never needs it (and can't read the saved prefs).
// Tapping it closes it and brings back the app page: the open one if there is one (it runs the
// session), otherwise a new one at the scope, which picks up the saved session like a reload.
// history.html isn't used: the session lives on the app page. The page itself closes the
// notification whenever it's shown again, however that happens.
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      const app = windows.find((client) => cacheKey(client.url) === SCOPE_URL.href);
      if (app) {
        try {
          await app.focus();
          return;
        } catch {
          // not allowed to focus it: open the app instead
        }
      }
      await self.clients.openWindow(SCOPE_URL.href);
    })()
  );
});
