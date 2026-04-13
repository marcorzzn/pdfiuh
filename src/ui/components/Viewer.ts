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
<<<<<<< HEAD
import { storage, type Annotation } from '../../annotations/storage';
import { AnnotationEngine } from '../../annotations/engine';
import { fabric } from 'fabric';
=======
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
}
>>>>>>> 692cdb1 (Refactor: Rifondazione architettura Fluent UI, worker estrazione testo e virtual scrolling)

class PDFiuhViewer extends HTMLElement {
  private root: ShadowRoot;
  private worker: Worker | null = null;
<<<<<<< HEAD
  private docId: string = '';
  private totalPages: number = 0;
  private zoom: number = 1.0;
  private activeTool: string = 'select';
  private selectedColor: string = '#ffff00';
  private brushSize: number = 3;

  private BASE_WIDTH = 800; // Will be updated per page
  private BASE_HEIGHT = 1130;

  private _container: HTMLElement | null = null;
  private currentPages = new Map<number, { canvas: HTMLCanvasElement, fabricCanvas: fabric.Canvas, container: HTMLElement }>();
  private pendingRenders = new Set<number>();
  private currentPageNum = 1;
=======
  private scroll!: HTMLDivElement;
  private pagesContainer!: HTMLDivElement;

  private pages = new Map<number, PageState>();
  private pendingRenders = new Set<number>();
  private observer: IntersectionObserver | null = null;

  // Page dimensions (from first page viewport at scale 1.0)
  private baseWidth = 595;
  private baseHeight = 842;

  private findBarElement: HTMLElement | null = null;
>>>>>>> 692cdb1 (Refactor: Rifondazione architettura Fluent UI, worker estrazione testo e virtual scrolling)

  constructor() {
    super();
    this.root = this.attachShadow({ mode: 'open' });
  }

<<<<<<< HEAD
  connectedCallback() {
    this.render();
    this._container = this.shadowRoot!.querySelector('.viewer-container') as HTMLElement;

    bus.subscribe('zoom-change', (val: number) => {
      this.zoom = val;
      this.updateLayout();
    });

    bus.subscribe('tool-change', (tool: string) => {
      this.activeTool = tool;
      this.updateFabricTools();
    });

    bus.subscribe('color-change', (color: string) => {
        this.selectedColor = color;
        this.updateFabricTools();
    });

    bus.subscribe('brush-size-change', (size: number) => {
        this.brushSize = size;
        this.updateFabricTools();
    });

    bus.subscribe('goto-page', (pageNum: number) => {
        this.scrollToPage(pageNum);
    });

    bus.subscribe('navigate-page', (delta: number) => {
        const newPage = this.currentPageNum + delta;
        if (newPage >= 1 && newPage <= this.totalPages) {
            this.scrollToPage(newPage);
        }
    });

    bus.subscribe('clear-annotations', async () => {
        const annots = await storage.loadAnnotations(this.docId);
        for (const a of annots) {
            await storage.deleteAnnotation(this.docId, a.id);
        }
        this.currentPages.forEach((page, pageNum) => {
            page.fabricCanvas.clear();
            page.container.querySelectorAll('.sticky-note').forEach(n => n.remove());
        });
    });

    bus.subscribe('save-pdf', () => {
        this.saveAnnotationsToStorage();
        alert('Annotazioni salvate localmente!');
    });

    bus.subscribe('page-rendered', (payload: any) => {
        this.pendingRenders.delete(payload.pageNumber);
        const page = this.currentPages.get(payload.pageNumber);
        if (page) {
            const ctx = page.canvas.getContext('2d');
            if (ctx) {
                page.canvas.width = payload.width;
                page.canvas.height = payload.height;
                const displayWidth = payload.width * this.zoom;
                const displayHeight = payload.height * this.zoom;

                page.canvas.style.width = `${displayWidth}px`;
                page.canvas.style.height = `${displayHeight}px`;
                page.container.style.width = `${displayWidth}px`;
                page.container.style.height = `${displayHeight}px`;

                ctx.drawImage(payload.bitmap, 0, 0);

                page.fabricCanvas.setWidth(displayWidth);
                page.fabricCanvas.setHeight(displayHeight);
                page.fabricCanvas.setZoom(this.zoom);

                this.loadAnnotations(payload.pageNumber, page.fabricCanvas);
            }
        }
    });

    this._container.addEventListener('scroll', () => {
        let current = this.currentPageNum;
        this.currentPages.forEach((page, num) => {
            const rect = page.container.getBoundingClientRect();
            if (rect.top >= 0 && rect.top < window.innerHeight / 2) {
                current = num;
            }
        });
        if (current !== this.currentPageNum) {
            this.currentPageNum = current;
            bus.publish('page-changed', current);
        }
    });
  }

