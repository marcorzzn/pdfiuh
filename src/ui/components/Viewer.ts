/**
 * pdfiuh Viewer — Core Viewport with Virtual Scrolling
 * Custom Element managing page rendering, text layer, SVG annotations.
 * 
 * Architecture per page:
 *   <div class="page-container" data-page="N">
 *     <canvas class="pdf-canvas" />
 *     <div class="text-layer" />
 *     <svg class="annotation-layer" />
 *     <div class="page-loading"><div class="mini-spinner" /></div>
 *   </div>
 */
import { store } from '../../state/store';
import { bus } from '../../core/event-bus';
import { SVGAnnotationLayer } from '../../annotations/svg-layer';
import viewerCSS from '../styles/viewer.css?raw';

const SVG_NS = 'http://www.w3.org/2000/svg';

interface PageState {
  container: HTMLDivElement;
  canvas: HTMLCanvasElement;
  textLayer: HTMLDivElement;
  svg: SVGSVGElement;
  annotLayer: SVGAnnotationLayer | null;
  loading: HTMLDivElement;
  rendered: boolean;
  renderScale: number;
  /** Maps character offsets to their span elements for find highlighting */
  textLayerCharMap: { offset: number; length: number; span: HTMLSpanElement }[];
  /** Full extracted text for this page */
  textLayerFullText: string;
}

class PDFiuhViewer extends HTMLElement {
  private root: ShadowRoot;
  private worker: Worker | null = null;
  private scrollContainer!: HTMLDivElement;
  private pagesContainer!: HTMLDivElement;

  private pages = new Map<number, PageState>();
  private pendingRenders = new Set<number>();
  private renderQueue = new Set<number>();
  private isRendering = false;
  private observer: IntersectionObserver | null = null;

  // Page dimensions (from first page viewport at scale 1.0)
  private baseWidth = 595;
  private baseHeight = 842;

  private findBarElement: HTMLElement | null = null;
  private highlightedSpans = new Set<HTMLSpanElement>();

  constructor() {
    super();
    this.root = this.attachShadow({ mode: 'open' });
  }

  connectedCallback(): void {
    this.build();
    this.bindStore();
    this.bindWorkerEvents();
  }

  private build(): void {
    const style = document.createElement('style');
    style.textContent = viewerCSS;
    this.root.appendChild(style);

    this.scrollContainer = document.createElement('div');
    this.scrollContainer.className = 'viewer-scroll';
    this.scrollContainer.tabIndex = 0;

    this.pagesContainer = document.createElement('div');
    this.pagesContainer.className = 'pages-container';

    this.scrollContainer.appendChild(this.pagesContainer);
    this.root.appendChild(this.scrollContainer);

    // Scroll tracking for current page
    this.scrollContainer.addEventListener('scroll', () => this.updateCurrentPage(), { passive: true });

    // Mouse wheel zoom with Ctrl
    this.scrollContainer.addEventListener('wheel', (e) => {
      if (e.ctrlKey) {
        e.preventDefault();
        const delta = e.deltaY > 0 ? -0.1 : 0.1;
        const newZoom = Math.max(0.25, Math.min(4.0, +(store.get('zoom') + delta).toFixed(2)));
        store.set('zoom', newZoom);
      }
    }, { passive: false });
  }

  setDocumentInfo(docId: string, totalPages: number, worker: Worker, pageWidth?: number, pageHeight?: number): void {
    this.worker = worker;
    store.update({ docId, totalPages });

    if (pageWidth && pageHeight) {
      this.baseWidth = pageWidth;
      this.baseHeight = pageHeight;
    }

    this.createPlaceholders();
  }

  private bindStore(): void {
    store.subscribe('zoom', () => this.onZoomChange());

    store.subscribe('activeTool', (tool) => {
      this.pages.forEach(page => {
        if (tool === 'select') {
          page.svg.classList.remove('tool-active', 'tool-eraser');
        } else if (tool === 'eraser') {
          page.svg.classList.add('tool-active', 'tool-eraser');
          page.svg.classList.remove('tool-eraser');
          page.svg.classList.add('tool-eraser');
        } else {
          page.svg.classList.add('tool-active');
          page.svg.classList.remove('tool-eraser');
        }
      });
    });

    store.subscribe('findBarOpen', (open) => {
      if (open) {
        this.showFindBar();
      } else {
        this.hideFindBar();
      }
    });

    bus.subscribe('go-to-page', (pageNum: number) => {
      this.scrollToPage(pageNum);
    });

    bus.subscribe('fit-width', () => {
      const containerWidth = this.scrollContainer.clientWidth - 48; // padding
      const newZoom = containerWidth / this.baseWidth;
      store.set('zoom', +Math.max(0.25, Math.min(4.0, newZoom)).toFixed(2));
    });

    bus.subscribe('fit-page', () => {
      const containerWidth = this.scrollContainer.clientWidth - 48;
      const containerHeight = this.scrollContainer.clientHeight - 48;
      const zoomW = containerWidth / this.baseWidth;
      const zoomH = containerHeight / this.baseHeight;
      const newZoom = Math.min(zoomW, zoomH);
      store.set('zoom', +Math.max(0.25, Math.min(4.0, newZoom)).toFixed(2));
    });

    bus.subscribe('print-doc', () => {
      window.print();
    });
  }

