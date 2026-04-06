import { bus } from '../../core/event-bus';
import { AnnotationEngine, NormalizedCoord } from '../../annotations/engine';
import { storage, Annotation } from '../../annotations/storage';
import type { Tool } from '../components/Toolbar';

class PDFiuhViewer extends HTMLElement {
  private worker: Worker;
  private zoom = 1.0;
  private totalPages = 0;
  private currentPages: Map<number, { canvas: HTMLCanvasElement, svg: SVGSVGElement }> = new Map();
  private container: HTMLDivElement;
  private activeTool: Tool = 'select';
  private isDrawing = false;
  private currentPathPoints: number[] = [];
  private activeAnnotationId: string | null = null;

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  connectedCallback() {
    this.render();
    this.setupEventListeners();
  }

  private setupEventListeners() {
    bus.subscribe('tool-change', (tool: Tool) => {
      this.activeTool = tool;
      this.updateInteractionMode();
    });

    bus.subscribe('zoom-change', (delta) => {
      this.zoom = Math.max(0.2, Math.min(5.0, this.zoom + delta));
      this.updateLayout();
      bus.publish('zoom-updated', this.zoom);
    });

    bus.subscribe('fit-change', (type) => {
      this.zoom = type === 'width' ? 0.8 : 0.5; // Mock values
      this.updateLayout();
      bus.publish('zoom-updated', this.zoom);
    });
  }

  private updateInteractionMode() {
    // Se siamo in modalità 'select', permettiamo l'interazione con gli elementi SVG
    // Altrimenti, l'overlay intercetta tutto per disegnare
    const overlays = this.shadowRoot!.querySelectorAll('svg');
    overlays.forEach(svg => {
      svg.style.pointerEvents = this.activeTool === 'select' ? 'auto' : 'all';
    });
  }

  private render() {
    this.shadowRoot!.innerHTML = `
      <style>
        :host {
          display: block;
          height: 100%;
          overflow: auto;
          background: #333;
          position: relative;
        }
        .pages-container {
          display: flex;
          flex-direction: column;
          align-items: center;
          padding: 20px 0;
        }
        .page-wrapper {
          position: relative;
          margin-bottom: 20px;
          box-shadow: 0 4px 20px rgba(0,0,0,0.5);
        }
        canvas {
          display: block;
          background: white;
        }
        svg {
          position: absolute;
          top: 0; left: 0;
          width: 100%; height: 100%;
          pointer-events: none;
        }
        .annotation-path {
          fill: none;
          stroke: var(--accent, #61afef);
          stroke-width: 2;
          stroke-linecap: round;
          stroke-linejoin: round;
        }
        .annotation-highlight {
          fill: rgba(255, 255, 0, 0.4);
          mix-blend-mode: multiply;
        }
      </style>
      <div class="pages-container" id="pages-container"></div>
    `;
    this.container = this.shadowRoot!.getElementById('pages-container')!;
    this.addEventListener('scroll', () => this.updateVisiblePages());
  }

  public async setDocumentInfo(docId: string, totalPages: number, worker: Worker) {
    this.totalPages = totalPages;
    this.worker = worker;
    this.updateLayout();

    // Carica annotazioni esistenti
    const annotations = await storage.loadAnnotations(docId);
    this.renderExistingAnnotations(annotations);
  }

  private updateVisiblePages() {
    // Mock virtualizzazione: carica prime 3 pagine
    if (this.currentPages.size === 0) {
      for (let i = 1; i <= Math.min(this.totalPages, 3); i++) {
        this.createPage(i);
      }
    }
  }

  private createPage(pageNumber: number) {
    const wrapper = document.createElement('div');
    wrapper.className = 'page-wrapper';

    const canvas = document.createElement('canvas');
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');

    wrapper.appendChild(canvas);
    wrapper.appendChild(svg);
    this.container.appendChild(wrapper);

    this.currentPages.set(pageNumber, { canvas, svg });

    // Gestione input per disegni
    svg.addEventListener('pointerdown', (e) => this.startDrawing(e, pageNumber));
    svg.addEventListener('pointermove', (e) => this.draw(e, pageNumber));
    svg.addEventListener('pointerup', (e) => this.stopDrawing(e, pageNumber));

    this.requestPageRender(pageNumber);
  }

