import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/postcss';

const projectRoot = fileURLToPath(new URL('.', import.meta.url));
export default defineConfig({
  root: fileURLToPath(new URL('./pages-client', import.meta.url)),
  base: '/chuhan-xiangqi/',
  publicDir: fileURLToPath(new URL('./public', import.meta.url)),
  plugins: [react()],
  css: { postcss: { plugins: [tailwindcss()] } },
  resolve: { alias: { '@': projectRoot } },
  define: {
    __CHUHAN_API_ORIGIN__: JSON.stringify(
      'https://chuhan-friends-xiangqi.zhanglushan1.chatgpt.site',
    ),
  },
  build: {
    rollupOptions: {
      input: {
        main: fileURLToPath(
          new URL('./pages-client/index.html', import.meta.url),
        ),
        ai: fileURLToPath(
          new URL('./pages-client/ai/index.html', import.meta.url),
        ),
      },
    },
    outDir: fileURLToPath(new URL('./dist-pages', import.meta.url)),
    emptyOutDir: true,
  },
});