  private bindWorkerEvents(): void {
    // Worker message handling is set up in setDocumentInfo via worker.onmessage
  }

  private createPlaceholders(): void {
    this.destroyAll();

    const totalPages = store.get('totalPages');
    const zoom = store.get('zoom');

    for (let i = 1; i <= totalPages; i++) {
      const container = document.createElement('div');
      container.className = 'page-container';
      container.dataset.page = i.toString();

      const cssWidth = Math.round(this.baseWidth * zoom);
      const cssHeight = Math.round(this.baseHeight * zoom);
      container.style.width = `${cssWidth}px`;
      container.style.height = `${cssHeight}px`;

      // Canvas
      const canvas = document.createElement('canvas');
      canvas.className = 'pdf-canvas';
      canvas.style.width = '100%';
      canvas.style.height = '100%';

      // Text layer
      const textLayer = document.createElement('div');
      textLayer.className = 'text-layer';

      // SVG annotation layer
      const svg = document.createElementNS(SVG_NS, 'svg');
      svg.setAttribute('class', 'annotation-layer');

      const tool = store.get('activeTool');
      if (tool !== 'select') {
        svg.classList.add('tool-active');
        if (tool === 'eraser') svg.classList.add('tool-eraser');
      }

      // Loading indicator
      const loading = document.createElement('div');
      loading.className = 'page-loading';
      loading.innerHTML = '<div class="mini-spinner"></div>';

      container.appendChild(canvas);
      container.appendChild(textLayer);
      container.appendChild(svg);
      container.appendChild(loading);
      this.pagesContainer.appendChild(container);

      this.pages.set(i, {
        container,
        canvas,
        textLayer,
        svg,
        annotLayer: null,
        loading,
        rendered: false,
        renderScale: 0,
        textLayerCharMap: [],
        textLayerFullText: '',
      });
    }

    this.setupObserver();
  }

