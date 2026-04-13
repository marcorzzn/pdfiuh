/**
 * pdfiuh Toolbar — Fluent Design Custom Element
 * Edge-like toolbar with SVG icons and Fluent Design tokens.
 */
import { store } from '../../state/store';
import { bus } from '../../core/event-bus';
import toolbarCSS from '../styles/toolbar.css?raw';

<<<<<<< HEAD
export type Tool = 'select' | 'highlight' | 'draw' | 'text' | 'note' | 'eraser';

class PDFiuhToolbar extends HTMLElement {
  private activeTool: Tool = 'select';
  private zoom: number = 1.0;
  private pageCount: number = 0;
  private currentPage: number = 1;
=======
export type Tool = 'select' | 'highlight' | 'ink' | 'note' | 'eraser';

/* ========== SVG ICONS (16×16 Fluent-style) ========== */
const ICONS = {
  open: `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"><path d="M2 13V3a1 1 0 011-1h4l2 2h4a1 1 0 011 1v8a1 1 0 01-1 1H3a1 1 0 01-1-1z"/></svg>`,
  save: `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"><path d="M12.7 14H3.3A1.3 1.3 0 012 12.7V3.3A1.3 1.3 0 013.3 2h7l2.7 2.7v8A1.3 1.3 0 0112.7 14z"/><path d="M11.3 14V9.3H4.7V14"/><path d="M4.7 2v3.3h5.3"/></svg>`,
  select: `<svg viewBox="0 0 16 16" fill="currentColor"><path d="M3.3 1.5l9 6.5H7.5l3.2 5.5-1.7 1-3.2-5.5L3.3 12V1.5z"/></svg>`,
  highlight: `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.3"><rect x="3" y="3" width="10" height="10" rx="1" fill="currentColor" opacity="0.2"/><path d="M6 8h4M6 10.5h4M6 5.5h4"/></svg>`,
  ink: `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"><path d="M10.5 2.5l3 3-8.5 8.5H2v-3l8.5-8.5z"/><path d="M9 4l3 3"/></svg>`,
  note: `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="2" width="12" height="12" rx="2"/><path d="M5 5h6M5 8h6M5 11h3"/></svg>`,
  eraser: `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"><path d="M7.5 2.5l6 6-5 5H4l-2-2 5.5-9z"/><path d="M6 14h8"/><path d="M4 12l6-6"/></svg>`,
  zoomIn: `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"><circle cx="7" cy="7" r="5"/><path d="M11 11l3 3"/><path d="M5 7h4M7 5v4"/></svg>`,
  zoomOut: `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"><circle cx="7" cy="7" r="5"/><path d="M11 11l3 3"/><path d="M5 7h4"/></svg>`,
  fitWidth: `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"><path d="M2 4h12M2 12h12"/><path d="M4 8H1M12 8h3"/><path d="M3 6l-2 2 2 2M13 6l2 2-2 2"/></svg>`,
  fitPage: `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"><rect x="3" y="1" width="10" height="14" rx="1"/><path d="M6 5h4M6 8h4"/></svg>`,
  rotate: `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"><path d="M1 8a7 7 0 0113.6-2.3"/><path d="M15 8a7 7 0 01-13.6 2.3"/><path d="M14 1v5h-5"/></svg>`,
  search: `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"><circle cx="7" cy="7" r="5"/><path d="M11 11l3.5 3.5"/></svg>`,
  sidebar: `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.3"><rect x="1" y="2" width="14" height="12" rx="1"/><path d="M5.5 2v12"/></svg>`,
  sun: `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"><circle cx="8" cy="8" r="3"/><path d="M8 1v2M8 13v2M1 8h2M13 8h2M3.2 3.2l1.4 1.4M11.4 11.4l1.4 1.4M3.2 12.8l1.4-1.4M11.4 4.6l1.4-1.4"/></svg>`,
  moon: `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"><path d="M14 10A7 7 0 116 2a5.5 5.5 0 008 8z"/></svg>`,
  download: `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"><path d="M8 2v9M5 8l3 3 3-3"/><path d="M2 12v1a1 1 0 001 1h10a1 1 0 001-1v-1"/></svg>`,
  print: `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"><path d="M4 5V1h8v4"/><rect x="2" y="5" width="12" height="6" rx="1"/><path d="M4 11v4h8v-4"/></svg>`,
  prevPage: `<svg viewBox="0 0 16 16" fill="currentColor"><path d="M10.3 3.3L5.6 8l4.7 4.7-1 1L3.5 8l5.8-5.7z"/></svg>`,
  nextPage: `<svg viewBox="0 0 16 16" fill="currentColor"><path d="M5.7 3.3l1-1L12.5 8l-5.8 5.7-1-1L10.4 8z"/></svg>`,
} as const;

const COLORS = [
  { name: 'Giallo', value: '#FFEB3B' },
  { name: 'Verde', value: '#4CAF50' },
  { name: 'Blu', value: '#2196F3' },
  { name: 'Rosa', value: '#E91E63' },
  { name: 'Arancione', value: '#FF9800' },
];

class PDFiuhToolbar extends HTMLElement {
  private root: ShadowRoot;
>>>>>>> 692cdb1 (Refactor: Rifondazione architettura Fluent UI, worker estrazione testo e virtual scrolling)

