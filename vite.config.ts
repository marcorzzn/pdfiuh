import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';

export default defineConfig({
  plugins: [
    svelte({
      compilerOptions: {
        runes: true
      }
    })
  ],
  worker: { format: 'es' },
  build: {
    rollupOptions: {
      output: {
        manualChunks: { pdfjs: ['pdfjs-dist'] }
      }
    }
  }
});
