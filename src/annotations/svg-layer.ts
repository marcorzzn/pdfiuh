/**
 * pdfiuh SVG Annotation Layer
 * Manages SVG overlay for annotations on a single page.
 * Replaces Fabric.js with native SVG — zero dependency, ~5KB vs 300KB.
 */
import { store } from '../state/store';
import { storage, type Annotation } from './storage';

const SVG_NS = 'http://www.w3.org/2000/svg';

/** Ramer-Douglas-Peucker path simplification */
function simplifyPath(points: number[], epsilon: number): number[] {
  if (points.length <= 4) return points;

  const n = points.length / 2;
  let maxDist = 0;
  let maxIdx = 0;

  const sx = points[0], sy = points[1];
  const ex = points[points.length - 2], ey = points[points.length - 1];

  for (let i = 1; i < n - 1; i++) {
    const px = points[i * 2], py = points[i * 2 + 1];
    const dist = perpendicularDist(px, py, sx, sy, ex, ey);
    if (dist > maxDist) {
      maxDist = dist;
      maxIdx = i;
    }
  }

  if (maxDist > epsilon) {
    const left = simplifyPath(points.slice(0, (maxIdx + 1) * 2), epsilon);
    const right = simplifyPath(points.slice(maxIdx * 2), epsilon);
    return left.slice(0, -2).concat(right);
  }

  return [sx, sy, ex, ey];
}

function perpendicularDist(px: number, py: number, sx: number, sy: number, ex: number, ey: number): number {
  const dx = ex - sx, dy = ey - sy;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return Math.hypot(px - sx, py - sy);
  const t = Math.max(0, Math.min(1, ((px - sx) * dx + (py - sy) * dy) / lenSq));
  return Math.hypot(px - (sx + t * dx), py - (sy + t * dy));
}

export class SVGAnnotationLayer {
  private svg: SVGSVGElement;
  private pageNum: number;
  private docId: string;
  private pageWidth: number;
  private pageHeight: number;

  // Ink drawing state
  private isDrawing = false;
  private currentPoints: number[] = [];
  private tempPath: SVGPathElement | null = null;

  // Highlight drawing state
  private highlightStart: { x: number; y: number } | null = null;
  private tempRect: SVGRectElement | null = null;

  constructor(svg: SVGSVGElement, pageNum: number, docId: string, pageWidth: number, pageHeight: number) {
    this.svg = svg;
    this.pageNum = pageNum;
    this.docId = docId;
    this.pageWidth = pageWidth;
    this.pageHeight = pageHeight;

    this.svg.setAttribute('viewBox', `0 0 1 1`);
    this.svg.setAttribute('preserveAspectRatio', 'none');
    this.setupEvents();
  }

  updateDimensions(w: number, h: number): void {
    this.pageWidth = w;
    this.pageHeight = h;
  }

  async loadAnnotations(): Promise<void> {
    const annots = await storage.loadAnnotations(this.docId, this.pageNum);
    // Clear existing rendered annotations (keep temp elements)
    this.svg.querySelectorAll('[data-annot-id]').forEach(el => el.remove());
    for (const ann of annots) {
      this.renderAnnotation(ann);
    }
  }

  private renderAnnotation(ann: Annotation): void {
    switch (ann.type) {
      case 'ink': this.renderInk(ann); break;
      case 'highlight': this.renderHighlight(ann); break;
      case 'note': this.renderNote(ann); break;
    }
  }

  private renderInk(ann: Annotation): void {
    if (!ann.points || ann.points.length < 4) return;
    const path = document.createElementNS(SVG_NS, 'path');
    path.setAttribute('d', this.buildPathD(ann.points));
    path.setAttribute('class', 'annot-ink');
    path.setAttribute('stroke', ann.color || '#2196F3');
    path.setAttribute('stroke-width', `${(ann.width || 2) / this.pageWidth}`);
    path.setAttribute('data-annot-id', ann.id);
    path.addEventListener('click', (e) => this.handleAnnotClick(e, ann));
    this.svg.appendChild(path);
  }

  private renderHighlight(ann: Annotation): void {
    if (!ann.rect) return;
    const rect = document.createElementNS(SVG_NS, 'rect');
    rect.setAttribute('x', ann.rect.x.toString());
    rect.setAttribute('y', ann.rect.y.toString());
    rect.setAttribute('width', ann.rect.w.toString());
    rect.setAttribute('height', ann.rect.h.toString());
    rect.setAttribute('fill', ann.color || '#FFEB3B');
    rect.setAttribute('opacity', (ann.opacity ?? 0.35).toString());
    rect.setAttribute('class', 'annot-highlight');
    rect.setAttribute('data-annot-id', ann.id);
    rect.addEventListener('click', (e) => this.handleAnnotClick(e, ann));
    this.svg.appendChild(rect);
  }

