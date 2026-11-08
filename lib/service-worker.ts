// The service worker (web/sw.js, served as /sw.js): only production builds register it, so
// the dev server never has one. With SERVICE_WORKER off in vite.config.ts the pages instead
// remove whatever an earlier visit installed, and its saved files.

/** Set by vite.config.ts. */
declare const __SERVICE_WORKER__: boolean;

export function startServiceWorker() {
  if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return;
  if (!__SERVICE_WORKER__) {
    void navigator.serviceWorker
      .getRegistrations()
      .then((all) => Promise.all(all.map((r) => r.unregister())))
      .catch(() => {});
    if (typeof caches !== 'undefined')
      void caches
        .keys()
        .then((keys) =>
          Promise.all(
            keys
              .filter((key) => key.startsWith('chuhan-'))
              .map((key) => caches.delete(key)),
          ),
        )
        .catch(() => {});
    return;
  }
  // Once the page has loaded, so the files the worker saves do not hold the page up.
  const register = () =>
    void navigator.serviceWorker.register('/sw.js').catch(() => {});
  if (document.readyState === 'complete') register();
  else addEventListener('load', register, { once: true });
}