  constructor() {
    super();
    this.root = this.attachShadow({ mode: 'open' });
  }

<<<<<<< HEAD
  connectedCallback() {
    this.render();

    bus.subscribe('pdf-info', (info: any) => {
        this.pageCount = info.pageCount;
        const pageCountEl = this.shadowRoot!.getElementById('pageCount');
        if (pageCountEl) pageCountEl.textContent = this.pageCount.toString();
        const pageInput = this.shadowRoot!.getElementById('pageNumber') as HTMLInputElement;
        if (pageInput) {
            pageInput.max = this.pageCount.toString();
            pageInput.value = '1';
        }
    });

    bus.subscribe('page-changed', (pageNum: number) => {
        this.currentPage = pageNum;
        const pageInput = this.shadowRoot!.getElementById('pageNumber') as HTMLInputElement;
        if (pageInput && pageInput.value !== pageNum.toString()) {
            pageInput.value = pageNum.toString();
        }
    });
  }

  private setTool(tool: Tool) {
    this.activeTool = tool;
    bus.publish('tool-change', tool);
    this.updateActiveState();

    const toolOptions = this.shadowRoot!.getElementById('toolOptions');
    if (toolOptions) {
        if (['highlight', 'draw', 'text'].includes(tool)) {
            toolOptions.style.display = 'flex';
        } else {
            toolOptions.style.display = 'none';
        }
    }
  }
=======
  connectedCallback(): void {
    this.build();
    this.bindStore();
    this.bindKeys();
  }

