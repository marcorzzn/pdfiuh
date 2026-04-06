import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  // Rimosso ogni plugin di framework. Solo build pura di TS/JS.
  plugins: [],
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
