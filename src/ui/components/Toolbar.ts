import { bus } from '../../core/event-bus';

export type Tool = 'select' | 'highlight' | 'draw' | 'text' | 'note' | 'eraser';

class PDFiuhToolbar extends HTMLElement {
  private activeTool: Tool = 'select';
  private zoom: number = 1.0;
  private pageCount: number = 0;
  private currentPage: number = 1;

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

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

  private updateActiveState() {
    this.shadowRoot!.querySelectorAll('.tool-btn').forEach(btn => {
      const btnTool = btn.getAttribute('data-tool');
      (btn as HTMLElement).classList.toggle('active', btnTool === this.activeTool);
    });
  }

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
    `;

    // Tool listeners
    this.shadowRoot!.querySelectorAll('.tool-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        this.setTool((btn.getAttribute('data-tool') as Tool));
      });
    });

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
    });
  }
}

customElements.define('pdfiuh-toolbar', PDFiuhToolbar);
export default PDFiuhToolbar;
