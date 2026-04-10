import * as pdfjsLib from 'pdfjs-dist';
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.mjs?url';

// FIX BUG #1 + #2: PDF.js v4 richiede workerSrc esplicito.
// disableWorker non esiste in v4. workerPort: self crashava PDF.js.
// Vite risolve questo URL al build time e include pdf.worker.mjs nel bundle.
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

let pdfDoc: Awaited<ReturnType<typeof pdfjsLib.getDocument>['promise']> | null = null;
type PageType = Awaited<ReturnType<NonNullable<typeof pdfDoc>['getPage']>>;
const pageCache = new Map<number, { page: PageType }>();
let maxPool = 3;

self.onmessage = async (e: MessageEvent) => {
  const { type, payload } = e.data;
  console.log(`[Worker] Received message type: ${type}`);

  if (type === 'LOAD') {
    console.log('[Worker] Starting LOAD process...');
    try {
      // Cleanup precedente se esiste
      if (pdfDoc) {
        for (const [, cached] of pageCache) {
          (cached.page as { cleanup?: () => void })?.cleanup?.();
        }
        pageCache.clear();
        pdfDoc.destroy();
        pdfDoc = null;
      }

      const data = new Uint8Array(payload.buffer);
      console.log(`[Worker] PDF data size: ${data.length} bytes`);
      
      // FIX BUG #2: rimosso workerPort: self che crashava PDF.js.
      // PDF.js spawna il suo worker usando workerSrc sopra.
      const loadingTask = pdfjsLib.getDocument({ data });
      console.log('[Worker] Loading PDF document...');
      pdfDoc = await loadingTask.promise;
      console.log(`[Worker] PDF loaded successfully! Pages: ${pdfDoc.numPages}`);

      // Estrazione outline
      console.log('[Worker] Extracting outline...');
      const outlineItems = await pdfDoc.getOutline();
      console.log(`[Worker] Outline items: ${outlineItems ? outlineItems.length : 0}`);
      
      const extractOutlineItems = async (items: any[]): Promise<any[]> => {
        return Promise.all(items.map(async item => ({
          title: item.title,
          page: item.dest
            ? (await pdfDoc!.getPageIndex(item.dest[0]).catch((err) => {
                console.warn('[Worker] getPageIndex error:', err);
                return 0;
              })) + 1
            : 0,
          items: await extractOutlineItems(item.items ?? [])
        })));
      };
      
      const outline = outlineItems ? await extractOutlineItems(outlineItems) : [];
      console.log(`[Worker] Outline extracted: ${outline.length} top-level items`);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const fp = (pdfDoc as any).fingerprints?.[0] ?? '';
      console.log('[Worker] Sending LOADED message back to main thread...');
      self.postMessage({
        type: 'LOADED',
        payload: {
          totalPages: pdfDoc.numPages,
          outline: outline,
          fingerprint: fp
        }
      });
      console.log('[Worker] LOADED message sent.');
    } catch (error) {
      console.error('[Worker] LOAD error:', error);
      self.postMessage({ type: 'ERROR', message: (error as Error).message });
    }
    return;
  }

  if (type === 'RENDER') {
    const { pageNumber, scale } = payload;

    if (!pdfDoc) {
      self.postMessage({ type: 'ERROR', message: 'PDF non caricato' });
      return;
    }

    try {
      const page = await pdfDoc.getPage(pageNumber);
      const viewport = page.getViewport({ scale });

      const canvas = new OffscreenCanvas(
        Math.ceil(viewport.width),
        Math.ceil(viewport.height)
      );
      const ctx = canvas.getContext('2d', { alpha: false, desynchronized: true });

      if (!ctx) {
        self.postMessage({ type: 'ERROR', message: 'Cannot get canvas context' });
        return;
      }

      const renderTask = page.render({
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        canvasContext: ctx as any,
        viewport
      });
      await renderTask.promise;

      page.cleanup();

      // Eviction LRU pool
      if (pageCache.size >= maxPool) {
        const firstKey = pageCache.keys().next().value;
        if (firstKey !== undefined) {
          const evicted = pageCache.get(firstKey);
          (evicted?.page as { cleanup?: () => void })?.cleanup?.();
          pageCache.delete(firstKey);
        }
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      pageCache.set(pageNumber, { page: page as any });

      const bitmap = await createImageBitmap(canvas);
      self.postMessage(
        {
          type: 'RENDERED',
          payload: {
            pageNumber,
            bitmap,
            width: Math.ceil(viewport.width),
            height: Math.ceil(viewport.height)
          }
        },
        [bitmap]
      );
    } catch (error) {
      self.postMessage({ type: 'ERROR', message: (error as Error).message });
    }
    return;
  }

  if (type === 'SET_MAX_POOL') {
    maxPool = payload.maxPool;
    return;
  }

  if (type === 'CLEANUP') {
    for (const [, cached] of pageCache) {
      (cached.page as { cleanup?: () => void })?.cleanup?.();
    }
    pageCache.clear();
    if (pdfDoc) {
      pdfDoc.destroy();
      pdfDoc = null;
    }
  }
};