  private setupObserver(): void {
    this.observer?.disconnect();

    this.observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        const pageNum = parseInt((entry.target as HTMLElement).dataset.page || '0');
        if (pageNum <= 0) continue;
        if (entry.isIntersecting) {
          this.requestRender(pageNum);
        }
      }
      // Process render queue with batching
      this.processRenderQueue();
    }, {
      root: this.scrollContainer,
      rootMargin: '400px 0px', // Pre-render more pages for smoother experience
      threshold: 0,
    });

    this.pages.forEach((state) => {
      this.observer!.observe(state.container);
    });
  }

  private requestRender(pageNum: number): void {
    if (!this.worker || this.pendingRenders.has(pageNum)) return;

    const state = this.pages.get(pageNum);
    if (!state) return;

    const zoom = store.get('zoom');
    const dpr = window.devicePixelRatio || 1;
    const renderScale = zoom * dpr;

    // Skip if already rendered at this scale
    if (state.rendered && Math.abs(state.renderScale - renderScale) < 0.01) return;

    this.renderQueue.add(pageNum);
  }

  private processRenderQueue(): void {
    if (this.isRendering || this.renderQueue.size === 0) return;
    this.isRendering = true;

    // Batch: render up to 2 pages at a time (current + next)
    const toRender = Array.from(this.renderQueue).slice(0, 2);

    requestAnimationFrame(() => {
      for (const pageNum of toRender) {
        this.renderQueue.delete(pageNum);
        this.pendingRenders.add(pageNum);

        const state = this.pages.get(pageNum);
        if (!state) continue;

        const zoom = store.get('zoom');
        const dpr = window.devicePixelRatio || 1;
        const renderScale = zoom * dpr;

        this.worker!.postMessage({
          type: 'RENDER',
          payload: { pageNumber: pageNum, scale: renderScale },
        });
      }
      this.isRendering = false;

      // Continue processing if more pages are queued
      if (this.renderQueue.size > 0) {
        setTimeout(() => this.processRenderQueue(), 50);
      }
    });
  }

  handleWorkerMessage(data: { type: string; payload?: Record<string, unknown>; message?: string }): void {
    const { type, payload } = data;

    switch (type) {
      case 'RENDERED': {
        if (!payload) return;
        const pageNumber = payload.pageNumber as number;
        const bitmap = payload.bitmap as ImageBitmap;
        const width = payload.width as number;
        const height = payload.height as number;
        const textItems = payload.textItems as Array<{ str: string; transform: number[]; width: number; height: number; dir: string }>;
        const textStyles = payload.textStyles as Record<string, { fontFamily: string; ascent: number; descent: number }>;

        this.pendingRenders.delete(pageNumber);
        const state = this.pages.get(pageNumber);
        if (!state || !bitmap) return;

        const zoom = store.get('zoom');
        const dpr = window.devicePixelRatio || 1;

        // Draw bitmap to canvas
        state.canvas.width = width;
        state.canvas.height = height;
        const ctx = state.canvas.getContext('2d');
        if (ctx) ctx.drawImage(bitmap, 0, 0);
        bitmap.close();

        // Build text layer
        this.buildTextLayer(state.textLayer, textItems, textStyles, zoom, dpr);

        // Init annotation layer
        if (!state.annotLayer) {
          const docId = store.get('docId');
          state.annotLayer = new SVGAnnotationLayer(
            state.svg, pageNumber, docId,
            this.baseWidth * zoom, this.baseHeight * zoom
          );
          state.annotLayer.loadAnnotations();
        }

        // Hide loading
        state.loading.style.display = 'none';
        state.rendered = true;
        state.renderScale = zoom * dpr;
        break;
      }

      case 'THUMBNAIL_RENDERED': {
        // Forward to sidebar
        bus.publish('thumbnail-rendered', payload);
        break;
      }

      case 'ERROR': {
        const errorMsg = data.message || String((payload as Record<string, unknown>)?.message) || 'Unknown error';
        console.error('[Viewer] Worker error:', errorMsg);
        const pgNum = (payload as Record<string, unknown>)?.pageNumber as number | undefined;
        if (pgNum !== undefined) {
          this.pendingRenders.delete(pgNum);
        }

        // Show error on the affected page
        if (typeof pgNum === 'number') {
          const state = this.pages.get(pgNum);
          if (state) {
            state.loading.innerHTML = `<div style="color:#e06c75;font-size:11px;text-align:center;padding:8px;">⚠️ </div>`;
            state.loading.querySelector('div')!.textContent = `⚠️ ${errorMsg}`;
            state.loading.style.display = 'flex';
          }
        }
        break;
      }
    }
  }

  private buildTextLayer(
    container: HTMLDivElement,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    items: any[],
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    styles: any,
    zoom: number,
    dpr: number
  ): void {
    container.innerHTML = '';
    if (!items) return;

    const scale = zoom * dpr;
    const pageNum = parseInt((container.closest('.page-container') as HTMLElement | null)?.dataset.page || '0');
    const state = this.pages.get(pageNum);
    if (!state) return;

    // Reset text tracking
    state.textLayerCharMap = [];
    let charOffset = 0;
    let fullText = '';

    for (const item of items) {
      if (!item.str || item.str.trim() === '') continue;

      const span = document.createElement('span');
      span.textContent = item.str;

      // PDF.js text item transform: [scaleX, 0, 0, scaleY, x, y]
      const tx = item.transform;
      if (!tx || tx.length < 6) continue;

      const fontSize = Math.sqrt(tx[0] * tx[0] + tx[1] * tx[1]);
      const x = tx[4] / scale;
      const y = (this.baseHeight * zoom * dpr - tx[5]) / scale - fontSize / scale;

      span.style.left = `${x}px`;
      span.style.top = `${y}px`;
      span.style.fontSize = `${fontSize / scale}px`;

      // Use actual font family from PDF styles (if available)
      if (styles && item.fontName && styles[item.fontName]) {
        const fontData = styles[item.fontName];
        if (fontData?.fontFamily) {
          span.style.fontFamily = `'${fontData.fontFamily}', sans-serif`;
        }
      } else {
        span.style.fontFamily = 'sans-serif';
      }

      if (item.width) {
        const actualWidth = item.width * scale;
        span.style.width = `${actualWidth / scale}px`;
        span.style.letterSpacing = '0px';
      }

      container.appendChild(span);

      // Build character map for find highlighting
      const str = item.str;
      state.textLayerCharMap.push({
        offset: charOffset,
        length: str.length,
        span,
      });
      fullText += str;
      charOffset += str.length;
    }

    state.textLayerFullText = fullText;
  }

  private onZoomChange(): void {
    const zoom = store.get('zoom');

    // Update placeholder sizes (no DOM rebuild)
    this.pages.forEach((state, pageNum) => {
      const cssWidth = Math.round(this.baseWidth * zoom);
      const cssHeight = Math.round(this.baseHeight * zoom);
      state.container.style.width = `${cssWidth}px`;
      state.container.style.height = `${cssHeight}px`;

      // Mark as needing re-render
      state.rendered = false;
      state.loading.style.display = 'flex';
    });

    // Re-render visible pages
    this.setupObserver();
  }

  private updateCurrentPage(): void {
    const scrollTop = this.scrollContainer.scrollTop;
    const scrollCenter = scrollTop + this.scrollContainer.clientHeight / 3;

    let closestPage = 1;
    let closestDist = Infinity;

    this.pages.forEach((state, pageNum) => {
      const top = state.container.offsetTop;
      const center = top + state.container.offsetHeight / 2;
      const dist = Math.abs(center - scrollCenter);
      if (dist < closestDist) {
        closestDist = dist;
        closestPage = pageNum;
      }
    });

    const current = store.get('currentPage');
    if (closestPage !== current) {
      store.set('currentPage', closestPage);
    }
  }

  scrollToPage(pageNum: number): void {
    const state = this.pages.get(pageNum);
    if (!state) return;
    // Smooth scroll to page with edge-like easing
    state.container.scrollIntoView({ behavior: 'smooth', block: 'start' });
    store.set('currentPage', pageNum);
  }

  private showFindBar(): void {
    if (this.findBarElement) return;
    // Import and create find bar dynamically
    import('./find-bar').then(() => {
      const fb = document.createElement('pdfiuh-findbar') as HTMLElement;
      this.scrollContainer.appendChild(fb);
      this.findBarElement = fb;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (fb as any).setViewer?.(this);
    });
  }

  private hideFindBar(): void {
    if (this.findBarElement) {
      this.findBarElement.remove();
      this.findBarElement = null;
    }
  }

  /** Used by find bar to highlight a match by character offset and length */
  highlightTextMatch(pageNum: number, charOffset: number, matchLength: number, isCurrent: boolean): void {
    const state = this.pages.get(pageNum);
    if (!state || state.textLayerCharMap.length === 0) return;

    // Note: clearFindHighlights() is normally called before this to clear previous search state across all pages.
    // However, if we need to clear specifically on this page only, we can iterate over our stored set
    // and remove only spans belonging to this page.
    for (const span of this.highlightedSpans) {
      if (state.textLayer.contains(span)) {
        span.classList.remove('find-match', 'find-match-current');
        this.highlightedSpans.delete(span);
      }
    }

    const matchEnd = charOffset + matchLength;
    const currentHighlightedSpans = new Set<HTMLSpanElement>();

    // Find all spans that overlap with the match range
    for (const entry of state.textLayerCharMap) {
      const spanEnd = entry.offset + entry.length;
      // Check if this span overlaps with the match range
      if (entry.offset < matchEnd && spanEnd > charOffset) {
        currentHighlightedSpans.add(entry.span);
        this.highlightedSpans.add(entry.span);
      }
    }

    // Apply highlight classes
    for (const span of currentHighlightedSpans) {
      span.classList.add(isCurrent ? 'find-match-current' : 'find-match');
    }

    // Scroll first highlighted span into view
    if (isCurrent && currentHighlightedSpans.size > 0) {
      const firstSpan = currentHighlightedSpans.values().next().value;
      if (firstSpan) {
        firstSpan.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  }

  /** Clear all find highlights */
  clearFindHighlights(): void {
    this.highlightedSpans.forEach(span => {
      span.classList.remove('find-match', 'find-match-current');
    });
    this.highlightedSpans.clear();
  }

  getWorker(): Worker | null {
    return this.worker;
  }

  private destroyAll(): void {
    this.observer?.disconnect();
    this.pages.forEach(state => {
      state.annotLayer?.destroy();
    });
    this.pages.clear();
    this.pendingRenders.clear();
    this.pagesContainer.innerHTML = '';
    this.highlightedSpans.clear();
  }

  disconnectedCallback(): void {
    this.destroyAll();
  }
}

customElements.define('pdfiuh-viewer', PDFiuhViewer);
export default PDFiuhViewer;
