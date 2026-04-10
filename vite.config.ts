import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';

export default defineConfig({
  base: '/pdfiuh/',
  plugins: [svelte()],
  optimizeDeps: {
    // Evita che Vite pre-bundle PDF.js (non funziona bene con i worker interni)
    exclude: ['pdfjs-dist']
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
