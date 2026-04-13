/**
 * pdfiuh PDF Worker
 * Handles PDF loading, page rendering, text extraction and outline in a Web Worker.
 * Uses OffscreenCanvas for zero-copy bitmap transfer via ImageBitmap.
 */
import * as pdfjsLib from 'pdfjs-dist';

// --- FAKE WORKER POLYFILL (per vite dev-mode locale) ---
// Quando PDF.js fallisce nel caricare il proprio sub-worker per regole ES-Modules locali,
// ripiega sul "fake worker". Eseguendolo nel nostro worker (già separato), blocchiamo
// il difetto in cui PDF.js cerca inavvertitamente 'document.createElement' (inesistente).
if (typeof (globalThis as any).document === 'undefined') {
  (globalThis as any).window = globalThis;
  const mockNode = {
    setAttribute: () => {},
    appendChild: () => {},
    removeChild: () => {},
    remove: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    style: {}
  };
  (globalThis as any).document = {
    createElement: (tag: string) => {
      if (tag.toLowerCase() === 'canvas') return new OffscreenCanvas(1, 1);
      return { ...mockNode };
    },
    getElementsByTagName: () => [mockNode],
    documentElement: mockNode,
    head: mockNode,
    body: mockNode
  };
}
// --------------------------------------------------------

// Configure PDF.js worker source for Vite
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.mjs?url';
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

type PDFDoc = Awaited<ReturnType<typeof pdfjsLib.getDocument>['promise']>;
type PDFPage = Awaited<ReturnType<PDFDoc['getPage']>>;

let pdfDoc: PDFDoc | null = null;
let pdfBuffer: ArrayBuffer | null = null;
const pageCache = new Map<number, PDFPage>();
let maxPool = 7;

// CMap URL for rendering non-Latin characters properly
const CMAP_URL = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/cmaps/';

/* ---------- helpers ---------- */

function evictOldest(): void {
  if (pageCache.size < maxPool) return;
  const oldest = pageCache.keys().next().value;
  if (oldest !== undefined) {
    pageCache.get(oldest)?.cleanup();
    pageCache.delete(oldest);
  }
}

