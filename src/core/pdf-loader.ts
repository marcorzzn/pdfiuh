import * as pdfjsLib from 'pdfjs-dist';
import type { PDFDocumentProxy, PDFPageProxy } from 'pdfjs-dist';

// Configurazione del worker per PDF.js
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url
).toString();

/**
 * pdfiuh PDF Loader
 * Gestisce il caricamento e il rendering di PDF utilizzando PDF.js
 */

// Interfaccia per il motore PDF.js (invece del simulato PDFium)
class PDFJSWorker {

  private pdfDocument: PDFDocumentProxy | null = null;
  private isInitialized = false;

  async init() {
    try {
      // PDF.js non richiede inizializzazione esplicita, ma possiamo verificare che sia disponibile
      if (typeof pdfjsLib === 'undefined') {
        throw new Error('PDF.js not loaded');
      }

      // Configuriamo PDF.js per evitare di usare worker esterni se non necessario
      // In un worker, vogliamo usare la versione costruita direttamente
      this.isInitialized = true;
      console.log('[Worker] PDF.js ready');
    } catch (e) {
      throw new Error(`PDF.js Init Failed: ${e}`);
    }
  }

  async loadDocument(buffer: ArrayBuffer) {
    if (!this.isInitialized) throw new Error('Worker not initialized');

    console.log(`[Worker] Loading PDF document. Size: ${buffer.byteLength} bytes`);

    // Carichiamo il documento PDF usando PDF.js
    const loadingTask = pdfjsLib.getDocument({ data: buffer });
    this.pdfDocument = await loadingTask.promise;

    console.log(`[Worker] PDF loaded. Total pages: ${this.pdfDocument.numPages}`);
    return { totalPages: this.pdfDocument.numPages };
  }

  async getOutline() {
    if (!this.pdfDocument) throw new Error('Document not loaded');

    console.log('[Worker] Extracting PDF outline...');

    try {
      const outline = await this.pdfDocument.getOutline();

      // Convertiamo l'outline di PDF.js in un formato più semplice
      const extractOutlineItems = (items: any[]): any[] => {
        return items.map(item => ({
          title: item.title,
          page: item.dest ? this.pdfDocument.getPageIndex(item.dest[0]) + 1 : 0,
          items: extractOutlineItems(item.items || [])
        }));
      };

      const outlineItems = await this.pdfDocument.getOutline();
      const formattedOutline = extractOutlineItems(outlineItems);

      return formattedOutline;
    } catch (e) {
      console.warn('[Worker] Could not extract outline:', e);
      return []; // Restituiamo outline vuoto se non disponibile
    }
  }

  async renderPage(pageNumber: number, scale: number, width: number, height: number) {
    if (!this.pdfDocument) throw new Error('Document not loaded');

    console.log(`[Worker] Rendering page ${pageNumber} at scale ${scale}...`);

    try {
      // Otteniamo la pagina richiesta (PDF.js usa indicizzazione base 0)
      const pdfPage = await this.pdfDocument.getPage(pageNumber);

      // Creiamo un viewport con la scala desiderata
      const viewport = pdfPage.getViewport({ scale });

      // Creiamo un OffscreenCanvas per il rendering
      const canvas = new OffscreenCanvas(viewport.width, viewport.height);
      const ctx = canvas.getContext('2d');

      if (!ctx) {
        throw new Error('Could not get canvas context');
      }

      // Renderizziamo la pagina sul canvas
      const renderContext = {
        canvasContext: ctx,
        viewport: viewport
      };

      await pdfPage.render(renderContext).promise;

      // Restituiamo l'ImageBitmap per il trasferimento efficiente al main thread
      return canvas.transferToImageBitmap();
    } catch (e) {
      console.error(`[Worker] Error rendering page ${pageNumber}:`, e);
      throw e;
    }
  }
}

// Istanza singola del worker
const pdfWorker = new PDFJSWorker();

self.onmessage = async (e) => {
  const { type, payload } = e.data;

  try {
    switch (type) {
      case 'INIT':
        await pdfWorker.init();
        self.postMessage({ type: 'INIT_SUCCESS' });
        break;

      case 'LOAD_PDF':
        const { buffer } = payload;
        const docInfo = await pdfWorker.loadDocument(buffer);
        const outline = await pdfWorker.getOutline();
        self.postMessage({ type: 'PDF_LOADED', payload: { ...docInfo, outline } });
        break;

      case 'RENDER_PAGE':
        const { pageNumber, scale, width, height } = payload;
        const bitmap = await pdfWorker.renderPage(pageNumber, scale, width, height);

        // Trasferiamo il bitmap al main thread senza copiarlo
        self.postMessage({
          type: 'PAGE_RENDERED',
          payload: { pageNumber, bitmap }
        }, [bitmap]);
        break;

      default:
        console.warn(`Unknown message type: ${type}`);
    }
  } catch (err) {
    self.postMessage({ type: 'ERROR', payload: err.message });
  }
};