import { bus } from '../../core/event-bus';

export type Tool = 'select' | 'ink' | 'highlight' | 'text' | 'erase';

class PDFiuhToolbar extends HTMLElement {
  private activeTool: Tool = 'select';

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  connectedCallback() {
    this.render();
  }

  private setTool(tool: Tool) {
    this.activeTool = tool;
    bus.publish('tool-change', tool);
    this.updateActiveState();
  }

  private updateActiveState() {
    this.shadowRoot!.querySelectorAll('.tool-btn').forEach(btn => {
      const btnTool = btn.getAttribute('data-tool');
      (btn as HTMLElement).classList.toggle('active', btnTool === this.activeTool);
    });
  }

  private handleZoom(delta: number) {
    bus.publish('zoom-change', delta);
  }

  private handleFit(type: 'width' | 'page') {
    bus.publish('fit-change', type);
  }

  private handleRotate() {
    bus.publish('rotate-change');
  }

  render() {
    this.shadowRoot!.innerHTML = `
      <style>
        :host {
          display: block;
          height: 48px;
          background: var(--surface-color);
          border-bottom: 1px solid var(--border);
          display: flex;
          align-items: center;
          padding: 0 16px;
          color: var(--text-main);
          font-family: system-ui, sans-serif;
          user-select: none;
        }
        .controls {
          display: flex;
          gap: 8px;
          align-items: center;
        }
        button {
          background: transparent;
          border: 1px solid var(--border);
          color: var(--text-main);
          padding: 4px 8px;
          cursor: pointer;
          border-radius: 4px;
          font-size: 12px;
          transition: all 0.2s;
        }
        button:hover {
          background: var(--border);
        }
        button.active {
          background: var(--accent);
          color: white;
          border-color: var(--accent);
        }
        .separator {
          width: 1px;
          height: 20px;
          background: var(--border);
          margin: 0 8px;
        }
        .zoom-level {
          font-size: 12px;
          min-width: 40px;
          text-align: center;
        }
      </style>
      <div class="controls">
        <!-- Tool Selection -->
        <button class="tool-btn active" data-tool="select">Select</button>
        <button class="tool-btn" data-tool="ink">🖊️ Ink</button>
        <button class="tool-btn" data-tool="highlight">🖍️ High</button>
        <button class="tool-btn" data-tool="text">T Text</button>
        <button class="tool-btn" data-tool="erase">🧽 Erase</button>

        <div class="separator"></div>

        <!-- Zoom Controls -->
        <button id="btn-zoom-out">−</button>
        <span class="zoom-level" id="zoom-val">100%</span>
        <button id="btn-zoom-in">+</button>

        <div class="separator"></div>

        <button id="btn-fit-width">Fit Width</button>
        <button id="btn-fit-page">Fit Page</button>
        <div class="separator"></div>
        <button id="btn-rotate">Rotate ↻</button>
      </div>
    `;

    // Tool listeners
    this.shadowRoot!.querySelectorAll('.tool-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        this.setTool((btn.getAttribute('data-tool') as Tool));
      });
    });

    this.shadowRoot!.getElementById('btn-zoom-out')?.addEventListener('click', () => this.handleZoom(-0.1));
    this.shadowRoot!.getElementById('btn-zoom-in')?.addEventListener('click', () => this.handleZoom(0.1));
    this.shadowRoot!.getElementById('btn-fit-width')?.addEventListener('click', () => this.handleFit('width'));
    this.shadowRoot!.getElementById('btn-fit-page')?.addEventListener('click', () => this.handleFit('page'));
    this.shadowRoot!.getElementById('btn-rotate')?.addEventListener('click', () => this.handleRotate());

    bus.subscribe('zoom-updated', (val) => {
      const el = this.shadowRoot!.getElementById('zoom-val');
      if (el) el.innerText = `${Math.round(val * 100)}%`;
    });
  }
}

customElements.define('pdfiuh-toolbar', PDFiuhToolbar);
export default PDFiuhToolbar;