  private renderNote(ann: Annotation): void {
    if (!ann.points || ann.points.length < 2) return;

    const g = document.createElementNS(SVG_NS, 'g');
    g.setAttribute('data-annot-id', ann.id);
    g.setAttribute('class', 'annot-note-icon');

    // Note icon (small rectangle)
    const size = 16 / this.pageWidth;
    const nx = ann.points[0];
    const ny = ann.points[1];

    const bg = document.createElementNS(SVG_NS, 'rect');
    bg.setAttribute('x', nx.toString());
    bg.setAttribute('y', ny.toString());
    bg.setAttribute('width', size.toString());
    bg.setAttribute('height', size.toString());
    bg.setAttribute('rx', (size * 0.15).toString());
    bg.setAttribute('fill', ann.color || '#FFEB3B');
    bg.setAttribute('stroke', 'rgba(0,0,0,0.2)');
    bg.setAttribute('stroke-width', (0.5 / this.pageWidth).toString());
    g.appendChild(bg);

    // Lines inside the note icon
    for (let i = 0; i < 3; i++) {
      const line = document.createElementNS(SVG_NS, 'line');
      const padding = size * 0.2;
      const lineY = ny + padding + i * (size * 0.22);
      line.setAttribute('x1', (nx + padding).toString());
      line.setAttribute('x2', (nx + size - padding).toString());
      line.setAttribute('y1', lineY.toString());
      line.setAttribute('y2', lineY.toString());
      line.setAttribute('stroke', 'rgba(0,0,0,0.3)');
      line.setAttribute('stroke-width', (0.3 / this.pageWidth).toString());
      g.appendChild(line);
    }

    g.addEventListener('click', (e) => this.handleNoteClick(e, ann));
    this.svg.appendChild(g);
  }

  private buildPathD(points: number[]): string {
    if (points.length < 2) return '';
    let d = `M ${points[0]},${points[1]}`;
    for (let i = 2; i < points.length; i += 2) {
      d += ` L ${points[i]},${points[i + 1]}`;
    }
    return d;
  }

  private setupEvents(): void {
    this.svg.addEventListener('pointerdown', (e) => this.onPointerDown(e));
    this.svg.addEventListener('pointermove', (e) => this.onPointerMove(e));
    this.svg.addEventListener('pointerup', () => this.onPointerUp());
    this.svg.addEventListener('pointerleave', () => this.onPointerUp());
  }

  private getRelativeCoords(e: PointerEvent): { nx: number; ny: number } {
    const rect = this.svg.getBoundingClientRect();
    const nx = (e.clientX - rect.left) / rect.width;
    const ny = (e.clientY - rect.top) / rect.height;
    return {
      nx: Math.max(0, Math.min(1, nx)),
      ny: Math.max(0, Math.min(1, ny)),
    };
  }

  private onPointerDown(e: PointerEvent): void {
    const tool = store.get('activeTool');
    if (tool === 'select') return;

    e.preventDefault();
    const { nx, ny } = this.getRelativeCoords(e);

    if (tool === 'eraser') {
      this.handleEraseAt(e);
      return;
    }

    if (tool === 'note') {
      this.handleNoteCreate(nx, ny);
      return;
    }

    this.isDrawing = true;
    this.svg.setPointerCapture(e.pointerId);

    if (tool === 'ink') {
      this.currentPoints = [nx, ny];
      this.tempPath = document.createElementNS(SVG_NS, 'path');
      this.tempPath.setAttribute('class', 'annot-ink');
      this.tempPath.setAttribute('stroke', store.get('activeColor'));
      this.tempPath.setAttribute('stroke-width', `${2 / this.pageWidth}`);
      this.tempPath.setAttribute('fill', 'none');
      this.svg.appendChild(this.tempPath);
    }

    if (tool === 'highlight') {
      this.highlightStart = { x: nx, y: ny };
      this.tempRect = document.createElementNS(SVG_NS, 'rect');
      this.tempRect.setAttribute('fill', store.get('activeColor'));
      this.tempRect.setAttribute('opacity', '0.35');
      this.svg.appendChild(this.tempRect);
    }
  }

  private onPointerMove(e: PointerEvent): void {
    if (!this.isDrawing) return;
    const { nx, ny } = this.getRelativeCoords(e);
    const tool = store.get('activeTool');

    if (tool === 'ink' && this.tempPath) {
      this.currentPoints.push(nx, ny);
      this.tempPath.setAttribute('d', this.buildPathD(this.currentPoints));
    }

    if (tool === 'highlight' && this.tempRect && this.highlightStart) {
      const x = Math.min(this.highlightStart.x, nx);
      const y = Math.min(this.highlightStart.y, ny);
      const w = Math.abs(nx - this.highlightStart.x);
      const h = Math.abs(ny - this.highlightStart.y);
      this.tempRect.setAttribute('x', x.toString());
      this.tempRect.setAttribute('y', y.toString());
      this.tempRect.setAttribute('width', w.toString());
      this.tempRect.setAttribute('height', h.toString());
    }
  }