  public setDocumentInfo(docId: string, totalPages: number, worker: Worker | null) {
    this.docId = docId;
    this.totalPages = totalPages;
    this.worker = worker;
    this.currentPageNum = 1;



    this.updateLayout();
=======
  connectedCallback(): void {
    this.build();
    this.bindStore();
    this.bindWorkerEvents();
  }

  private build(): void {
    const style = document.createElement('style');
    style.textContent = viewerCSS;
    this.root.appendChild(style);

    this.scroll = document.createElement('div');
    this.scroll.className = 'viewer-scroll';
    this.scroll.tabIndex = 0;

    this.pagesContainer = document.createElement('div');
    this.pagesContainer.className = 'pages-container';

    this.scroll.appendChild(this.pagesContainer);
    this.root.appendChild(this.scroll);

    // Scroll tracking for current page
    this.scroll.addEventListener('scroll', () => this.updateCurrentPage(), { passive: true });

    // Mouse wheel zoom with Ctrl
    this.scroll.addEventListener('wheel', (e) => {
      if (e.ctrlKey) {
        e.preventDefault();
        const delta = e.deltaY > 0 ? -0.1 : 0.1;
        const newZoom = Math.max(0.25, Math.min(4.0, +(store.get('zoom') + delta).toFixed(2)));
        store.set('zoom', newZoom);
      }
    }, { passive: false });
>>>>>>> 692cdb1 (Refactor: Rifondazione architettura Fluent UI, worker estrazione testo e virtual scrolling)
  }

  setDocumentInfo(docId: string, totalPages: number, worker: Worker, pageWidth?: number, pageHeight?: number): void {
    this.worker = worker;
    store.update({ docId, totalPages });

<<<<<<< HEAD
    for (let i = 1; i <= this.totalPages; i++) {
      const wrapper = document.createElement('div');
      wrapper.className = 'page-wrapper';
      wrapper.dataset.page = i.toString();

      const width = this.BASE_WIDTH * this.zoom;
      const height = this.BASE_HEIGHT * this.zoom;
      wrapper.style.width = `${width}px`;
      wrapper.style.height = `${height}px`;

      const canvas = document.createElement('canvas');
      canvas.width = this.BASE_WIDTH;
      canvas.height = this.BASE_HEIGHT;
      canvas.className = 'pdf-canvas';
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;

      const annotCanvas = document.createElement('canvas');
      annotCanvas.id = `annot-canvas-${i}`;
      annotCanvas.className = 'annot-canvas';

      wrapper.appendChild(canvas);
      wrapper.appendChild(annotCanvas);
      this._container.appendChild(wrapper);

      const fabricCanvas = new fabric.Canvas(annotCanvas, {
          isDrawingMode: false,
          selection: false,
          width: width,
          height: height
      });

      this.currentPages.set(i, { canvas, fabricCanvas, container: wrapper });
      this.setupFabricEvents(i, fabricCanvas);
    }

    this.updateFabricTools();
    this.setupIntersectionObserver();
  }

  private updateFabricTools() {
      this.currentPages.forEach(page => {
          const fCanvas = page.fabricCanvas;
          fCanvas.isDrawingMode = (this.activeTool === 'draw');
          fCanvas.selection = (this.activeTool === 'select');

          if (this.activeTool === 'draw') {
              fCanvas.freeDrawingBrush = new fabric.PencilBrush(fCanvas);
              fCanvas.freeDrawingBrush.color = this.selectedColor;
              fCanvas.freeDrawingBrush.width = this.brushSize;
          }

          if (this.activeTool === 'eraser') {
              fCanvas.isDrawingMode = false;
              fCanvas.selection = true;
          }
      });
  }

  private setupFabricEvents(pageNum: number, fCanvas: fabric.Canvas) {
      fCanvas.on('path:created', async (e: any) => {
          if (this.activeTool === 'draw') {
              // Convert path to custom annotation
              const path = e.path;
              // we keep it on canvas for rendering, and save it
              this.saveAnnotationsToStorage();
          }
      });

      fCanvas.on('mouse:down', (o: any) => {
          if (this.activeTool === 'text') {
              const pointer = fCanvas.getPointer(o.e);
              const text = new fabric.IText('Testo', {
                  left: pointer.x,
                  top: pointer.y,
                  fontFamily: 'Arial',
                  fill: this.selectedColor,
                  fontSize: 20,
                  selectable: true
              });
              fCanvas.add(text);
              fCanvas.setActiveObject(text);
              this.saveAnnotationsToStorage();
          } else if (this.activeTool === 'highlight') {
               const pointer = fCanvas.getPointer(o.e);
               // Simple highlight implementation (could be improved to drag-to-highlight)
               const rect = new fabric.Rect({
                    left: pointer.x,
                    top: pointer.y,
                    width: 100,
                    height: 20,
                    fill: this.selectedColor,
                    opacity: 0.3,
                    selectable: true
               });
               fCanvas.add(rect);
               this.saveAnnotationsToStorage();
          } else if (this.activeTool === 'note') {
               const pointer = fCanvas.getPointer(o.e);

               const note = document.createElement('div');
               note.className = 'sticky-note';
               note.style.position = 'absolute';
               note.style.left = `${pointer.x}px`;
               note.style.top = `${pointer.y}px`;
               note.style.width = '200px';
               note.style.background = '#fff59d';
               note.style.padding = '12px';
               note.style.borderRadius = '4px';
               note.style.boxShadow = '0 2px 8px rgba(0,0,0,0.2)';
               note.style.zIndex = '50';
               note.innerHTML = `
                   <div class="close-note" style="position: absolute; top: 4px; right: 8px; cursor: pointer; font-size: 18px; color: #666;">×</div>
                   <textarea placeholder="Inserisci la tua nota..." style="width: 100%; border: none; background: transparent; resize: none; font-family: inherit; outline: none;"></textarea>
               `;

               const closeBtn = note.querySelector('.close-note');
               if (closeBtn) {
                   closeBtn.addEventListener('click', () => {
                       note.remove();
                       this.saveAnnotationsToStorage();
                   });
               }

               const textarea = note.querySelector('textarea');
               if (textarea) {
                   textarea.addEventListener('input', () => {
                       this.saveAnnotationsToStorage();
                   });
               }

               const page = this.currentPages.get(pageNum);
               if (page) {
                   page.container.appendChild(note);
               }

               this.saveAnnotationsToStorage();
          } else if (this.activeTool === 'eraser' && o.target) {
               fCanvas.remove(o.target);
               this.saveAnnotationsToStorage();
          }
      });

      fCanvas.on('object:modified', () => {
          this.saveAnnotationsToStorage();
      });
  }

  private async saveAnnotationsToStorage() {
      this.currentPages.forEach(async (page, pageNum) => {
          const stickyNotesData: any[] = [];
          const notes = page.container.querySelectorAll('.sticky-note');
          notes.forEach(note => {
              const el = note as HTMLElement;
              const textarea = note.querySelector('textarea');
              stickyNotesData.push({
                  left: el.style.left,
                  top: el.style.top,
                  content: textarea ? textarea.value : ''
              });
          });

          const data = {
              fabric: page.fabricCanvas.toJSON(),
              stickyNotes: stickyNotesData
          };

          const json = JSON.stringify(data);
          const ann: Omit<Annotation, 'docId'> = {
              id: `page_${pageNum}`,
              page: pageNum,
              type: 'text',
              color: '',
              text: json
          };
          await storage.saveAnnotation(this.docId, ann as Annotation);
          bus.publish('annotations-updated');
      });
  }

  private setupIntersectionObserver() {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        const target = entry.target as HTMLElement;
        const pageNum = parseInt(target.dataset.page || '1');
        if (entry.isIntersecting) {
          this.renderPage(pageNum);
        }
      });
    }, { root: this._container, threshold: 0.1 });
