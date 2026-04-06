import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  base: '/pdfiuh/',
  plugins: [
    svelte({
      compilerOptions: {
        runes: true
      }
    }),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      // manifest: false usa public/manifest.webmanifest (quello con start_url corretto)
      manifest: false,
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,pdf,wasm,webmanifest}'],
        // FIX: esclude pdf.worker.mjs dal precache (già servito dal worker bundle)
        globIgnores: ['**/pdf.worker.*']
      }
    })
  ],
  // Worker bundling in formato ES module
  worker: { format: 'es' },
  optimizeDeps: {
    // FIX BUG #3: exclude invece di include.
    // pdfjs-dist deve restare ESM puro per essere importato nel Worker context.
    // Con 'include' Vite lo pre-bundla in CJS-compat per il main thread,
    // rompendo l'import dal Worker bundled con format: 'es'.
    exclude: ['pdfjs-dist']
  },
  test: {
    environment: 'happy-dom'
  }
});
