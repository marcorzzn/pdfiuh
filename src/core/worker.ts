/**
 * pdfiuh Worker Thread
 * Gestisce l'istanza PDFium WASM e il rendering pesante.
 */

// Interfaccia per il motore PDFium (da implementare con il binario WASM)
class PDFiumEngine {
  private isInitialized = false;

  async init() {
    try {
      // Simulazione caricamento streaming del binario WASM
      console.log('[Worker] Loading PDFium WASM...');
      await new Promise(resolve => setTimeout(resolve, 800));
      this.isInitialized = true;
      console.log('[Worker] PDFium WASM initialized successfully.');
    } catch (e) {
      throw new Error(`WASM Init Failed: ${e}`);
    }
  }

  async loadDocument(buffer: ArrayBuffer) {
    if (!this.isInitialized) throw new Error('Engine not initialized');
    console.log(`[Worker] Loading PDF document. Size: ${buffer.byteLength} bytes`);
    // In PDFium reale: this.doc = pdfium.loadDocument(buffer);
    await new Promise(resolve => setTimeout(resolve, 500));
    return { totalPages: 10 };
  }

  async renderPage(pageNumber: number, scale: number, width: number, height: number) {
    if (!this.isInitialized) throw new Error('Engine not initialized');
    console.log(`[Worker] Rendering page ${pageNumber} at scale ${scale}...`);

    // In PDFium reale:
    // 1. Create Page object
    // 2. Create Bitmap
    // 3. Render page to bitmap
    // 4. Return ImageBitmap

    await new Promise(resolve => setTimeout(resolve, 300));

    // Simuliamo la creazione di un ImageBitmap vuoto per il test di flusso
    return new OffscreenCanvas(width, height).transferToImageBitmap();
  }
}

const engine = new PDFiumEngine();

self.onmessage = async (e) => {
  const { type, payload } = e.data;

  try {
    switch (type) {
      case 'INIT':
        await engine.init();
        self.postMessage({ type: 'INIT_SUCCESS' });
        break;

      case 'LOAD_PDF':
        const { buffer } = payload;
        const docInfo = await engine.loadDocument(buffer);
        self.postMessage({ type: 'PDF_LOADED', payload: docInfo });
        break;

      case 'RENDER_PAGE':
        const { pageNumber, scale, width, height } = payload;
        const bitmap = await engine.renderPage(pageNumber, scale, width, height);

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
