import { defineConfig } from 'vite';
import path from 'path';

// https://vitejs.dev/config/
export default defineConfig({
  // Base path for GitHub Pages deployment (repo name).
  // Must match the GitHub repository name exactly.
  // Verified for production deployment: https://marcorzzn.github.io/pdfiuh/
  base: '/pdfiuh/',

  // Treat .wasm imports as assets, served with the correct MIME type.
  // wasm-bindgen's --target web output is loaded via init() at runtime, not bundled.
  assetsInclude: ['**/*.wasm'],

  build: {
    // Output directory consumed by GitHub Actions / deploy workflow.
    outDir: 'dist',
    // Do not inline assets — keep WASM as a separate fetch for cache efficiency.
    assetsInlineLimit: 0,
    // Target modern browsers that support WASM + ES2022.
    // Legacy browsers are out of scope (we target modern runtime on any hardware).
    target: 'es2022',
    // Minification: esbuild is the fastest option — no extra deps, sub-millisecond.
    minify: 'esbuild',
    rollupOptions: {
      input: {
        main: path.resolve(import.meta.dirname, 'index.html'),
      },
    },
  },

  worker: {
    // Use ESM format for workers — enables tree-shaking inside the worker bundle.
    format: 'es',
  },

  optimizeDeps: {
    // Do NOT pre-bundle pdfjs-dist — it ships its own worker which must remain
    // a separate chunk. Pre-bundling breaks the worker URL resolution.
    exclude: ['pdfjs-dist'],
  },

  server: {
    // Cross-Origin Isolation headers required by SharedArrayBuffer (used by PDF.js worker).
    // These are set at the *dev server* level. For production (GitHub Pages) they are
    // injected by the deploy workflow via a custom _headers file.
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp',
    },
    port: 5173,
    strictPort: false,
  },

  preview: {
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp',
    },
  },
});
