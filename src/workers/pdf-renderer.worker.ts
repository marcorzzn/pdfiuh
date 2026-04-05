import * as pdfjsLib from 'pdfjs-dist';

// pdfjs-dist runs inside this Vite-bundled worker context.
// We cast getDocument options to bypass the workerPort type limitation.

let pdfDoc: Awaited<ReturnType<typeof pdfjsLib.getDocument>['promise']> | null = null;
const pageCache = new Map<number, { page: unknown }>();
let maxPool = 3;

self.onmessage = async (e: MessageEvent) => {
  const { type, payload } = e.data;

  if (type === 'LOAD') {
    try {
      const data = new Uint8Array(payload.buffer);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const docInit: any = { data, workerPort: self as unknown as Worker };
      const loadingTask = pdfjsLib.getDocument(docInit);
      pdfDoc = await loadingTask.promise;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const fp = (pdfDoc as any).fingerprints?.[0] ?? '';
      self.postMessage({ type: 'LOADED', numPages: pdfDoc.numPages, fingerprint: fp });
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
      const page = await pdfDoc.getPage(pageNumber);
      const viewport = page.getViewport({ scale });

      const canvas = new OffscreenCanvas(viewport.width, viewport.height);
      const ctx = canvas.getContext('2d', { alpha: false, desynchronized: true });

      if (!ctx) {
        self.postMessage({ type: 'ERROR', message: 'Cannot get canvas context' });
        return;
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const renderTask = page.render({ canvasContext: ctx as any, viewport });
      await renderTask.promise;

      page.cleanup();

      // Eviction
      if (pageCache.size >= maxPool) {
        const firstKey = pageCache.keys().next().value;
        if (firstKey !== undefined) pageCache.delete(firstKey);
      }
      pageCache.set(pageNumber, { page });

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
      (cached.page as { cleanup: () => void })?.cleanup();
    }
    pageCache.clear();
    pdfDoc = null;
  }
};
