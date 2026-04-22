/**
 * pdfiuh Find Bar — Edge-style Ctrl+F search
 * Indexes text from the PDF worker, highlights matches in the text layer.
 */
import { store } from '../../state/store';

interface SearchMatch {
  page: number;
  text: string;
  charOffset: number;  // Character offset within the page text
  length: number;
}

class PDFiuhFindBar extends HTMLElement {
  private root: ShadowRoot;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private viewer: any = null;
  private pageTexts = new Map<number, { original: string; lower: string }>();
  private searchMatches: SearchMatch[] = [];
  private currentMatch = -1;
  private lastQuery = '';
  private indexing = false;
  private input: HTMLInputElement | null = null;
  private countEl: HTMLElement | null = null;
  private workerHandler: ((e: MessageEvent) => void) | null = null;
  private workerRef: Worker | null = null;

  constructor() {
    super();
    this.root = this.attachShadow({ mode: 'open' });
  }

  connectedCallback(): void {
    this.build();
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  setViewer(viewer: any): void {
    this.viewer = viewer;
    this.startIndexing();
  }

  private build(): void {
    this.root.innerHTML = `
      <style>
        :host {
          position: absolute;
          top: 0;
          right: 16px;
          z-index: 200;
        }
        .find-bar {
          display: flex;
          align-items: center;
          gap: 4px;
          padding: 6px 10px;
          background: var(--fluent-surface, #fff);
          border: 1px solid var(--fluent-border, #e0e0e0);
          border-top: none;
          border-radius: 0 0 6px 6px;
          box-shadow: var(--fluent-shadow-md, 0 4px 8px rgba(0,0,0,0.12));
          animation: slideDown 0.15s ease-out;
        }
        @keyframes slideDown {
          from { opacity: 0; transform: translateY(-100%); }
          to { opacity: 1; transform: translateY(0); }
        }
        .find-input {
          width: 220px;
          height: 28px;
          border: 1px solid var(--fluent-border, #ddd);
          border-radius: 4px;
          background: var(--fluent-surface-alt, #fafafa);
          color: var(--fluent-text-primary, #1a1a1a);
          font-family: var(--fluent-font, system-ui);
          font-size: 13px;
          padding: 0 8px;
          outline: none;
        }
        .find-input:focus {
          border-color: var(--fluent-accent, #0067c0);
          box-shadow: 0 0 0 1px var(--fluent-accent, #0067c0);
        }
        .find-count {
          font-size: 11px;
          color: var(--fluent-text-secondary, #616161);
          min-width: 56px;
          text-align: center;
          font-variant-numeric: tabular-nums;
          white-space: nowrap;
        }
        .fb-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 26px;
          height: 26px;
          border: none;
          border-radius: 4px;
          background: transparent;
          color: var(--fluent-text-primary, #1a1a1a);
          cursor: pointer;
          padding: 0;
        }
        .fb-btn:hover { background: var(--fluent-hover, rgba(0,0,0,0.04)); }
        .fb-btn svg { width: 14px; height: 14px; }
      </style>
      <div class="find-bar">
        <input class="find-input" id="find-input" type="text" placeholder="Cerca nel documento..." autocomplete="off">
        <span class="find-count" id="find-count"></span>
        <button class="fb-btn" id="find-prev" title="Risultato precedente (Shift+Enter)">
          <svg viewBox="0 0 16 16" fill="currentColor"><path d="M8 4l-5 5h10z"/></svg>
        </button>
        <button class="fb-btn" id="find-next" title="Risultato successivo (Enter)">
          <svg viewBox="0 0 16 16" fill="currentColor"><path d="M8 12l5-5H3z"/></svg>
        </button>
        <button class="fb-btn" id="find-close" title="Chiudi (Esc)">
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M4 4l8 8M12 4l-8 8"/></svg>
        </button>
      </div>
    `;

    this.input = this.root.getElementById('find-input') as HTMLInputElement;
    this.countEl = this.root.getElementById('find-count');

    this.input.focus();

    this.input.addEventListener('input', () => this.onSearch());

    this.input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && e.shiftKey) {
        e.preventDefault();
        this.prev();
      } else if (e.key === 'Enter') {
        e.preventDefault();
        this.next();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        this.close();
      }
    });

    this.root.getElementById('find-prev')?.addEventListener('click', () => this.prev());
    this.root.getElementById('find-next')?.addEventListener('click', () => this.next());
    this.root.getElementById('find-close')?.addEventListener('click', () => this.close());
  }

  private async startIndexing(): Promise<void> {
    if (this.indexing) return;
    this.indexing = true;

    const worker = this.viewer?.getWorker?.();
    if (!worker) return;
    this.workerRef = worker;

    const totalPages = store.get('totalPages');
    const handler = (e: MessageEvent) => {
      if (e.data.type === 'TEXT_EXTRACTED') {
        const { pageNumber, text } = e.data.payload;
        this.pageTexts.set(pageNumber, { original: text, lower: text.toLowerCase() });
        // Re-run search if we have a query
        if (this.lastQuery) this.performSearch(this.lastQuery);
      } else if (e.data.type === 'TEXT_EXTRACTED_BATCH') {
        const { results } = e.data.payload;
        for (const res of results) {
          this.pageTexts.set(res.pageNumber, { original: res.text, lower: res.text.toLowerCase() });
        }
        // Re-run search once per batch
        if (this.lastQuery) this.performSearch(this.lastQuery);
      }
    };

    this.workerHandler = handler;
    worker.addEventListener('message', handler);

    // Request text for all missing pages using a single batched message
    const missingPages: number[] = [];
    for (let i = 1; i <= totalPages; i++) {
      if (!this.pageTexts.has(i)) {
        missingPages.push(i);
      }
    }

    if (missingPages.length > 0) {
      worker.postMessage({ type: 'GET_TEXT_BATCH', payload: { pageNumbers: missingPages } });
    }
  }

  private onSearch(): void {
    const query = this.input?.value?.trim() || '';
    this.lastQuery = query;
    this.viewer?.clearFindHighlights?.();

    if (!query) {
      this.searchMatches = [];
      this.currentMatch = -1;
      this.updateCountDisplay();
      return;
    }

    this.performSearch(query);
  }

  private performSearch(query: string): void {
    const lower = query.toLowerCase();
    this.searchMatches = [];

    for (const [page, textObj] of this.pageTexts) {
      let idx = 0;
      const textLower = textObj.lower;
      const textOriginal = textObj.original;
      while ((idx = textLower.indexOf(lower, idx)) !== -1) {
        this.searchMatches.push({
          page,
          text: textOriginal.substring(idx, idx + query.length),
          charOffset: idx,
          length: query.length,
        });
        idx += query.length;
      }
    }

    // Sort by page, then by offset
    this.searchMatches.sort((a, b) => a.page - b.page || a.charOffset - b.charOffset);

    if (this.searchMatches.length > 0) {
      this.currentMatch = 0;
      this.highlightCurrent();
    } else {
      this.currentMatch = -1;
    }

    this.updateCountDisplay();
  }

  private next(): void {
    if (this.searchMatches.length === 0) return;
    this.currentMatch = (this.currentMatch + 1) % this.searchMatches.length;
    this.highlightCurrent();
    this.updateCountDisplay();
  }

  private prev(): void {
    if (this.searchMatches.length === 0) return;
    this.currentMatch = (this.currentMatch - 1 + this.searchMatches.length) % this.searchMatches.length;
    this.highlightCurrent();
    this.updateCountDisplay();
  }

  private highlightCurrent(): void {
    if (!this.viewer || this.currentMatch < 0) return;
    this.viewer.clearFindHighlights?.();

    const match = this.searchMatches[this.currentMatch];
    if (match) {
      this.viewer.scrollToPage?.(match.page);
      // Highlight the exact spans that contain the match
      this.viewer.highlightTextMatch?.(match.page, match.charOffset, match.length, true);
    }
  }

  private updateCountDisplay(): void {
    if (!this.countEl) return;
    if (this.searchMatches.length === 0 && this.lastQuery) {
      this.countEl.textContent = 'Nessun risultato';
    } else if (this.searchMatches.length > 0) {
      this.countEl.textContent = `${this.currentMatch + 1} di ${this.searchMatches.length}`;
    } else {
      this.countEl.textContent = '';
    }
  }

  private close(): void {
    this.viewer?.clearFindHighlights?.();
    store.set('findBarOpen', false);
  }

  disconnectedCallback(): void {
    if (this.workerRef && this.workerHandler) {
      this.workerRef.removeEventListener('message', this.workerHandler);
      this.workerRef = null;
      this.workerHandler = null;
    }
  }
}

customElements.define('pdfiuh-findbar', PDFiuhFindBar);
export default PDFiuhFindBar;
