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
      manifest: false,
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,pdf,wasm,webmanifest}']
      }
    })
  ],
  worker: { format: 'es' },
  optimizeDeps: {
    include: ['pdfjs-dist']
  },
  test: {
    environment: 'happy-dom'
  }
});
