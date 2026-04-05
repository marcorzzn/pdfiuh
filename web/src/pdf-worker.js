/**
 * pdfiuh — PDF.js Rendering Web Worker
 *
 * Runs entirely off the main thread. Receives messages from the orchestrator
 * (main.js) and emits back rendered page bitmaps.
 *
 * Protocol
 * ────────
 * IN  { type: 'LOAD',   buffer: ArrayBuffer }
 *       → Loads a PDF. buffer is transferred (zero-copy).
 * OUT { type: 'LOADED', pageCount: number }
 *       | { type: 'LOAD_ERROR', message: string }
 *
 * IN  { type: 'RENDER', pageIndex: number, scale: number }
 *       → Renders a page at the given scale.
 * OUT { type: 'RENDERED', pageIndex: number, bitmap: ImageBitmap, width: number, height: number }
 *       | { type: 'RENDER_ERROR', pageIndex: number, message: string }
 *
 * Memory discipline: each ImageBitmap is transferred (not cloned) back to the
 * main thread — zero copy, zero duplicate heap usage.
 */

import * as pdfjsLib from 'pdfjs-dist';

// Point PDF.js at its own worker shim.
// In a Web Worker context we ARE the worker, so we use the fake worker path
// that instructs PDF.js to run synchronously within this worker.
pdfjsLib.GlobalWorkerOptions.workerSrc = '';

/** @type {import('pdfjs-dist').PDFDocumentProxy | null} */
let pdfDocument = null;

// ─── Message Router ─────────────────────────────────────────────────────────

self.addEventListener('message', async (e) => {
  const { type } = e.data;

  if (type === 'LOAD')   { await handleLoad(e.data);   return; }
  if (type === 'RENDER') { await handleRender(e.data); return; }

  console.warn('[pdf-worker] Unknown message type:', type);
});

// ─── LOAD ────────────────────────────────────────────────────────────────────

/**
 * @param {{ buffer: ArrayBuffer }} data
 */
async function handleLoad({ buffer }) {
  try {
    // Transfer the buffer to a typed array view — no copy needed.
    const typedArray = new Uint8Array(buffer);

    const loadingTask = pdfjsLib.getDocument({
      data: typedArray,
      // Disable range requests — we already have the full buffer in memory.
      disableRange: true,
      disableStream: true,
      // Avoid worker-inside-worker issues.
      useSystemFonts: true,
      // Improve performance on lower-end hardware.
      disableFontFace: false,
    });

    pdfDocument = await loadingTask.promise;

    self.postMessage({ type: 'LOADED', pageCount: pdfDocument.numPages });
  } catch (err) {
    self.postMessage({ type: 'LOAD_ERROR', message: err.message ?? String(err) });
  }
}

// ─── RENDER ──────────────────────────────────────────────────────────────────

/**
 * @param {{ pageIndex: number, scale: number }} data
 *   pageIndex is 0-based; PDF.js uses 1-based page numbers internally.
 */
async function handleRender({ pageIndex, scale }) {
  if (!pdfDocument) {
    self.postMessage({
      type: 'RENDER_ERROR',
      pageIndex,
      message: 'No document loaded',
    });
    return;
  }

  try {
    // PDF.js pages are 1-indexed.
    const page = await pdfDocument.getPage(pageIndex + 1);
    const viewport = page.getViewport({ scale });

    // Allocate an OffscreenCanvas for rendering completely off the main thread.
    const offscreen = new OffscreenCanvas(
      Math.floor(viewport.width),
      Math.floor(viewport.height),
    );
    const ctx = offscreen.getContext('2d');
    if (!ctx) throw new Error('Failed to get 2D context from OffscreenCanvas');

    await page.render({ canvasContext: ctx, viewport }).promise;

    // Convert to ImageBitmap for zero-copy transfer to main thread.
    const bitmap = offscreen.transferToImageBitmap();

    // Transfer the bitmap — main thread takes ownership, worker releases it.
    self.postMessage(
      { type: 'RENDERED', pageIndex, bitmap, width: offscreen.width, height: offscreen.height },
      [bitmap],
    );

    // Release the PDF.js page object to free its internal memory immediately.
    page.cleanup();
  } catch (err) {
    self.postMessage({
      type: 'RENDER_ERROR',
      pageIndex,
      message: err.message ?? String(err),
    });
  }
}
