import { bus } from '../../core/event-bus';
import { AnnotationEngine, NormalizedCoord } from '../../annotations/engine';
import { storage, Annotation } from '../../annotations/storage';
import type { Tool } from '../components/Toolbar';

interface PageElement {
  canvas: HTMLCanvasElement;
  svg: SVGSVGElement;
  container: HTMLDivElement;
}

class PDFiuhViewer extends HTMLElement {
  private worker: Worker | null = null;
  private zoom = 1.0;
  private totalPages = 0;
  private docId = 'demo-doc-123';
  private currentPages = new Map<number, PageElement>();
  private activeTool: Tool = 'select';

  // Drawing state
  private isDrawing = false;
  private currentPathPoints: number[] = [];

  // Constants for A4 Page
  private readonly BASE_WIDTH = 595;
  private readonly BASE_HEIGHT = 842;

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
    });

    bus.subscribe('fit-change', (type) => {
      this.zoom = type === 'width' ? 0.8 : 0.5;
      this.updateLayout();
    });

    bus.subscribe('go-to-page', (pageNumber: number) => {
      this.scrollToPage(pageNumber);
    });
  }

  private updateInteractionMode() {
    const overlays = this.shadowRoot!.querySelectorAll('svg');
    overlays.forEach(svg => {
      // Se siamo in 'select', permettiamo l'interazione con gli elementi SVG (per spostarli/eliminarli)
      // Altrimenti, l'overlay intercetta tutto per disegnare
      svg.style.pointerEvents = this.activeTool === 'select' ? 'auto' : 'all';
    });
  }

  private render() {
    this.shadowRoot!.innerHTML = `
      <style>
        :host {
          display: block;
          height: 100%;
          overflow-y: auto;
          background: #1e1e1e;
          scrollbar-width: thin;
          scrollbar-color: #2c313a transparent;
        }
        .pages-container {
          display: flex;
          flex-direction: column;
          align-items: center;
          padding: 40px 0;
        }
        .page-wrapper {
          position: relative;
          margin-bottom: 40px;
          box-shadow: 0 10px 30px rgba(0,0,0,0.6);
          background: white;
          transition: transform 0.1s ease-out;
        }
        canvas {
          display: block;
          background: white;
        }
        svg {
          position: absolute;
          top: 0; left: 0;
          width: 100%; height: 100%;
          user-select: none;
        }
        .annotation-path {
          fill: none;
          stroke: var(--accent, #61afef);
          stroke-width: 2;
          stroke-linecap: round;
          stroke-linejoin: round;
        }
      </style>
      <div class="pages-container" id="pages-container"></div>
    `;
    this.container = this.shadowRoot!.getElementById('pages-container')!;
  }

  private get container() {
    return this.shadowRoot!.getElementById('pages-container')!;
  }

  public setDocumentInfo(docId: string, totalPages: number, worker: Worker) {
    this.docId = docId;
    this.totalPages = totalPages;
    this.worker = worker;
    this.updateLayout();
  }

  private updateLayout() {
    this.container.innerHTML = '';
    this.currentPages.clear();

    // Creiamo i placeholder per tutte le pagine per mantenere lo scroll corretto (Virtualizzazione)
    for (let i = 1; i <= this.totalPages; i++) {
      const wrapper = document.createElement('div');
      wrapper.className = 'page-wrapper';
      wrapper.dataset.page = i.toString();

      const width = this.BASE_WIDTH * this.zoom;
      const height = this.BASE_HEIGHT * this.zoom;
      wrapper.style.width = `${width}px`;
      wrapper.style.height = `${height}px`;

      const canvas = document.createElement('canvas');
      canvas.width = this.BASE_WIDTH; // Rendering a risoluzione base
      canvas.height = this.BASE_HEIGHT;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;

      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.setAttribute('viewBox', `0 0 ${this.BASE_WIDTH} ${this.BASE_HEIGHT}`);

      wrapper.appendChild(canvas);
      wrapper.appendChild(svg);
      this.container.appendChild(wrapper);

      this.currentPages.set(i, { canvas, svg, container: wrapper });
      this.setupPageEvents(i, svg);
    }

    this.setupIntersectionObserver();
  }

  private setupIntersectionObserver() {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        const pageNum = parseInt(entry.target.dataset.page!);
        if (entry.isIntersecting) {
          this.renderPage(pageNum);
        }
      });
    }, { root: this, threshold: 0.1 });

    this.container.querySelectorAll('.page-wrapper').forEach(el => observer.observe(el));
  }

  private async renderPage(pageNum: number) {
    const page = this.currentPages.get(pageNum);
    if (!page || !this.worker) return;

    // 1. Richiedi rasterizzazione al worker
    this.worker.postMessage({
      type: 'RENDER_PAGE',
      payload: {
        pageNumber: pageNum,
        scale: 1.0, // Renderizziamo sempre a 1:1 e scaliamo via CSS
        width: this.BASE_WIDTH,
        height: this.BASE_HEIGHT
      }
    });

    // Ascolta il risultato per questa specifica pagina
    // (Nota: In un'app reale useremmo un sistema di callback o promesse per evitare conflitti di messaggi)
    const handleMessage = (e: MessageEvent) => {
      if (e.data.type === 'PAGE_RENDERED' && e.data.payload.pageNumber === pageNum) {
        const { bitmap } = e.data.payload;
        const ctx = page.canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(bitmap, 0, 0);
        }
        this.worker!.removeEventListener('message', handleMessage);
        this.loadAnnotations(pageNum, page.svg);
      }
    };
    this.worker.addEventListener('message', handleMessage);
  }

  private async loadAnnotations(pageNum: number, svg: SVGSVGElement) {
    const annotations = await storage.loadAnnotations(this.docId);
    const pageAnnots = annotations.filter(a => a.page === pageNum);

    svg.innerHTML = '';
    pageAnnots.forEach(ann => {
      if (ann.type === 'ink' && ann.points) {
        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        path.setAttribute('d', AnnotationEngine.generateSvgPath(ann.points, this.BASE_WIDTH, this.BASE_HEIGHT));
        path.setAttribute('class', 'annotation-path');
        svg.appendChild(path);
      }
    });
  }

  private setupPageEvents(pageNum: number, svg: SVGSVGElement) {
    svg.addEventListener('mousedown', (e) => {
      if (this.activeTool === 'select') return;

      this.isDrawing = true;
      this.currentPathPoints = [];

      const rect = svg.getBoundingClientRect();
      const x = (e.clientX - rect.left) * (this.BASE_WIDTH / rect.width);
      const y = (e.clientY - rect.top) * (this.BASE_HEIGHT / rect.height);

      this.currentPathPoints.push(x / this.BASE_WIDTH, y / this.BASE_HEIGHT);
      this.drawTempPath(svg);
    });

    svg.addEventListener('mousemove', (e) => {
      if (!this.isDrawing) return;

      const rect = svg.getBoundingClientRect();
      const x = (e.clientX - rect.left) * (this.BASE_WIDTH / rect.width);
      const y = (e.clientY - rect.top) * (this.BASE_HEIGHT / rect.height);

      this.currentPathPoints.push(x / this.BASE_WIDTH, y / this.BASE_HEIGHT);
      this.drawTempPath(svg);
    });

    svg.addEventListener('mouseup', async () => {
      if (!this.isDrawing) return;
      this.isDrawing = false;

      const ann: Annotation = {
        id: Math.random().toString(36).substr(2, 9),
        page: pageNum,
        type: 'ink',
        color: '#61afef',
        points: this.currentPathPoints
      };

      await storage.saveAnnotation(this.docId, ann);
      this.loadAnnotations(pageNum, svg);
    });
  }

  private drawTempPath(svg: SVGSVGElement) {
    // Rimuove percorsi temporanei precedenti
    const existing = svg.querySelector('.temp-path');
    if (existing) existing.remove();

    if (this.currentPathPoints.length < 2) return;

    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', AnnotationEngine.generateSvgPath(this.currentPathPoints, this.BASE_WIDTH, this.BASE_HEIGHT));
    path.setAttribute('class', 'annotation-path temp-path');
    svg.appendChild(path);
  }

  private scrollToPage(pageNum: number) {
    const page = this.currentPages.get(pageNum);
    if (page) {
      page.container.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }
}

customElements.define('pdfiuh-viewer', PDFiuhViewer);