async function getPage(num: number): Promise<PDFPage> {
  if (!pdfDoc) throw new Error('PDF not loaded');
  const cached = pageCache.get(num);
  if (cached) return cached;
  const page = await pdfDoc.getPage(num);
  evictOldest();
  pageCache.set(num, page);
  return page;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function extractOutline(items: any[] | null): Promise<any[]> {
  if (!items || !pdfDoc) return [];
  const result = [];
  for (const item of items) {
    let pageNum = 0;
    try {
      if (item.dest) {
        const dest = typeof item.dest === 'string'
          ? await pdfDoc.getDestination(item.dest)
          : item.dest;
        if (dest && dest[0]) {
          const idx = await pdfDoc.getPageIndex(dest[0]);
          pageNum = idx + 1;
        }
      }
    } catch { /* skip unresolvable dest */ }
    result.push({
      title: item.title || '',
      page: pageNum,
      items: await extractOutline(item.items || []),
    });
  }
  return result;
}

/* ---------- message handler ---------- */

self.onmessage = async (e: MessageEvent) => {
  const { type, payload } = e.data;

  try {
    switch (type) {

      /* ---- LOAD ---- */
      case 'LOAD': {
        // Cleanup previous
        if (pdfDoc) {
          for (const [, p] of pageCache) p.cleanup();
          pageCache.clear();
          pdfDoc.destroy();
          pdfDoc = null;
        }

        pdfBuffer = payload.buffer.slice(0); // keep a copy for export
        const data = new Uint8Array(payload.buffer);
        const loadingTask = pdfjsLib.getDocument({
          data,
          cMapUrl: CMAP_URL,
          cMapPacked: true,
          // Enable font rendering for non-embedded fonts
          standardFontDataUrl: 'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/standard_fonts/',
        });
        pdfDoc = await loadingTask.promise;

        const outlineItems = await pdfDoc.getOutline();
        const outline = await extractOutline(outlineItems);

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const fp = (pdfDoc as any).fingerprints?.[0] ?? '';

        // Get first page dimensions for placeholder sizing
        const firstPage = await pdfDoc.getPage(1);
        const vp = firstPage.getViewport({ scale: 1.0 });

        self.postMessage({
          type: 'LOADED',
          payload: {
            totalPages: pdfDoc.numPages,
            outline,
            fingerprint: fp,
            pageWidth: vp.width,
            pageHeight: vp.height,
          },
        });
        break;
      }

      /* ---- GET_PAGE_COUNT (fast, before full load) ---- */
      case 'GET_PAGE_COUNT': {
        if (!pdfDoc) {
          self.postMessage({ type: 'ERROR', message: 'PDF not loaded' });
          return;
        }
        self.postMessage({
          type: 'PAGE_COUNT',
          payload: { totalPages: pdfDoc.numPages },
        });
        break;
      }

      /* ---- RENDER (page + text content) ---- */
      case 'RENDER': {
        const { pageNumber, scale } = payload;
        if (!pdfDoc) {
          self.postMessage({ type: 'ERROR', message: 'PDF not loaded' });
          return;
        }
        if (pageNumber < 1 || pageNumber > pdfDoc.numPages) {
          self.postMessage({ type: 'ERROR', message: `Page ${pageNumber} out of range (1-${pdfDoc.numPages})` });
          return;
        }

        const page = await getPage(pageNumber);
        const viewport = page.getViewport({ scale });
        const w = Math.ceil(viewport.width);
        const h = Math.ceil(viewport.height);

        const canvas = new OffscreenCanvas(w, h);
        const ctx = canvas.getContext('2d', { alpha: false, desynchronized: true });
        if (!ctx) {
          self.postMessage({ type: 'ERROR', message: 'Cannot get 2d context' });
          return;
        }

        await page.render({
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          canvasContext: ctx as any,
          viewport,
        }).promise;

        // Extract text content for the text layer
        const textContent = await page.getTextContent();

        const bitmap = await createImageBitmap(canvas);
        self.postMessage({
          type: 'RENDERED',
          payload: {
            pageNumber,
            bitmap,
            width: w,
            height: h,
            textItems: textContent.items,
            textStyles: textContent.styles,
          },
        }, [bitmap]);
        break;
      }

      /* ---- RENDER_THUMBNAIL ---- */
      case 'RENDER_THUMBNAIL': {
        const { pageNumber } = payload;
        if (!pdfDoc) return;

        const page = await getPage(pageNumber);
        const thumbScale = 0.2;
        const viewport = page.getViewport({ scale: thumbScale });
        const w = Math.ceil(viewport.width);
        const h = Math.ceil(viewport.height);

        const canvas = new OffscreenCanvas(w, h);
        const ctx = canvas.getContext('2d', { alpha: false });
        if (!ctx) return;

        await page.render({
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          canvasContext: ctx as any,
          viewport,
        }).promise;

        const bitmap = await createImageBitmap(canvas);
        self.postMessage({
          type: 'THUMBNAIL_RENDERED',
          payload: { pageNumber, bitmap, width: w, height: h },
        }, [bitmap]);
        break;
      }

      /* ---- GET_TEXT (for search indexing) ---- */
      case 'GET_TEXT': {
        const { pageNumber } = payload;
        if (!pdfDoc) return;
        const page = await getPage(pageNumber);
        const tc = await page.getTextContent();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const text = tc.items.map((it: any) => it.str ?? '').join(' ');
        self.postMessage({
          type: 'TEXT_EXTRACTED',
          payload: { pageNumber, text },
        });
        break;
      }

      /* ---- GET_PDF_BUFFER (for export) ---- */
      case 'GET_PDF_BUFFER': {
        if (pdfBuffer) {
          const copy = pdfBuffer.slice(0);
          self.postMessage({ type: 'PDF_BUFFER', payload: { buffer: copy } }, [copy]);
        }
        break;
      }

      /* ---- SET_MAX_POOL ---- */
      case 'SET_MAX_POOL': {
        maxPool = payload.maxPool;
        break;
      }

      /* ---- CLEANUP ---- */
      case 'CLEANUP': {
        for (const [, p] of pageCache) p.cleanup();
        pageCache.clear();
        if (pdfDoc) { pdfDoc.destroy(); pdfDoc = null; }
        pdfBuffer = null;
        break;
      }

      default:
        console.warn(`[pdf-worker] Unknown message type: ${type}`);
    }
  } catch (err) {
    const errorMsg = (err as Error).message || String(err);
    console.error(`[pdf-worker] Error handling ${type}:`, errorMsg);
    self.postMessage({ type: 'ERROR', message: `[${type}] ${errorMsg}` });
  }
};
