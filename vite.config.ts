import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';

export default defineConfig({
  base: '/pdfiuh/',
  plugins: [svelte()],
  worker: {
    format: 'es',
    rollupOptions: {
      output: {
        entryFileNames: 'assets/[name]-[hash].js'
      }
    }
  },
  build: {
    outDir: 'dist',
    minify: 'terser',
    rollupOptions: {
      output: {
        manualChunks: undefined
      }
    },
    terserOptions: {
      compress: { drop_console: false, drop_debugger: true }
    }
  }
});
