import { fileURLToPath } from 'node:url';
import { cloudflare } from '@cloudflare/vite-plugin';
import tailwindcss from '@tailwindcss/postcss';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

const projectRoot = fileURLToPath(new URL('.', import.meta.url));

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

export default defineConfig({
  plugins: [aiIsolationHeaders, react(), cloudflare()],
  css: { postcss: { plugins: [tailwindcss()] } },
  resolve: { alias: { '@': projectRoot } },
  environments: {
    // Two HTML pages (friends, AI). The Worker environment has its own entry.
    client: {
      build: {
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