=======
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
>>>>>>> 692cdb1 (Refactor: Rifondazione architettura Fluent UI, worker estrazione testo e virtual scrolling)

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
      const containerWidth = this.scroll.clientWidth - 48; // padding
      const newZoom = containerWidth / this.baseWidth;
      store.set('zoom', +Math.max(0.25, Math.min(4.0, newZoom)).toFixed(2));
    });

    bus.subscribe('fit-page', () => {
      const containerWidth = this.scroll.clientWidth - 48;
      const containerHeight = this.scroll.clientHeight - 48;
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
    }, {
      root: this.scroll,
      rootMargin: '300px 0px',
      threshold: 0,
    });

    this.pages.forEach((state) => {
      this.observer!.observe(state.container);
    });
  }

  private requestRender(pageNum: number): void {
    if (!this.worker || this.pendingRenders.has(pageNum)) return;
<<<<<<< HEAD
    this.pendingRenders.set(pageNum, true);

    // We send scale 1.0 to get base size, or we send this.zoom to get high res?
    // Let's send 1.0 and scale with CSS/Canvas dimensions for now to avoid re-rendering on every zoom change,
    // or send this.zoom to get crisp text. The original code sends this.zoom.
    this.worker.postMessage({
      type: 'RENDER',
      payload: { pageNumber: pageNum, scale: 2.0 } // Render at 2x for sharpness
    });
  }

  private async loadAnnotations(pageNum: number, fCanvas: fabric.Canvas) {
    const annotations = await storage.loadAnnotations(this.docId);
    const pageAnnots = annotations.filter(a => a.page === pageNum);

    if (pageAnnots.length > 0) {
        try {
            const json = pageAnnots[0].text;
            if (json) {
                const parsed = JSON.parse(json);
                if (parsed.fabric) {
                    fCanvas.loadFromJSON(parsed.fabric, () => {
                        fCanvas.renderAll();
                    });
                }
                if (parsed.stickyNotes) {
                    const page = this.currentPages.get(pageNum);
                    if (page) {
                        parsed.stickyNotes.forEach((noteData: any) => {
                           const note = document.createElement('div');
                           note.className = 'sticky-note';
                           note.style.position = 'absolute';
                           note.style.left = noteData.left;
                           note.style.top = noteData.top;
                           note.style.width = '200px';
                           note.style.background = '#fff59d';
                           note.style.padding = '12px';
                           note.style.borderRadius = '4px';
                           note.style.boxShadow = '0 2px 8px rgba(0,0,0,0.2)';
                           note.style.zIndex = '50';
                           note.innerHTML = `
                               <div class="close-note" style="position: absolute; top: 4px; right: 8px; cursor: pointer; font-size: 18px; color: #666;">×</div>
                               <textarea placeholder="Inserisci la tua nota..." style="width: 100%; border: none; background: transparent; resize: none; font-family: inherit; outline: none;">${noteData.content}</textarea>
                           `;

                           const closeBtn = note.querySelector('.close-note');
                           if (closeBtn) {
                               closeBtn.addEventListener('click', () => {
                                   note.remove();
                                   this.saveAnnotationsToStorage();
                               });
                           }

                           const textarea = note.querySelector('textarea');
                           if (textarea) {
                               textarea.addEventListener('input', () => {
                                   this.saveAnnotationsToStorage();
                               });
                           }

                           page.container.appendChild(note);
                        });
                    }
                }
            }
        } catch (e) {
            console.error('Error loading annotations', e);
        }
    }
  }

  private scrollToPage(pageNum: number) {
    const page = this.currentPages.get(pageNum);
    if (page) {
      page.container.scrollIntoView({ behavior: 'smooth', block: 'start' });
      this.currentPageNum = pageNum;
      bus.publish('page-changed', pageNum);
    }
=======

    const state = this.pages.get(pageNum);
    if (!state) return;

    const zoom = store.get('zoom');
    const dpr = window.devicePixelRatio || 1;
    const renderScale = zoom * dpr;

    // Skip if already rendered at this scale
    if (state.rendered && Math.abs(state.renderScale - renderScale) < 0.01) return;

    this.pendingRenders.add(pageNum);
    this.worker.postMessage({
      type: 'RENDER',
      payload: { pageNumber: pageNum, scale: renderScale },
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
        console.error('[Viewer] Worker error:', data.message || (payload as Record<string, unknown>)?.message);
        break;
      }
    }
  }

  private buildTextLayer(
    container: HTMLDivElement,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    items: any[],
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    _styles: any,
    zoom: number,
    dpr: number
  ): void {
    container.innerHTML = '';
    if (!items) return;

    const scale = zoom * dpr;

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
      span.style.fontFamily = 'sans-serif';

      if (item.width) {
        const actualWidth = item.width * scale;
        span.style.width = `${actualWidth / scale}px`;
        span.style.letterSpacing = '0px';
      }

      container.appendChild(span);
    }
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
    const scrollTop = this.scroll.scrollTop;
    const scrollCenter = scrollTop + this.scroll.clientHeight / 3;

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
    state.container.scrollIntoView({ behavior: 'smooth', block: 'start' });
    store.set('currentPage', pageNum);
  }

  private showFindBar(): void {
    if (this.findBarElement) return;
    // Import and create find bar dynamically
    import('./find-bar').then(() => {
      const fb = document.createElement('pdfiuh-findbar') as HTMLElement;
      this.scroll.appendChild(fb);
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

  /** Used by find bar to highlight matches in text layers */
  highlightTextMatch(pageNum: number, matchIndex: number, isCurrent: boolean): void {
    const state = this.pages.get(pageNum);
    if (!state) return;

    const spans = state.textLayer.querySelectorAll('span');
    let count = 0;
    for (const span of spans) {
      const text = span.textContent || '';
      if (text.trim()) {
        if (count === matchIndex) {
          span.classList.add(isCurrent ? 'find-match-current' : 'find-match');
          if (isCurrent) {
            span.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
        }
        count++;
      }
    }
  }

  /** Clear all find highlights */
  clearFindHighlights(): void {
    this.pages.forEach(state => {
      state.textLayer.querySelectorAll('.find-match, .find-match-current').forEach(el => {
        el.classList.remove('find-match', 'find-match-current');
      });
    });
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
  }

  disconnectedCallback(): void {
    this.destroyAll();
>>>>>>> 692cdb1 (Refactor: Rifondazione architettura Fluent UI, worker estrazione testo e virtual scrolling)
  }

  render() {
    this.shadowRoot!.innerHTML = `
      <style>
        :host {
          display: block;
          flex: 1;
          height: 100%;
          overflow: hidden;
          background: #525659;
        }
        .viewer-container {
            width: 100%;
            height: 100%;
            overflow: auto;
            position: relative;
            display: flex;
            flex-direction: column;
            align-items: center;
            padding: 20px;
            box-sizing: border-box;
        }
        .page-wrapper {
            position: relative;
            margin-bottom: 20px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
            background: white;
        }
        .pdf-canvas {
            display: block;
        }
        .annot-canvas {
            position: absolute !important;
            top: 0;
            left: 0;
        }
        .canvas-container {
            position: absolute !important;
            top: 0;
            left: 0;
        }
      </style>
      <div class="viewer-container"></div>
    `;
  }
}

customElements.define('pdfiuh-viewer', PDFiuhViewer);
export default PDFiuhViewer;
