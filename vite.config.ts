import { defineConfig } from 'vite';

export default defineConfig({
  base: '/pdfiuh/',
<<<<<<< HEAD
  plugins: [svelte()],
  optimizeDeps: {
    // PDF.js deve essere esplicitamente incluso in optimizeDeps per il bundling corretto in Vite
    include: ['pdfjs-dist']
  },
=======
>>>>>>> 692cdb1 (Refactor: Rifondazione architettura Fluent UI, worker estrazione testo e virtual scrolling)
  worker: {
    format: 'es',
    rollupOptions: {
      output: {
        entryFileNames: 'assets/[name].[hash].js'
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
