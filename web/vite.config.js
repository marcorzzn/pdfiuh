import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

// https://vitejs.dev/config/
export default defineConfig({
  base: '/pdfiuh/',
  plugins: [react()],
  assetsInclude: ['**/*.wasm'],
  build: {
    outDir: 'dist',
    assetsInlineLimit: 0,
    target: 'es2022',
    minify: 'esbuild',
  },
  worker: {
    format: 'es',
  },
  optimizeDeps: {
    exclude: ['pdfjs-dist'],
  },
  server: {
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp',
    },
    port: 5173,
    strictPort: false,
  },
});