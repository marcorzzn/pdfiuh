import { getDocument } from 'pdfjs-dist';

// pdfjs-dist runs inside this Vite-bundled worker.
// `workerPort: self` tells it to use the current worker context instead of spawning a nested worker.

let pdfDoc: ReturnType<typeof getDocument>['promise'] | null = null;
const pageCache = new Map<number, { page: any; viewport: any }>();
let maxPool = 3;

self.onmessage = async (e: MessageEvent) => {
  const { type, payload } = e.data;

  if (type === 'LOAD') {
    try {
      const data = new Uint8Array(payload.buffer);
      pdfDoc = getDocument({ data, workerPort: self as unknown as Worker });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const doc = await pdfDoc.promise;
      self.postMessage({ type: 'LOADED', numPages: doc.numPages, fingerprint: doc.fingerprint });
    } catch (error) {
      self.postMessage({ type: 'ERROR', message: (error as Error).message });
    }
    return;
  }

  if (type === 'RENDER') {
    const { pageNumber, scale } = payload;

    if (!pdfDoc) {
      self.postMessage({ type: 'ERROR', message: 'PDF not loaded' });
      return;
    }

    try {
      const doc = await pdfDoc as any;
      const page = await doc.getPage(pageNumber);
      const viewport = page.getViewport({ scale });

      const canvas = new OffscreenCanvas(viewport.width, viewport.height);
      const ctx = canvas.getContext('2d', { alpha: false, desynchronized: true });

      if (!ctx) {
        self.postMessage({ type: 'ERROR', message: 'Cannot get canvas context' });
        return;
      }

      const renderTask = page.render({ canvasContext: ctx, viewport });
      await renderTask.promise;

      page.cleanup();

      // Eviction
      if (pageCache.size >= maxPool) {
        const firstKey = pageCache.keys().next().value;
        if (firstKey !== undefined) pageCache.delete(firstKey);
      }
      pageCache.set(pageNumber, { page, viewport });

      const bitmap = await createImageBitmap(canvas);
      self.postMessage(
        { type: 'RENDERED', pageNumber, bitmap, width: viewport.width, height: viewport.height },
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
      cached.page?.cleanup();
    }
    pageCache.clear();
    pdfDoc = null;
  }
};
