/**
 * pdfiuh Sidebar — Fluent Design Custom Element
 * Tabbed sidebar: Table of Contents + Thumbnails
 */
import { store } from '../../state/store';
import { bus } from '../../core/event-bus';
import viewerCSS from '../styles/viewer.css?raw';

const ICONS = {
  toc: `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"><path d="M4 3h10M4 6.5h8M4 10h10M4 13.5h6"/><circle cx="1.5" cy="3" r="0.8" fill="currentColor" stroke="none"/><circle cx="1.5" cy="6.5" r="0.8" fill="currentColor" stroke="none"/><circle cx="1.5" cy="10" r="0.8" fill="currentColor" stroke="none"/><circle cx="1.5" cy="13.5" r="0.8" fill="currentColor" stroke="none"/></svg>`,
  thumbs: `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.3"><rect x="2" y="1" width="5" height="6" rx="0.5"/><rect x="9" y="1" width="5" height="6" rx="0.5"/><rect x="2" y="9" width="5" height="6" rx="0.5"/><rect x="9" y="9" width="5" height="6" rx="0.5"/></svg>`,
};

interface OutlineItem {
  title: string;
  page: number;
  items?: OutlineItem[];
}

class PDFiuhSidebar extends HTMLElement {
  private root: ShadowRoot;
  private outline: OutlineItem[] = [];
  private worker: Worker | null = null;
  private thumbnailCanvases = new Map<number, HTMLCanvasElement>();
  private thumbnailsRequested = new Set<number>();

  constructor() {
    super();
    this.root = this.attachShadow({ mode: 'open' });
  }

  connectedCallback(): void {
    this.build();
    this.bindStore();
  }

  setWorker(worker: Worker): void {
    this.worker = worker;
  }

  updateToC(outline: OutlineItem[]): void {
    this.outline = outline;
    if (store.get('sidebarTab') === 'toc') {
      this.renderToCContent();
    }
  }

