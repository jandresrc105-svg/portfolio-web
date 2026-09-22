import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vite';

export default defineConfig({
  resolve: {
    alias: {
      '@app': fileURLToPath(new URL('./src/app', import.meta.url)),
      '@features': fileURLToPath(new URL('./src/features', import.meta.url)),
      '@shared': fileURLToPath(new URL('./src/shared', import.meta.url)),
    },
  },
  css: {
    devSourcemap: true,
  },
  server: {
    port: 5173,
    host: true,
  },
  build: {
    target: 'es2022',
    sourcemap: true,
    chunkSizeWarningLimit: 700,
    rolldownOptions: {
      output: {
        advancedChunks: {
          groups: [
            { name: 'three', test: /node_modules[\\/](three|postprocessing)[\\/]/ },
            { name: 'motion', test: /node_modules[\\/](gsap|lenis)[\\/]/ },
          ],
        },
      },
    },
  },
});
