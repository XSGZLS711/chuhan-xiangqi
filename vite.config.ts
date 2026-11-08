import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { cloudflare } from '@cloudflare/vite-plugin';
import tailwindcss from '@tailwindcss/postcss';
import react from '@vitejs/plugin-react';
import { defineConfig, type Plugin } from 'vite';

const projectRoot = fileURLToPath(new URL('.', import.meta.url));

// The service worker (web/sw.js): the site installs as an app, its two pages open offline,
// and the AI engine stays on the device. The off switch: set this to false and deploy.
// Every browser that has the worker then installs a version that deletes its saved files
// and unregisters itself on its next page load (at the latest within a day), and the pages
// stop registering it. Back on: true, and deploy.
const SERVICE_WORKER = true;

// Production sends these headers from public/_headers. The dev server serves
// public files itself, so it needs them too: the AI engine worker must carry
// the same isolation headers as its page.
const aiIsolationHeaders = {
  name: 'ai-isolation-headers',
  configureServer(server: {
    middlewares: {
      use: (
        handler: (
          req: { url?: string },
          res: { setHeader: (name: string, value: string) => void },
          next: () => void,
        ) => void,
      ) => void;
    };
  }) {
    server.middlewares.use((req, res, next) => {
      if (req.url?.startsWith('/ai')) {
        res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
        res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp');
      }
      next();
    });
  },
};

/** Writes sw.js from web/sw.js: what it saves, and a version that changes with any of it, so
 * each deploy that changes a page or the engine installs a new worker. */
const serviceWorker: Plugin = {
  name: 'service-worker',
  // After the HTML pages are in the bundle.
  enforce: 'post',
  generateBundle(_options, bundle) {
    if (this.environment.name !== 'client') return;
    const file = (path: string) =>
      readFileSync(fileURLToPath(new URL('.' + path, import.meta.url)));
    const hash = (parts: (string | Uint8Array)[]) => {
      const sha = createHash('sha256');
      for (const part of parts) sha.update(part);
      return sha.digest('hex').slice(0, 16);
    };
    const html = ['index.html', 'ai/index.html'].map((name) => {
      const page = bundle[name];
      if (page?.type !== 'asset') throw new Error(`没有 ${name}`);
      return page.source;
    });
    // The public files the pages load: the tab icon and the move sound (lib/game-audio.ts).
    const loaded = ['/icon.svg', '/sounds/move.mp3'];
    const engine = [
      '/ai/engine-host.js',
      '/ai/engine/stockfish.js',
      '/ai/engine/stockfish.wasm',
      '/ai/engine/stockfish.worker.js',
    ];
    const shell = [
      '/',
      '/ai/',
      ...Object.keys(bundle)
        .filter((name) => name.startsWith('assets/'))
        .sort()
        .map((name) => '/' + name),
      ...loaded,
    ];
    const template = file('/web/sw.js').toString();
    const engineVersion = hash(engine.map((path) => file('/public' + path)));
    const build = SERVICE_WORKER
      ? {
          on: true,
          version: hash([
            template,
            JSON.stringify(shell),
            ...html,
            ...loaded.map((path) => file('/public' + path)),
            engineVersion,
          ]),
          shell,
          engine,
          engineVersion,
        }
      : {
          on: false,
          version: 'off',
          shell: [],
          engine: [],
          engineVersion: 'off',
        };
    const source = template.replace(
      /^const BUILD = \{[\s\S]*?\};$/m,
      `const BUILD = ${JSON.stringify(build)};`,
    );
    if (source === template) throw new Error('web/sw.js 缺少 BUILD 行');
    this.emitFile({ type: 'asset', fileName: 'sw.js', source });
  },
};

export default defineConfig({
  plugins: [aiIsolationHeaders, react(), cloudflare(), serviceWorker],
  // Whether the pages register the worker or remove it (lib/service-worker.ts).
  define: { __SERVICE_WORKER__: JSON.stringify(SERVICE_WORKER) },
  css: { postcss: { plugins: [tailwindcss()] } },
  resolve: { alias: { '@': projectRoot } },
  environments: {
    // Two HTML pages (friends, AI). The Worker environment has its own entry.
    client: {
      build: {
        // Minifying drops the bundled packages' notices, so they are listed here.
        license: { fileName: 'third-party-licenses.md' },
        rolldownOptions: {
          input: {
            main: fileURLToPath(new URL('./index.html', import.meta.url)),
            ai: fileURLToPath(new URL('./ai/index.html', import.meta.url)),
          },
        },
      },
    },
  },
});