  private requestPageRender(pageNumber: number) {
    const page = this.currentPages.get(pageNumber);
    if (!page) return;

    const { canvas } = page;
    const width = 800 * this.zoom;
    const height = 1100 * this.zoom;
    canvas.width = width;
    canvas.height = height;

    this.worker.postMessage({
      type: 'RENDER_PAGE',
      payload: { pageNumber, scale: this.zoom, width, height }
    });

    const handler = (e: MessageEvent) => {
      if (e.data.type === 'PAGE_RENDERED' && e.data.payload.pageNumber === pageNumber) {
        const ctx = canvas.getContext('2d');
        if (ctx) ctx.drawImage(e.data.payload.bitmap, 0, 0);
        this.worker.removeEventListener('message', handler);
      }
    };
    this.worker.addEventListener('message', handler);
  }

  private startDrawing(e: PointerEvent, pageNumber: number) {
    if (this.activeTool === 'select') return;

    this.isDrawing = true;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const normalized = AnnotationEngine.pixelToNormalized(x, y, rect.width, rect.height);
    this.currentPathPoints = [normalized.x, normalized.y];
    this.activeAnnotationId = crypto.randomUUID();

    if (this.activeTool === 'ink' || this.activeTool === 'highlight') {
      const svg = this.currentPages.get(pageNumber)!.svg;
      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      path.setAttribute('id', this.activeAnnotationId!);
      path.setAttribute('class', this.activeTool === 'ink' ? 'annotation-path' : 'annotation-highlight');
      if (this.activeTool === 'highlight') path.setAttribute('stroke-width', '20');
      svg.appendChild(path);
    }
  }

  private draw(e: PointerEvent, pageNumber: number) {
    if (!this.isDrawing) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const normalized = AnnotationEngine.pixelToNormalized(x, y, rect.width, rect.height);

    this.currentPathPoints.push(normalized.x, normalized.y);

    const svg = this.currentPages.get(pageNumber)!.svg;
    const path = svg.getElementById(this.activeAnnotationId!);
    if (path) {
      path.setAttribute('d', AnnotationEngine.generateSvgPath(this.currentPathPoints, rect.width, rect.height));
    }
  }

  private async stopDrawing(e: PointerEvent, pageNumber: number) {
    if (!this.isDrawing) return;
    this.isDrawing = false;

    const rect = e.currentTarget.getBoundingClientRect();

    // Salva l'annotazione in IndexedDB
    const annotation: Annotation = {
      id: this.activeAnnotationId!,
      page: pageNumber,
      type: this.activeTool as any,
      color: '#61afef',
      points: this.currentPathPoints
    };

    await storage.saveAnnotation('demo-doc', annotation);
    this.activeAnnotationId = null;
    this.currentPathPoints = [];
  }

  private renderExistingAnnotations(annotations: Annotation[]) {
    annotations.forEach(ann => {
      const page = this.currentPages.get(ann.page);
      if (!page) return;

      const svg = page.svg;
      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      path.setAttribute('id', ann.id);
      path.setAttribute('class', ann.type === 'ink' ? 'annotation-path' : 'annotation-highlight');
      if (ann.type === 'highlight') path.setAttribute('stroke-width', '20');

      const rect = svg.getBoundingClientRect();
      path.setAttribute('d', AnnotationEngine.generateSvgPath(ann.points!, rect.width, rect.height));
      svg.appendChild(path);
    });
  }

  private updateLayout() {
    this.currentPages.forEach(({ canvas, svg }) => {
      const width = 800 * this.zoom;
      const height = 1100 * this.zoom;
      canvas.width = width;
      canvas.height = height;
      svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
      // In una versione reale, qui forzeremmo il re-render del bitmap
    });
  }
}

customElements.define('pdfiuh-viewer', PDFiuhViewer);
export default PDFiuhViewer;
