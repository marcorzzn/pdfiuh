// src/workers/search.worker.ts
// Full-text indexing/search worker — placeholder for Phase 5 (Lunr.js)
// v1: delegates search to the main thread; worker structure reserved.

const pageTexts = new Map<number, string>();

self.onmessage = async (e: MessageEvent) => {
  const { type, payload } = e.data;

  if (type === 'INDEX_PAGE') {
    const { pageNumber, text } = payload;
    pageTexts.set(pageNumber, text);
  }

  if (type === 'BUILD_INDEX') {
    // Placeholder: Lunr.js index built here in Phase 5
    self.postMessage({ type: 'INDEX_BUILT', totalPages: pageTexts.size });
  }

  if (type === 'SEARCH') {
    const { query } = payload;
    const results: { pageNumber: number; snippet: string }[] = [];
    const lower = query.toLowerCase();

    for (const [page, text] of pageTexts) {
      const idx = text.toLowerCase().indexOf(lower);
      if (idx !== -1) {
        const start = Math.max(0, idx - 30);
        const end = Math.min(text.length, idx + query.length + 30);
        results.push({
          pageNumber: page,
          snippet: `${start > 0 ? '…' : ''}${text.slice(start, end)}${end < text.length ? '…' : ''}`
        });
      }
    }
    self.postMessage({ type: 'RESULTS', results });
  }

  if (type === 'CLEAR') {
    pageTexts.clear();
  }
};