  private build(): void {
    const style = document.createElement('style');
    style.textContent = toolbarCSS;
    this.root.appendChild(style);
>>>>>>> 692cdb1 (Refactor: Rifondazione architettura Fluent UI, worker estrazione testo e virtual scrolling)

    const tool = store.get('activeTool');
    const color = store.get('activeColor');
    const zoom = store.get('zoom');

<<<<<<< HEAD
  private handleZoom(delta: number) {
    const newZoom = Math.max(0.25, Math.min(3.0, this.zoom + delta));
    this.setZoom(newZoom);
  }

  private setZoom(newZoom: number) {
    this.zoom = newZoom;
    bus.publish('zoom-change', this.zoom);
    const slider = this.shadowRoot!.getElementById('zoomSlider') as HTMLInputElement;
    if (slider) slider.value = (this.zoom * 100).toString();
    const val = this.shadowRoot!.getElementById('zoomValue');
    if (val) val.textContent = `${Math.round(this.zoom * 100)}%`;
  }

  private handleFit() {
    bus.publish('fit-change', 'page');
  }

  private handleRotate(degrees: number) {
    bus.publish('rotate-change', degrees);
  }

  private handleFileInput() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.pdf';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        const arrayBuffer = await file.arrayBuffer();
        bus.publish('pdf-file-loaded', { file, arrayBuffer });
      }
    };
    input.click();
  }

  render() {
    this.shadowRoot!.innerHTML = `
      <style>
        :host {
          display: block;
          background: var(--toolbar-bg, #ffffff);
          border-bottom: 1px solid var(--border-color, #e1dfdd);
          padding: 8px 16px;
          display: flex;
          align-items: center;
          gap: 12px;
          flex-wrap: wrap;
          box-shadow: var(--shadow, 0 2px 8px rgba(0,0,0,0.1));
          z-index: 1000;
          color: var(--text-color, #323130);
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
        }

        .toolbar-group {
            display: flex;
            align-items: center;
            gap: 4px;
            padding: 0 8px;
            border-right: 1px solid var(--border-color, #e1dfdd);
        }

        .toolbar-group:last-child {
            border-right: none;
        }

        .btn {
            background: transparent;
            border: 1px solid transparent;
            padding: 6px 12px;
            border-radius: 4px;
            cursor: pointer;
            font-size: 14px;
            color: var(--text-color, #323130);
            display: flex;
            align-items: center;
            gap: 6px;
            transition: all 0.2s;
            white-space: nowrap;
        }

        .btn:hover {
            background: var(--hover-bg, #f3f2f1);
            border-color: var(--border-color, #e1dfdd);
        }

        .btn.active {
            background: var(--primary-color, #0078d4);
            color: white;
        }

        .btn-icon {
            width: 28px;
            height: 28px;
            padding: 4px;
            justify-content: center;
        }

        /* Page info */
        .page-info {
            display: flex;
            align-items: center;
            gap: 8px;
            font-size: 14px;
        }

        .page-input {
            width: 50px;
            padding: 4px;
            border: 1px solid var(--border-color, #e1dfdd);
            border-radius: 4px;
            text-align: center;
            background: var(--toolbar-bg, #ffffff);
            color: var(--text-color, #323130);
        }

        /* Dropdown */
        .dropdown {
            position: relative;
        }

        .dropdown-content {
            display: none;
            position: absolute;
            background: var(--toolbar-bg, #ffffff);
            min-width: 200px;
            box-shadow: var(--shadow, 0 2px 8px rgba(0,0,0,0.1));
            border-radius: 4px;
            z-index: 1001;
            margin-top: 4px;
            border: 1px solid var(--border-color, #e1dfdd);
        }

        .dropdown-content.show {
            display: block;
        }

        .dropdown-item {
            padding: 10px 16px;
            cursor: pointer;
            display: flex;
            align-items: center;
            gap: 8px;
        }

        .dropdown-item:hover {
            background: var(--hover-bg, #f3f2f1);
        }

        /* Tool options */
        .tool-options {
            display: flex;
            align-items: center;
            gap: 8px;
            padding: 4px 8px;
            background: var(--hover-bg, #f3f2f1);
            border-radius: 4px;
        }

        .color-picker {
            display: flex;
            gap: 4px;
            padding: 0 8px;
        }

        .color-option {
            width: 20px;
            height: 20px;
            border-radius: 50%;
            cursor: pointer;
            border: 2px solid transparent;
            transition: transform 0.2s;
        }

        .color-option:hover {
            transform: scale(1.1);
        }

        .color-option.active {
            border-color: var(--text-color, #323130);
        }

        /* Zoom slider */
        .zoom-slider {
            display: flex;
            align-items: center;
            gap: 8px;
        }
      </style>

      <!-- File -->
        <div class="toolbar-group">
            <button class="btn btn-icon" id="openFile" title="Apri file">📂</button>
            <button class="btn btn-icon" id="savePdf" title="Salva">💾</button>
        </div>

        <!-- Navigation -->
        <div class="toolbar-group">
            <button class="btn btn-icon" id="prevPage" title="Pagina precedente">←</button>
            <div class="page-info">
                <input type="number" class="page-input" id="pageNumber" min="1" value="1">
                <span>di <span id="pageCount">0</span></span>
            </div>
            <button class="btn btn-icon" id="nextPage" title="Pagina successiva">→</button>
        </div>

        <!-- Zoom -->
        <div class="toolbar-group">
            <button class="btn btn-icon" id="zoomOut" title="Zoom out">−</button>
            <div class="zoom-slider">
                <input type="range" id="zoomSlider" min="25" max="200" value="100">
                <span id="zoomValue">100%</span>
            </div>
            <button class="btn btn-icon" id="zoomIn" title="Zoom in">+</button>
            <button class="btn btn-icon" id="zoomFit" title="Adatta">⛶</button>
        </div>

        <!-- View -->
        <div class="toolbar-group">
            <button class="btn btn-icon" id="toggleSidebar" title="Miniature">☰</button>
            <button class="btn btn-icon" id="rotateLeft" title="Ruota sinistra">↺</button>
            <button class="btn btn-icon" id="rotateRight" title="Ruota destra">↻</button>
        </div>


        <!-- Tools -->
        <div class="toolbar-group">
            <button class="btn btn-icon" id="searchBtn" title="Cerca">🔍</button>
            <button class="btn btn-icon" id="readAloudBtn" title="Leggi ad alta voce">🔊</button>
        </div>

        <!-- Annotations -->
        <div class="toolbar-group">
            <button class="btn btn-icon tool-btn active" data-tool="select" title="Selezione">👆</button>
            <button class="btn btn-icon tool-btn" data-tool="highlight" title="Evidenzia">🖍️</button>
            <button class="btn btn-icon tool-btn" data-tool="draw" title="Disegna">✏️</button>
            <button class="btn btn-icon tool-btn" data-tool="text" title="Testo">T</button>
            <button class="btn btn-icon tool-btn" data-tool="note" title="Nota adesiva">📝</button>
            <button class="btn btn-icon tool-btn" data-tool="eraser" title="Gomma">🧹</button>

            <div class="tool-options" id="toolOptions" style="display: none;">
                <div class="color-picker" id="colorPicker">
                    <div class="color-option active" style="background: #ffff00" data-color="#ffff00"></div>
                    <div class="color-option" style="background: #00ff00" data-color="#00ff00"></div>
                    <div class="color-option" style="background: #ff0000" data-color="#ff0000"></div>
                    <div class="color-option" style="background: #0000ff" data-color="#0000ff"></div>
                    <div class="color-option" style="background: #ff6600" data-color="#ff6600"></div>
                </div>
                <input type="range" id="brushSize" min="1" max="20" value="3" title="Dimensione pennello">
            </div>
        </div>

        <!-- More -->
        <div class="toolbar-group">
            <button class="btn btn-icon" id="themeToggle" title="Tema scuro">🌙</button>
            <button class="btn btn-icon" id="clearAnnotations" title="Rimuovi annotazioni">🗑️</button>
        </div>
=======
    this.root.appendChild(style);

    const bar = document.createElement('div');
    bar.style.cssText = 'display:flex;align-items:center;width:100%;gap:2px;';
    bar.innerHTML = `
      <!-- File actions -->
      <div class="tb-group">
        ${this.btn('open', ICONS.open, 'Apri PDF', 'open')}
      </div>
      <div class="tb-sep"></div>

      <!-- Navigation -->
      <div class="tb-group">
        ${this.btn('prev-page', ICONS.prevPage, 'Pagina precedente', 'prev', true)}
        <input class="page-input" id="page-input" type="text" value="1" title="Vai a pagina">
        <span class="page-total" id="page-total">/ 0</span>
        ${this.btn('next-page', ICONS.nextPage, 'Pagina successiva', 'next', true)}
      </div>
      <div class="tb-sep"></div>

      <!-- Zoom -->
      <div class="tb-group">
        ${this.btn('zoom-out', ICONS.zoomOut, 'Riduci zoom', 'zoomOut', true)}
        <span class="zoom-display" id="zoom-display">${Math.round(zoom * 100)}%</span>
        ${this.btn('zoom-in', ICONS.zoomIn, 'Aumenta zoom', 'zoomIn', true)}
        ${this.btn('fit-width', ICONS.fitWidth, 'Adatta larghezza', 'fitWidth', true)}
        ${this.btn('fit-page', ICONS.fitPage, 'Adatta pagina', 'fitPage', true)}
      </div>
      <div class="tb-sep"></div>

      <!-- Tools -->
      <div class="tb-group">
        ${this.btn('tool-select', ICONS.select, 'Seleziona', 'select', true, tool === 'select')}
        ${this.btn('tool-highlight', ICONS.highlight, 'Evidenzia', 'highlight', true, tool === 'highlight')}
        ${this.btn('tool-ink', ICONS.ink, 'Disegno', 'ink', true, tool === 'ink')}
        ${this.btn('tool-note', ICONS.note, 'Nota', 'note', true, tool === 'note')}
        ${this.btn('tool-eraser', ICONS.eraser, 'Gomma', 'eraser', true, tool === 'eraser')}
      </div>

      <!-- Color strip (visible when annotation tool active) -->
      <div class="color-strip" id="color-strip" style="display:${tool !== 'select' ? 'flex' : 'none'}">
        ${COLORS.map(c => `<div class="color-dot${c.value === color ? ' active' : ''}" data-color="${c.value}" title="${c.name}" style="background:${c.value}"></div>`).join('')}
      </div>

      <div class="tb-spacer"></div>

      <!-- File name -->
      <span class="tb-title" id="tb-title"></span>

      <!-- Right actions -->
      <div class="tb-group">
        ${this.btn('search', ICONS.search, 'Cerca (Ctrl+F)', 'search', true)}
        ${this.btn('rotate', ICONS.rotate, 'Ruota', 'rotate', true)}
        ${this.btn('sidebar-toggle', ICONS.sidebar, 'Pannello laterale', 'sidebarToggle', true)}
        <div class="tb-sep"></div>
        ${this.btn('download', ICONS.download, 'Esporta PDF', 'download', true)}
        ${this.btn('print', ICONS.print, 'Stampa', 'printDoc', true)}
        <div class="tb-sep"></div>
        ${this.btn('theme-toggle', store.get('theme') === 'dark' ? ICONS.sun : ICONS.moon, 'Tema', 'themeToggle', true)}
      </div>
>>>>>>> 692cdb1 (Refactor: Rifondazione architettura Fluent UI, worker estrazione testo e virtual scrolling)
    `;

    this.root.appendChild(bar);
    this.bindClicks(bar);
  }

  private btn(id: string, icon: string, title: string, action: string, iconOnly = false, active = false): string {
    return `<button class="tb-btn${iconOnly ? ' icon-only' : ''}${active ? ' active' : ''}" data-action="${action}" id="tb-${id}" title="${title}">${icon}${!iconOnly ? `<span class="btn-label">${title}</span>` : ''}</button>`;
  }

  private bindClicks(bar: HTMLElement): void {
    bar.addEventListener('click', (e) => {
      const btn = (e.target as HTMLElement).closest('[data-action]') as HTMLElement | null;
      if (!btn) return;
      const action = btn.dataset.action;

      switch (action) {
        case 'open': bus.publish('open-file'); break;
        case 'prev': {
          const cp = store.get('currentPage');
          if (cp > 1) bus.publish('go-to-page', cp - 1);
          break;
        }
        case 'next': {
          const cp = store.get('currentPage');
          if (cp < store.get('totalPages')) bus.publish('go-to-page', cp + 1);
          break;
        }
        case 'zoomIn': store.set('zoom', Math.min(4.0, +(store.get('zoom') + 0.25).toFixed(2))); break;
        case 'zoomOut': store.set('zoom', Math.max(0.25, +(store.get('zoom') - 0.25).toFixed(2))); break;
        case 'fitWidth': bus.publish('fit-width'); break;
        case 'fitPage': bus.publish('fit-page'); break;
        case 'select':
        case 'highlight':
        case 'ink':
        case 'note':
        case 'eraser':
          store.set('activeTool', action as Tool);
          break;
        case 'search': store.set('findBarOpen', !store.get('findBarOpen')); break;
        case 'rotate': store.set('rotation', (store.get('rotation') + 90) % 360); break;
        case 'sidebarToggle': store.set('sidebarOpen', !store.get('sidebarOpen')); break;
        case 'download': bus.publish('export-pdf'); break;
        case 'printDoc': bus.publish('print-doc'); break;
        case 'themeToggle': {
          const next = store.get('theme') === 'dark' ? 'light' : 'dark';
          store.set('theme', next);
          break;
        }
      }
    });

    // Color dots
    bar.querySelectorAll('.color-dot').forEach(dot => {
      dot.addEventListener('click', () => {
        const c = (dot as HTMLElement).dataset.color!;
        store.set('activeColor', c);
      });
    });

<<<<<<< HEAD
    this.shadowRoot!.querySelectorAll('.color-option').forEach(opt => {
        opt.addEventListener('click', (e) => {
            this.shadowRoot!.querySelectorAll('.color-option').forEach(o => o.classList.remove('active'));
            const target = e.target as HTMLElement;
            target.classList.add('active');
            bus.publish('color-change', target.getAttribute('data-color'));
        });
    });

    this.shadowRoot!.getElementById('brushSize')?.addEventListener('input', (e) => {
        bus.publish('brush-size-change', parseInt((e.target as HTMLInputElement).value));
    });

    this.shadowRoot!.getElementById('openFile')?.addEventListener('click', () => this.handleFileInput());

    this.shadowRoot!.getElementById('zoomOut')?.addEventListener('click', () => this.handleZoom(-0.1));
    this.shadowRoot!.getElementById('zoomIn')?.addEventListener('click', () => this.handleZoom(0.1));
    this.shadowRoot!.getElementById('zoomSlider')?.addEventListener('input', (e) => {
        this.setZoom(parseInt((e.target as HTMLInputElement).value) / 100);
    });
    this.shadowRoot!.getElementById('zoomFit')?.addEventListener('click', () => this.handleFit());

    this.shadowRoot!.getElementById('rotateLeft')?.addEventListener('click', () => this.handleRotate(-90));
    this.shadowRoot!.getElementById('rotateRight')?.addEventListener('click', () => this.handleRotate(90));
    this.shadowRoot!.getElementById('searchBtn')?.addEventListener('click', () => bus.publish('toggle-search'));
    this.shadowRoot!.getElementById('readAloudBtn')?.addEventListener('click', () => bus.publish('read-aloud'));

    this.shadowRoot!.getElementById('toggleSidebar')?.addEventListener('click', () => bus.publish('toggle-sidebar'));

    this.shadowRoot!.getElementById('prevPage')?.addEventListener('click', () => bus.publish('navigate-page', -1));
    this.shadowRoot!.getElementById('nextPage')?.addEventListener('click', () => bus.publish('navigate-page', 1));
    this.shadowRoot!.getElementById('pageNumber')?.addEventListener('change', (e) => {
        bus.publish('goto-page', parseInt((e.target as HTMLInputElement).value));
    });

    this.shadowRoot!.getElementById('themeToggle')?.addEventListener('click', () => {
        const body = document.body;
        const isDark = body.getAttribute('data-theme') === 'dark';
        body.setAttribute('data-theme', isDark ? 'light' : 'dark');
        const btn = this.shadowRoot!.getElementById('themeToggle');
        if (btn) btn.textContent = isDark ? '🌙' : '☀️';
    });

    this.shadowRoot!.getElementById('clearAnnotations')?.addEventListener('click', () => {
        if (confirm('Sei sicuro di voler rimuovere tutte le annotazioni?')) {
            bus.publish('clear-annotations');
        }
    });

    this.shadowRoot!.getElementById('savePdf')?.addEventListener('click', () => {
        bus.publish('save-pdf');
=======
    // Page input
    const pageInput = bar.querySelector('#page-input') as HTMLInputElement;
    if (pageInput) {
      pageInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          const num = parseInt(pageInput.value, 10);
          if (num >= 1 && num <= store.get('totalPages')) {
            bus.publish('go-to-page', num);
          }
        }
      });
    }
  }

  private bindStore(): void {
    store.subscribe('zoom', (z) => {
      const el = this.root.getElementById('zoom-display');
      if (el) el.textContent = `${Math.round(z * 100)}%`;
    });

    store.subscribe('currentPage', (p) => {
      const inp = this.root.getElementById('page-input') as HTMLInputElement | null;
      if (inp && inp !== this.root.activeElement) inp.value = p.toString();
    });

    store.subscribe('totalPages', (t) => {
      const el = this.root.getElementById('page-total');
      if (el) el.textContent = `/ ${t}`;
    });

    store.subscribe('activeTool', (t) => {
      this.root.querySelectorAll('[data-action]').forEach(b => {
        const a = (b as HTMLElement).dataset.action;
        if (['select', 'highlight', 'ink', 'note', 'eraser'].includes(a!)) {
          (b as HTMLElement).classList.toggle('active', a === t);
        }
      });
      const strip = this.root.getElementById('color-strip');
      if (strip) strip.style.display = t !== 'select' ? 'flex' : 'none';
    });

    store.subscribe('activeColor', (c) => {
      this.root.querySelectorAll('.color-dot').forEach(d => {
        (d as HTMLElement).classList.toggle('active', (d as HTMLElement).dataset.color === c);
      });
    });

    store.subscribe('theme', (t) => {
      const btn = this.root.getElementById('tb-theme-toggle');
      if (btn) btn.innerHTML = t === 'dark' ? ICONS.sun : ICONS.moon;
    });

    store.subscribe('fileName', (name) => {
      const el = this.root.getElementById('tb-title');
      if (el) el.textContent = name;
    });
  }

  private bindKeys(): void {
    document.addEventListener('keydown', (e) => {
      if (e.ctrlKey && e.key === 'f') {
        e.preventDefault();
        store.set('findBarOpen', true);
      }
      if (e.ctrlKey && e.key === 'o') {
        e.preventDefault();
        bus.publish('open-file');
      }
      if (e.ctrlKey && e.key === 'p') {
        e.preventDefault();
        bus.publish('print-doc');
      }
      if (e.ctrlKey && e.key === 's') {
        e.preventDefault();
        bus.publish('export-pdf');
      }
      if (e.ctrlKey && (e.key === '=' || e.key === '+')) {
        e.preventDefault();
        store.set('zoom', Math.min(4.0, +(store.get('zoom') + 0.25).toFixed(2)));
      }
      if (e.ctrlKey && e.key === '-') {
        e.preventDefault();
        store.set('zoom', Math.max(0.25, +(store.get('zoom') - 0.25).toFixed(2)));
      }
>>>>>>> 692cdb1 (Refactor: Rifondazione architettura Fluent UI, worker estrazione testo e virtual scrolling)
    });
  }
}

customElements.define('pdfiuh-toolbar', PDFiuhToolbar);
export default PDFiuhToolbar;
