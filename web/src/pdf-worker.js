/**
 * pdfiuh Web — Web Worker PDF.js
 *
 * Esegue interamente off-main-thread. Non ha accesso al DOM.
 *
 * Protocollo messaggi (IN → OUT):
 *
 *   IN  { type: 'LOAD', buffer: ArrayBuffer }
 *   OUT { type: 'LOADED', pageCount: number }
 *     | { type: 'LOAD_ERROR', message: string }
 *
 *   IN  { type: 'RENDER', pageIndex: number, scale: number }
 *   OUT { type: 'RENDERED', pageIndex, bitmap, width, height }
 *     | { type: 'RENDER_ERROR', pageIndex, message: string }
 *
 * Tutti i trasferimenti di dati pesanti (ArrayBuffer, ImageBitmap) avvengono
 * tramite `transfer` — zero-copy, nessuna duplicazione heap.
 */

import * as pdfjsLib from 'pdfjs-dist';

// In un Web Worker siamo già il worker: non serve un worker annidato.
// Passiamo una stringa vuota per disabilitare il worker interno di PDF.js
// e farlo girare in modalità sincrona dentro questo worker.
pdfjsLib.GlobalWorkerOptions.workerSrc = '';

/** @type {import('pdfjs-dist').PDFDocumentProxy | null} */
let pdfDocument = null;

// ---------------------------------------------------------------------------
// Router messaggi
// ---------------------------------------------------------------------------

self.addEventListener('message', async (e) => {
  const { type } = e.data;
  if      (type === 'LOAD')    await handleLoad(e.data);
  else if (type === 'RENDER')  await handleRender(e.data);
  else if (type === 'DESTROY') await handleDestroy();
  else    console.warn('[pdf-worker] Tipo messaggio sconosciuto:', type);
});

// ---------------------------------------------------------------------------
// Gestione Memoria (Regola d'Oro)
// ---------------------------------------------------------------------------

async function handleDestroy() {
  if (pdfDocument) {
    try {
      await pdfDocument.destroy();
    } catch (err) {
      console.warn('[pdf-worker] Errore in destroy():', err);
    }
    pdfDocument = null;
  }
}

// ---------------------------------------------------------------------------
// LOAD
// ---------------------------------------------------------------------------

/**
 * @param {{ buffer: ArrayBuffer }} data
 */
async function handleLoad({ buffer }) {
  // Assicura la pulizia del documento precedente
  await handleDestroy();

  try {
    const typedArray = new Uint8Array(buffer);

    const loadingTask = pdfjsLib.getDocument({
      data: typedArray,
      // Abbiamo già il buffer completo in memoria: inutile range request.
      disableRange:  true,
      disableStream: true,
      // Riduci overhead font per hardware lento.
      useSystemFonts: true,
    });

    pdfDocument = await loadingTask.promise;
    self.postMessage({ type: 'LOADED', pageCount: pdfDocument.numPages });
  } catch (err) {
    self.postMessage({ type: 'LOAD_ERROR', message: String(err?.message ?? err) });
  }
}

// ---------------------------------------------------------------------------
// RENDER
// ---------------------------------------------------------------------------

/**
 * @param {{ pageIndex: number, scale: number }} data
 *   `pageIndex` è 0-based; PDF.js usa internamente 1-based.
 */
async function handleRender({ pageIndex, scale }) {
  if (!pdfDocument) {
    self.postMessage({
      type:      'RENDER_ERROR',
      pageIndex,
      message:   'Nessun documento caricato',
    });
    return;
  }

  let page = null;
  try {
    // PDF.js: le pagine sono 1-indexed.
    page = await pdfDocument.getPage(pageIndex + 1);

    const viewport = page.getViewport({ scale });
    const width    = Math.floor(viewport.width);
    const height   = Math.floor(viewport.height);

    // OffscreenCanvas: rendering completamente off-thread, zero accesso DOM.
    const offscreen = new OffscreenCanvas(width, height);
    const ctx = offscreen.getContext('2d');
    if (!ctx) throw new Error('getContext("2d") fallito su OffscreenCanvas');

    // Sfondo bianco esplicito (PDF.js non lo garantisce sempre).
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);

    await page.render({ canvasContext: ctx, viewport }).promise;

    // transferToImageBitmap: ownership passa al main thread (zero-copy).
    const bitmap = offscreen.transferToImageBitmap();

    self.postMessage(
      { type: 'RENDERED', pageIndex, bitmap, width, height },
      [bitmap], // transfer list
    );
  } catch (err) {
    self.postMessage({
      type:    'RENDER_ERROR',
      pageIndex,
      message: String(err?.message ?? err),
    });
  } finally {
    // Libera la memoria interna di PDF.js per la pagina renderizzata.
    page?.cleanup();
  }
}
