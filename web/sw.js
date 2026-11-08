/** @type {{ on: boolean, version: string, shell: string[], engine: string[], engineVersion: string }} */
const BUILD = {
  on: true,
  version: 'dev',
  shell: [],
  engine: [],
  engineVersion: 'dev',
};
// The service worker, served as /sw.js. vite.config.ts fills in BUILD above when it builds
// (SERVICE_WORKER there is the off switch) and lib/service-worker.ts registers it, in
// production builds only. What it touches:
// - Page loads go to the network first. Only when that fails do the two pages saved at
//   install answer: / for the lobby and /ai/ for the AI room, whatever the query
//   (?room=…, ?game=…). A friend room then fails to connect as it does today: /api/* is
//   never saved, so no old game is shown.
// - The build's hashed files (/assets/*) and the public files the pages load come from the
//   copy saved at install: a hashed name never changes content.
// - The engine is saved the first time /ai/ opens, and then served from that copy.
// - Nothing else is saved or answered from a copy. /api/*, other methods and other origins
//   go to the network as if there were no service worker (the /api/ page loads of signing
//   in pass through unchanged, see the fetch handler), and WebSockets never reach one.
// Responses are saved as the server sent them, headers included, so /ai/ and the engine
// keep the COOP and COEP of public/_headers offline and the page stays cross-origin
// isolated.
//
// Updates: every build that changes a page or the engine writes a new version in BUILD,
// and browsers check /sw.js on each page load (or within a day). The new worker saves its
// files, takes over as soon as the old one has finished what it is answering (skipWaiting,
// clients.claim) and deletes the old copies. It reloads no tab: pages come from the network
// anyway, so the next load is the new site; offline, the old copy until the new one has
// taken over.

const PREFIX = 'chuhan-';
const SHELL_CACHE = `${PREFIX}shell-${BUILD.version}`;
const ENGINE_CACHE = `${PREFIX}engine-${BUILD.engineVersion}`;
/** The pages in BUILD.shell; the rest of it is files. */
const PAGES = ['/', '/ai/'];

/** The saved page that stands in for `path` when the network fails. */
const savedPage = (path) =>
  path === '/' || path === '/index.html'
    ? '/'
    : path === '/ai' || path === '/ai/' || path === '/ai/index.html'
      ? '/ai/'
      : null;

async function saveShell() {
  const cache = await caches.open(SHELL_CACHE);
  for (const path of BUILD.shell) {
    if (await cache.match(path)) continue;
    // A hashed file the last version saved is the same file: copy it instead of fetching.
    let response = path.startsWith('/assets/')
      ? await caches.match(path)
      : undefined;
    if (!response) {
      response = await fetch(path, {
        cache: PAGES.includes(path) ? 'no-cache' : 'default',
      });
      if (!response.ok) throw new Error(`${path}: ${response.status}`);
    }
    // A page from another deploy would ask for files this version does not have: fail the
    // install, and the browser tries again on a later load.
    if (PAGES.includes(path)) {
      const html = await response.clone().text();
      for (const [file] of html.matchAll(/\/assets\/[^"'\s)?#]+/g))
        if (!BUILD.shell.includes(file))
          throw new Error(`${path} is from another build`);
    }
    await cache.put(path, response);
  }
}

async function saveEngine() {
  const cache = await caches.open(ENGINE_CACHE);
  for (const path of BUILD.engine) {
    if (await cache.match(path)) continue;
    const response = await fetch(path);
    if (response.ok) await cache.put(path, response);
  }
}

/** Switched off: deletes every saved file and unregisters, so the next load of each tab has
 * no service worker. Done at install already: activation waits until the old version is
 * idle, and that version, finding nothing saved, sends what it still handles to the
 * network. */
async function removeAll() {
  for (const key of await caches.keys())
    if (key.startsWith(PREFIX)) await caches.delete(key);
  // Not awaited: it runs once the install (or update) under way has ended, and waiting for
  // it from inside that install would wait forever.
  void self.registration.unregister();
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      if (!BUILD.on) await removeAll();
      else {
        await saveShell();
        // Someone who came straight to /ai/ loaded the engine before this worker existed.
        const windows = await self.clients.matchAll({
          type: 'window',
          includeUncontrolled: true,
        });
        if (windows.some((c) => savedPage(new URL(c.url).pathname) === '/ai/'))
          await saveEngine().catch(() => {});
      }
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      // This version handles no requests then: open tabs work over the network.
      if (!BUILD.on) return removeAll();
      for (const key of await caches.keys())
        if (
          key.startsWith(PREFIX) &&
          key !== SHELL_CACHE &&
          key !== ENGINE_CACHE
        )
          await caches.delete(key);
      // The page request starts while the worker wakes up, so network-first costs no wait.
      await self.registration.navigationPreload?.enable();
      await self.clients.claim();
    })(),
  );
});

/** The saved copy of `path`, if any, read in full: one deleted while it streamed (the off
 * switch at work) would cut the request short. A copy that cannot be read counts as none,
 * so it never keeps a request from the network. Status and headers come with it. */
async function copyOf(path, cacheName) {
  try {
    const saved = await caches.match(path, { cacheName });
    return saved && new Response(await saved.blob(), saved);
  } catch {
    return undefined;
  }
}

async function page(event, path) {
  try {
    const preloaded = await event.preloadResponse;
    return preloaded || (await fetch(event.request));
  } catch (error) {
    const saved = savedPage(path);
    const response = saved && (await copyOf(saved, SHELL_CACHE));
    if (response) return response;
    throw error;
  }
}

async function engineFile(event, path) {
  const saved = await copyOf(path, ENGINE_CACHE);
  if (saved) return saved;
  const response = await fetch(event.request);
  if (response.ok) {
    const copy = response.clone();
    event.waitUntil(
      caches
        .open(ENGINE_CACHE)
        .then((cache) => cache.put(path, copy))
        .catch(() => {}),
    );
  }
  return response;
}

async function shellFile(event, path) {
  return (await copyOf(path, SHELL_CACHE)) || fetch(event.request);
}

if (BUILD.on)
  self.addEventListener('fetch', (event) => {
    const { request } = event;
    const url = new URL(request.url);
    const path = url.pathname;
    if (request.method !== 'GET' || url.origin !== self.location.origin) return;
    // Navigation preload has already sent every page request, the /api/ ones of signing in
    // included: answering with that response keeps it from going out twice.
    if (request.mode === 'navigate') event.respondWith(page(event, path));
    else if (path.startsWith('/api/')) return;
    else if (BUILD.engine.includes(path))
      event.respondWith(engineFile(event, path));
    else if (BUILD.shell.includes(path) && !PAGES.includes(path))
      event.respondWith(shellFile(event, path));
  });
