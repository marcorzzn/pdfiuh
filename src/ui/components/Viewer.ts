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

    // UN SOLO listener per tutte le risposte di rendering
    this.worker.onmessage = (e) => {
      const { type, payload } = e.data;
      if (type === 'RENDERED') {
        const { pageNumber, bitmap } = payload;
        const page = this.currentPages.get(pageNumber);
        if (page) {
          const ctx = page.canvas.getContext('2d');
          if (ctx) ctx.drawImage(bitmap, 0, 0);
          this.loadAnnotations(pageNumber, page.svg);
        }
      }
    };

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
      type: 'RENDER',
      payload: {
        pageNumber: pageNum,
        scale: 1.0, // Renderizziamo sempre a 1:1 e scaliamo via CSS
      }
    });
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
      } else if (ann.type === 'highlight' && ann.rect) {
        const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        rect.setAttribute('x', ann.rect.x * this.BASE_WIDTH);
        rect.setAttribute('y', ann.rect.y * this.BASE_HEIGHT);
        rect.setAttribute('width', ann.rect.w * this.BASE_WIDTH);
        rect.setAttribute('height', ann.rect.h * this.BASE_HEIGHT);
        rect.setAttribute('fill', ann.color || 'rgba(255, 255, 0, 0.4)');
        rect.setAttribute('class', 'annotation-path');
        svg.appendChild(rect);
      } else if (ann.type === 'text') {
        const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        // Assuming text is placed at the first point or a default position if points are missing
        const x = ann.points ? ann.points[0] * this.BASE_WIDTH : 10;
        const y = ann.points ? ann.points[1] * this.BASE_HEIGHT : 20;
        text.setAttribute('x', x.toString());
        text.setAttribute('y', y.toString());
        text.setAttribute('fill', ann.color || '#61afef');
        text.setAttribute('class', 'annotation-text');
        text.textContent = ann.text || 'Nota';
        svg.appendChild(text);
      }
    });
  }

  private setupPageEvents(pageNum: number, svg: SVGSVGElement) {
    svg.addEventListener('mousedown', (e) => {
      const rect = svg.getBoundingClientRect();
      const x = (e.clientX - rect.left) * (this.BASE_WIDTH / rect.width);
      const y = (e.clientY - rect.top) * (this.BASE_HEIGHT / rect.height);
      const nx = x / this.BASE_WIDTH;
      const ny = y / this.BASE_HEIGHT;

      if (this.activeTool === 'select') {
        // Implementazione base: seleziona l'annotazione sotto il mouse
        this.handleSelect(e, nx, ny, svg);
        return;
      }

      if (this.activeTool === 'erase') {
        this.handleErase(nx, ny, svg);
        return;
      }

      this.isDrawing = true;
      this.currentPathPoints = [nx, ny];

      if (this.activeTool === 'ink') {
        this.drawTempPath(svg);
      } else if (this.activeTool === 'highlight') {
        this.drawTempHighlight(svg, nx, ny);
      } else if (this.activeTool === 'text') {
        this.handleTextAnnotation(pageNum, nx, ny, svg);
      }
    });

    svg.addEventListener('mousemove', (e) => {
      if (!this.isDrawing) return;

      const rect = svg.getBoundingClientRect();
      const x = (e.clientX - rect.left) * (this.BASE_WIDTH / rect.width);
      const y = (e.clientY - rect.top) * (this.BASE_HEIGHT / rect.height);
      const nx = x / this.BASE_WIDTH;
      const ny = y / this.BASE_HEIGHT;

      if (this.activeTool === 'ink') {
        this.currentPathPoints.push(nx, ny);
        this.drawTempPath(svg);
      } else if (this.activeTool === 'highlight') {
        this.drawTempHighlight(svg, nx, ny);
      }
    });

    svg.addEventListener('mouseup', async () => {
      if (!this.isDrawing) return;
      this.isDrawing = false;

      const ann: Annotation = {
        id: Math.random().toString(36).substr(2, 9),
        page: pageNum,
        type: this.activeTool as any,
        color: this.activeTool === 'highlight' ? '#ffff00' : '#61afef',
        points: this.currentPathPoints,
        rect: this.activeTool === 'highlight' ? this.calculateHighlightRect() : undefined,
        text: this.activeTool === 'text' ? 'Nuova nota' : undefined
      };

      await storage.saveAnnotation(this.docId, ann);
      this.loadAnnotations(pageNum, svg);
    });
  }

  private calculateHighlightRect() {
    if (this.currentPathPoints.length < 4) return undefined;
    const xs = this.currentPathPoints.filter((_, i) => i % 2 === 0);
    const ys = this.currentPathPoints.filter((_, i) => i % 2 !== 0);
    return {
      x: Math.min(...xs),
      y: Math.min(...ys),
      w: Math.max(...xs) - Math.min(...xs),
      h: Math.max(...ys) - Math.min(...ys)
    };
  }

  private drawTempPath(svg: SVGSVGElement) {
    const existing = svg.querySelector('.temp-path');
    if (existing) existing.remove();
    if (this.currentPathPoints.length < 4) return;

    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', AnnotationEngine.generateSvgPath(this.currentPathPoints, this.BASE_WIDTH, this.BASE_HEIGHT));
    path.setAttribute('class', 'annotation-path temp-path');
    svg.appendChild(path);
  }

  private drawTempHighlight(svg: SVGSVGElement, currentX: number, currentY: number) {
    const existing = svg.querySelector('.temp-highlight');
    if (existing) existing.remove();

    const startX = this.currentPathPoints[0];
    const startY = this.currentPathPoints[1];
    const width = currentX - startX;
    const height = currentY - startY;

    const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    rect.setAttribute('x', Math.min(startX, currentX) * this.BASE_WIDTH);
    rect.setAttribute('y', Math.min(startY, currentY) * this.BASE_HEIGHT);
    rect.setAttribute('width', Math.abs(width) * this.BASE_WIDTH);
    rect.setAttribute('height', Math.abs(height) * this.BASE_HEIGHT);
    rect.setAttribute('fill', 'rgba(255, 255, 0, 0.4)');
    rect.setAttribute('class', 'temp-highlight');
    svg.appendChild(rect);
  }

  private async handleTextAnnotation(pageNum: number, x: number, y: number, svg: SVGSVGElement) {
    const text = prompt('Inserisci il testo della nota:');
    if (text) {
      const ann: Annotation = {
        id: Math.random().toString(36).substr(2, 9),
        page: pageNum,
        type: 'text',
        color: '#61afef',
        text: text,
        points: [x, y] // Store position in points for rendering
      };
      await storage.saveAnnotation(this.docId, ann);
      this.loadAnnotations(pageNum, svg);
    }
  }

  private async handleErase(nx: number, ny: number, svg: SVGSVGElement) {
    const pageNum = parseInt(svg.closest('.page-wrapper')?.dataset.page || '0');
    const annots = await storage.loadAnnotations(this.docId);
    const pageAnnots = annots.filter(a => a.page === pageNum);

    for (const ann of pageAnnots) {
      let shouldDelete = false;
      if (ann.type === 'highlight' && ann.rect) {
        const r = ann.rect;
        if (nx >= r.x && nx <= r.x + r.w && ny >= r.y && ny <= r.y + r.h) {
          shouldDelete = true;
        }
      } else if (ann.type === 'text' && ann.points) {
        const dx = nx - ann.points[0];
        const dy = ny - ann.points[1];
        if (Math.sqrt(dx * dx + dy * dy) < 0.02) {
          shouldDelete = true;
        }
      } else if (ann.type === 'ink' && ann.points) {
        // For ink, we check if any point is close enough
        for (let i = 0; i < ann.points.length; i += 2) {
          const dx = nx - ann.points[i];
          const dy = ny - ann.points[i + 1];
          if (Math.sqrt(dx * dx + dy * dy) < 0.01) {
            shouldDelete = true;
            break;
          }
        }
      }

      if (shouldDelete) {
        await storage.deleteAnnotation(this.docId, ann.id);
      }
    }
    this.loadAnnotations(pageNum, svg);
  }

  private handleSelect(e: MouseEvent, nx: number, ny: number, svg: SVGSVGElement) {
    // Implementazione base: evidenzia l'elemento selezionato
    console.log(`Selecting annotation at ${nx}, ${ny}`);
  }

  private scrollToPage(pageNum: number) {
    const page = this.currentPages.get(pageNum);
    if (page) {
      page.container.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }
}

customElements.define('pdfiuh-viewer', PDFiuhViewer);
