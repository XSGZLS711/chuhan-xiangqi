// /.well-known/assetlinks.json: the Android app (android/twa-manifest.json) opens
// https://chuhanxiangqi.com in Chrome, and Chrome hides the address bar once this file, a
// static file in public/.well-known/, names the app and its signing key. Only that address
// vouches for the app. Staging and the workers.dev addresses serve the same files, so there
// the Worker answers first (run_worker_first in wrangler.jsonc) and the file is not found.
// The dev server and `vite preview` serve it, so it can be checked before a deploy.

const APP_HOSTS = new Set(['chuhanxiangqi.com', 'localhost', '127.0.0.1']);

export function assetLinks(req: Request, assets: Fetcher) {
  if (!APP_HOSTS.has(new URL(req.url).hostname))
    return new Response(null, { status: 404 });
  return assets.fetch(req);
}