  private async onPointerUp(): Promise<void> {
    if (!this.isDrawing) return;
    this.isDrawing = false;
    const tool = store.get('activeTool');

    if (tool === 'ink' && this.tempPath && this.currentPoints.length >= 4) {
      this.tempPath.remove();
      const simplified = simplifyPath(this.currentPoints, 0.002);
      await storage.saveAnnotation(this.docId, {
        page: this.pageNum,
        type: 'ink',
        color: store.get('activeColor'),
        width: 2,
        points: simplified,
      });
      this.loadAnnotations();
    } else if (this.tempPath) {
      this.tempPath.remove();
    }

    if (tool === 'highlight' && this.tempRect && this.highlightStart) {
      const x = parseFloat(this.tempRect.getAttribute('x') || '0');
      const y = parseFloat(this.tempRect.getAttribute('y') || '0');
      const w = parseFloat(this.tempRect.getAttribute('width') || '0');
      const h = parseFloat(this.tempRect.getAttribute('height') || '0');
      this.tempRect.remove();

      if (w > 0.005 && h > 0.005) {
        await storage.saveAnnotation(this.docId, {
          page: this.pageNum,
          type: 'highlight',
          color: store.get('activeColor'),
          opacity: 0.35,
          rect: { x, y, w, h },
        });
        this.loadAnnotations();
      }
    }

    this.tempPath = null;
    this.tempRect = null;
    this.highlightStart = null;
    this.currentPoints = [];
  }

  private async handleEraseAt(e: PointerEvent): Promise<void> {
    // Use SVG hit testing — get the element under the pointer
    const target = e.target as SVGElement;
    const annotId = target.closest('[data-annot-id]')?.getAttribute('data-annot-id');
    if (annotId) {
      await storage.deleteAnnotation(annotId);
      this.loadAnnotations();
    }
  }

  private handleNoteCreate(nx: number, ny: number): void {
    this.showNotePopup(nx, ny, '', async (text) => {
      if (text.trim()) {
        await storage.saveAnnotation(this.docId, {
          page: this.pageNum,
          type: 'note',
          color: store.get('activeColor'),
          points: [nx, ny],
          text: text.trim(),
        });
        this.loadAnnotations();
      }
    });
  }

  private handleAnnotClick(e: Event, ann: Annotation): void {
    if (store.get('activeTool') !== 'select') return;
    e.stopPropagation();
    // Could show annotation details — for now, highlight it
    console.log('[SVGLayer] Annotation clicked:', ann.id);
  }

  private async handleNoteClick(e: Event, ann: Annotation): Promise<void> {
    e.stopPropagation();
    if (store.get('activeTool') === 'eraser') {
      await storage.deleteAnnotation(ann.id);
      await this.loadAnnotations();
      return;
    }

    const nx = ann.points?.[0] ?? 0;
    const ny = ann.points?.[1] ?? 0;
    this.showNotePopup(nx, ny, ann.text || '', async (text) => {
      if (text.trim()) {
        await storage.updateAnnotation(ann.id, { text: text.trim() });
        this.loadAnnotations();
      }
    });
  }

  private showNotePopup(nx: number, ny: number, existingText: string, onSave: (text: string) => void): void {
    // Remove any existing popup
    this.svg.parentElement?.querySelector('.note-popup')?.remove();

    const container = this.svg.parentElement;
    if (!container) return;

    const popup = document.createElement('div');
    popup.className = 'note-popup';
    popup.style.left = `${nx * 100}%`;
    popup.style.top = `${ny * 100}%`;

    const textarea = document.createElement('textarea');
    textarea.value = existingText;
    textarea.placeholder = 'Scrivi una nota...';

    const actions = document.createElement('div');
    actions.className = 'note-popup-actions';

    const cancelBtn = document.createElement('button');
    cancelBtn.className = 'note-cancel-btn';
    cancelBtn.textContent = 'Annulla';
    cancelBtn.addEventListener('click', () => popup.remove());

    const saveBtn = document.createElement('button');
    saveBtn.className = 'note-save-btn';
    saveBtn.textContent = 'Salva';
    saveBtn.addEventListener('click', () => {
      onSave(textarea.value);
      popup.remove();
    });

    actions.appendChild(cancelBtn);
    actions.appendChild(saveBtn);
    popup.appendChild(textarea);
    popup.appendChild(actions);
    container.appendChild(popup);

    textarea.focus();

    // Close on Escape
    textarea.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') popup.remove();
      if (e.key === 'Enter' && e.ctrlKey) {
        onSave(textarea.value);
        popup.remove();
      }
    });
  }

  destroy(): void {
    this.svg.innerHTML = '';
    this.isDrawing = false;
    this.tempPath = null;
    this.tempRect = null;
  }
}