  private build(): void {
    const style = document.createElement('style');
    style.textContent = viewerCSS;
    this.root.appendChild(style);

    const container = document.createElement('div');
    container.style.cssText = 'display:flex;flex-direction:column;height:100%;overflow:hidden;';

    const activeTab = store.get('sidebarTab');
    container.innerHTML = `
      <div class="sidebar-tabs">
        <button class="sidebar-tab${activeTab === 'toc' ? ' active' : ''}" data-tab="toc" title="Indice">
          ${ICONS.toc}
          <span>Indice</span>
        </button>
        <button class="sidebar-tab${activeTab === 'thumbnails' ? ' active' : ''}" data-tab="thumbnails" title="Miniature">
          ${ICONS.thumbs}
          <span>Pagine</span>
        </button>
      </div>
      <div class="sidebar-content" id="sidebar-content"></div>
    `;

    this.root.appendChild(container);

    // Tab clicks
    container.querySelectorAll('.sidebar-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        const t = (tab as HTMLElement).dataset.tab as 'toc' | 'thumbnails';
        store.set('sidebarTab', t);
      });
    });

    this.renderTabContent(activeTab);
  }

  private bindStore(): void {
    store.subscribe('sidebarTab', (tab) => {
      this.root.querySelectorAll('.sidebar-tab').forEach(t => {
        (t as HTMLElement).classList.toggle('active', (t as HTMLElement).dataset.tab === tab);
      });
      this.renderTabContent(tab);
    });

    store.subscribe('sidebarOpen', (open) => {
      if (open) {
        this.removeAttribute('collapsed');
      } else {
        this.setAttribute('collapsed', '');
      }
    });

    store.subscribe('currentPage', (page) => {
      // Update thumbnail active state
      this.root.querySelectorAll('.thumb-item').forEach(t => {
        const p = parseInt((t as HTMLElement).dataset.page || '0');
        (t as HTMLElement).classList.toggle('active', p === page);
      });
    });

    store.subscribe('totalPages', () => {
      if (store.get('sidebarTab') === 'thumbnails') {
        this.renderThumbnailContent();
      }
    });
  }

  private renderTabContent(tab: string): void {
    if (tab === 'toc') {
      this.renderToCContent();
    } else {
      this.renderThumbnailContent();
    }
  }

  private renderToCContent(): void {
    const content = this.root.getElementById('sidebar-content');
    if (!content) return;

    if (!this.outline || this.outline.length === 0) {
      content.innerHTML = '<div class="toc-empty">Nessun indice disponibile</div>';
      return;
    }

    content.innerHTML = '';
    this.renderOutlineItems(content, this.outline, 0);
  }

  private renderOutlineItems(parent: HTMLElement, items: OutlineItem[], level: number): void {
    for (const item of items) {
      const btn = document.createElement('button');
      btn.className = `toc-item${level > 0 ? ` level-${Math.min(level, 2)}` : ''}`;
      btn.textContent = item.title;
      btn.title = item.title;
      btn.addEventListener('click', () => {
        if (item.page > 0) {
          bus.publish('go-to-page', item.page);
        }
      });
      parent.appendChild(btn);

      if (item.items && item.items.length > 0) {
        this.renderOutlineItems(parent, item.items, level + 1);
      }
    }
  }

  private renderThumbnailContent(): void {
    const content = this.root.getElementById('sidebar-content');
    if (!content) return;

    const totalPages = store.get('totalPages');
    if (totalPages === 0) {
      content.innerHTML = '<div class="toc-empty">Nessun documento aperto</div>';
      return;
    }

    const profile = store.get('deviceProfile');
    if (profile === 'low') {
      content.innerHTML = '<div class="toc-empty">Miniature disabilitate per risparmiare memoria</div>';
      return;
    }

    content.innerHTML = '';
    const grid = document.createElement('div');
    grid.className = 'thumb-grid';

    const currentPage = store.get('currentPage');

    for (let i = 1; i <= totalPages; i++) {
      const item = document.createElement('div');
      item.className = `thumb-item${i === currentPage ? ' active' : ''}`;
      item.dataset.page = i.toString();

      const canvas = document.createElement('canvas');
      canvas.width = 120;
      canvas.height = 170;
      canvas.style.width = '120px';
      canvas.style.height = '170px';

      const label = document.createElement('div');
      label.className = 'thumb-label';
      label.textContent = i.toString();

      item.appendChild(canvas);
      item.appendChild(label);
      grid.appendChild(item);

      item.addEventListener('click', () => {
        bus.publish('go-to-page', i);
      });

      this.thumbnailCanvases.set(i, canvas);
    }

    content.appendChild(grid);

    // Request thumbnails with IntersectionObserver
    this.setupThumbnailObserver(content);
  }

  private setupThumbnailObserver(scrollContainer: HTMLElement): void {
    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          const page = parseInt((entry.target as HTMLElement).dataset.page || '0');
          if (page > 0 && !this.thumbnailsRequested.has(page)) {
            this.thumbnailsRequested.add(page);
            this.requestThumbnail(page);
          }
        }
      }
    }, { root: scrollContainer, rootMargin: '200px 0px' });

    this.root.querySelectorAll('.thumb-item').forEach(item => observer.observe(item));
  }

  private requestThumbnail(pageNumber: number): void {
    if (!this.worker) return;
    this.worker.postMessage({
      type: 'RENDER_THUMBNAIL',
      payload: { pageNumber },
    });
  }

  handleThumbnailRendered(pageNumber: number, bitmap: ImageBitmap, _width: number, _height: number): void {
    const canvas = this.thumbnailCanvases.get(pageNumber);
    if (!canvas) return;

    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    canvas.style.width = '120px';
    canvas.style.height = `${Math.round(120 * (bitmap.height / bitmap.width))}px`;

    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.drawImage(bitmap, 0, 0);
    }
    bitmap.close();
  }
}

customElements.define('pdfiuh-sidebar', PDFiuhSidebar);
export default PDFiuhSidebar;
