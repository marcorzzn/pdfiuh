import { bus } from '../../core/event-bus';
import { storage, type Annotation } from '../../annotations/storage';
import { AnnotationEngine } from '../../annotations/engine';
import { fabric } from 'fabric';

class PDFiuhViewer extends HTMLElement {
  private worker: Worker | null = null;
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

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

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
  }

  private updateLayout() {
    if (!this._container) return;
    this._container.innerHTML = '';
    this.currentPages.clear();

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

    this._container?.querySelectorAll('.page-wrapper').forEach(el => observer.observe(el));
  }

  private renderPage(pageNum: number) {
    if (!this.worker || this.pendingRenders.has(pageNum)) return;
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
