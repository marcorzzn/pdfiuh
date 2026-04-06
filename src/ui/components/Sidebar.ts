class PDFiuhSidebar extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  connectedCallback() {
    this.render();
  }

  render() {
    this.shadowRoot!.innerHTML = `
      <style>
        :host {
          display: block;
          width: 250px;
          height: 100%;
          background: var(--surface-color);
          border-right: 1px solid var(--border);
          color: var(--text-main);
          font-family: system-ui, sans-serif;
          transition: transform 0.3s ease;
          overflow-y: auto;
        }
        .header {
          padding: 16px;
          font-weight: bold;
          font-size: 14px;
          border-bottom: 1px solid var(--border);
          text-transform: uppercase;
          color: var(--text-dim);
        }
        .toc-list {
          list-style: none;
          padding: 0;
          margin: 0;
        }
        .toc-item {
          padding: 8px 16px;
          font-size: 13px;
          cursor: pointer;
          border-bottom: 1px solid rgba(0,0,0,0.1);
          transition: background 0.2s;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .toc-item:hover {
          background: var(--border);
        }
      </style>
      <div class="header">Indice</div>
      <ul class="toc-list" id="toc-list">
        <li class="toc-item" style="color: var(--text-dim)">Nessun indice disponibile</li>
      </ul>
    `;
  }

  updateToC(bookmarks: any[]) {
    const list = this.shadowRoot!.getElementById('toc-list');
    if (!list) return;

    if (bookmarks.length === 0) return;

    list.innerHTML = bookmarks.map(b => `
      <li class="toc-item" data-page="${b.page}">${b.title}</li>
    `).join('');

    list.querySelectorAll('.toc-item').forEach(item => {
      item.addEventListener('click', () => {
        const page = parseInt((item as HTMLElement).dataset.page!);
        // Pubblica l'evento per saltare alla pagina
        // bus.publish('go-to-page', page);
      });
    });
  }
}

customElements.define('pdfiuh-sidebar', PDFiuhSidebar);
export default PDFiuhSidebar;
