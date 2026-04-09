import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';

export default defineConfig({
  base: './',
  plugins: [svelte()],
  worker: {
    format: 'es'
  },
  build: {
    outDir: 'dist',
    minify: 'terser', // Massima compressione per l'Atom N455
    terserOptions: {
      compress: {
        drop_console: true,
        drop_debugger: true
      }
    }
  }
});