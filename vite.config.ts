import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';

export default defineConfig({
  base: '/pdfiuh/',
  plugins: [svelte()],
  optimizeDeps: {
    // PDF.js deve essere esplicitamente incluso in optimizeDeps per il bundling corretto in Vite
    include: ['pdfjs-dist']
  },
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
        // Separa PDF.js in chunk dedicato per performance
        manualChunks: {
          pdfjs: ['pdfjs-dist']
        }
      }
    },
    terserOptions: {
      compress: { drop_console: false, drop_debugger: true }
    }
  }
});
