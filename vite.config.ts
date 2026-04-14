/// <reference types="vitest" />
import { defineConfig } from 'vite';

export default defineConfig({
  base: '/pdfiuh/',
  worker: {
    format: 'es',
    rollupOptions: {
      output: {
        entryFileNames: 'assets/[name].[hash].js'
      }
    }
  },
  optimizeDeps: { include: ['pdfjs-dist'] },
  build: {
    outDir: 'dist',
    minify: 'terser',
    terserOptions: {
      compress: { drop_console: false, drop_debugger: true }
    }
  },
  test: {
    environment: 'jsdom',
    globals: true,
  }
});
