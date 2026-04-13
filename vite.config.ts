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
