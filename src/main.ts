import './ui/styles.css';
import './ui/components/Toolbar';
import './ui/components/Sidebar';
import './ui/components/Viewer';
import WorkerConstructor from './workers/pdf-renderer.worker?worker';
import { bus } from './core/event-bus';

class PDFiuhApp {
  private worker: Worker | null = null;
  private bootStatus: HTMLElement;
  private bootScreen: HTMLElement;
  private appContainer: HTMLElement;
  private viewerComponent: any;
  private sidebarComponent: any;
  private currentDocId = '';
  private fileName = '';

  constructor() {
    this.bootStatus = document.getElementById('boot-status')!;
    this.bootScreen = document.getElementById('boot-screen')!;
    this.appContainer = document.getElementById('viewer-container')!;

    console.log('[Main] App started. Initializing...');

    this.registerServiceWorker();
    this.initWorker();

    bus.subscribe('pdf-file-loaded', (data: any) => {
        this.handleFileUpload(data.file, data.arrayBuffer);
    });
  }

  private showHomeScreen() {
    console.log('[Main] Showing Home Screen');

    this.bootScreen.innerHTML = `
        <div class="upload-box" id="upload-box">
            <div class="upload-icon">📄</div>
            <div class="upload-text">Trascina un file PDF oppure clicca</div>
            <div class="upload-subtext">Offline-first • Privacy totale • Ultra veloce</div>
            <input type="file" id="file-input" accept=".pdf" style="display: none;">
        </div>
        <div class="spinner"></div>
        <div id="boot-status"></div>
    `;
    this.bootStatus = this.bootScreen.querySelector('#boot-status')!;

    const dropZone = this.bootScreen.querySelector('#upload-box') as HTMLElement;
    const fileInput = this.bootScreen.querySelector('#file-input') as HTMLInputElement;

    if (dropZone && fileInput) {
      dropZone.onclick = () => fileInput.click();

      fileInput.onchange = async (e: Event) => {
        const file = (e.target as HTMLInputElement).files?.[0];
        if (file) {
            const arrayBuffer = await file.arrayBuffer();
            this.handleFileUpload(file, arrayBuffer);
        }
      };

      dropZone.ondragover = (e: DragEvent) => {
        e.preventDefault();
        dropZone.classList.add('drag-over');
      };

      dropZone.ondragleave = () => {
        dropZone.classList.remove('drag-over');
      };

      dropZone.ondrop = async (e: DragEvent) => {
        e.preventDefault();
        dropZone.classList.remove('drag-over');
        const file = e.dataTransfer?.files?.[0];
        if (file && file.type === 'application/pdf') {
          const arrayBuffer = await file.arrayBuffer();
          this.handleFileUpload(file, arrayBuffer);
        } else {
          alert('Per favore, carica un file PDF valido.');
        }
      };
    }
  }

  private async handleFileUpload(file: File, arrayBuffer: ArrayBuffer) {
    this.fileName = file.name;
    this.currentDocId = `doc_${Date.now()}`;
    console.log(`[Main] Uploading file: ${file.name} (${file.size} bytes)`);

    this.bootScreen.classList.add('loading');
    this.updateStatus(`Caricamento di ${file.name}...`);

    try {
      const bufferCopy = arrayBuffer.slice(0);
      
      this.worker?.postMessage({
        type: 'LOAD',
        payload: { buffer: bufferCopy }
      }, [bufferCopy]);
    } catch (err) {
      console.error('[Main] Error reading file:', err);
      this.handleCriticalError(`Errore durante la lettura del file: ${err}`);
    }
  }

  private async registerServiceWorker() {
    if ('serviceWorker' in navigator) {
      try {
        await navigator.serviceWorker.register('/pdfiuh/sw.js');
        console.log('[Main] Service Worker registered');
      } catch (err) {
        console.warn('[Main] SW registration failed:', err);
      }
    }
  }

  private initWorker() {
    try {
      this.worker = new WorkerConstructor();
      this.worker.onmessage = (e) => this.handleWorkerMessage(e.data);
      this.worker.onerror = (err) => this.handleCriticalError(err);
      this.showHomeScreen();
    } catch (err) {
      this.handleCriticalError(`Impossibile avviare il Worker: ${err}`);
    }
  }

    private handleWorkerMessage(data: any) {
    const { type } = data;
    console.log(`[Main] Worker Message: ${type}`);

    switch (type) {
      case 'LOADED':
        this.updateStatus('Documento Caricato. Costruzione Interfaccia...');
        this.setupMainUI(data.payload.totalPages, data.payload.outline || []);
        break;

      case 'RENDERED':
        if (data.payload.isThumbnail) {
           bus.publish('thumbnail-rendered', data.payload);
        } else {
           bus.publish('page-rendered', data.payload);
        }
        break;

      case 'TEXT_CONTENT':
        bus.publish('text-content', data.payload);
        break;

      case 'ERROR':
        this.handleCriticalError(data.message || data.payload || 'Errore sconosciuto del worker');
        break;
    }
  }


  private setupMainUI(totalPages: number, outline: any[]) {
    console.log('[Main] Setting up UI...');
    this.appContainer.innerHTML = '';
    this.appContainer.className = 'pdfiuh-app';
    this.appContainer.style.display = 'flex';

    this.appContainer.innerHTML = `
      <pdfiuh-toolbar></pdfiuh-toolbar>

    <!-- Search Panel -->
    <div class="search-panel" id="searchPanel" style="display: none; position: absolute; top: 60px; right: 20px; background: var(--toolbar-bg); border: 1px solid var(--border-color); border-radius: 4px; padding: 16px; box-shadow: var(--shadow); z-index: 100; min-width: 300px;">
        <h3>Cerca nel documento</h3>
        <input type="text" class="search-input" id="searchInput" placeholder="Inserisci testo da cercare..." style="width: 100%; padding: 8px; border: 1px solid var(--border-color); border-radius: 4px; margin-bottom: 8px;">
        <div class="search-results" id="searchResults" style="max-height: 200px; overflow-y: auto;"></div>
    </div>

      <div class="main-container">
        <pdfiuh-sidebar id="main-sidebar"></pdfiuh-sidebar>
        <pdfiuh-viewer id="main-viewer"></pdfiuh-viewer>
      </div>
    `;

    this.sidebarComponent = document.getElementById('main-sidebar');
    if (this.sidebarComponent) {
      this.sidebarComponent.updateToC(outline);
    }

    this.viewerComponent = document.getElementById('main-viewer');
    if (this.viewerComponent) {
      this.viewerComponent.setDocumentInfo(this.currentDocId, totalPages, this.worker);
    }

    bus.publish('pdf-info', { pageCount: totalPages, fileName: this.fileName, worker: this.worker });



    bus.subscribe('toggle-search', () => {
        const panel = document.getElementById('searchPanel');
        if (panel) {
            panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
        }
    });

    const searchInput = document.getElementById('searchInput');
    let pageTexts = new Map<number, string>();
    let searchResults: {page: number, text: string}[] = [];

    bus.subscribe('text-content', (payload: any) => {
        pageTexts.set(payload.pageNumber, payload.text);

        // if currently searching, update results
        const val = (searchInput as HTMLInputElement)?.value;
        if (val) performSearch(val);
    });

    const performSearch = (val: string) => {
        const results = document.getElementById('searchResults');
        if (!results) return;

        results.innerHTML = '';
        let found = false;
        pageTexts.forEach((text, page) => {
            if (text.toLowerCase().includes(val.toLowerCase())) {
                found = true;
                const snippetIdx = text.toLowerCase().indexOf(val.toLowerCase());
                const start = Math.max(0, snippetIdx - 20);
                const end = Math.min(text.length, snippetIdx + val.length + 20);
                const snippet = text.substring(start, end);

                const item = document.createElement('div');
                item.style.cssText = "padding: 8px; cursor: pointer; border-bottom: 1px solid var(--border-color);";
                item.innerHTML = `<strong>Pagina ${page}</strong><br><small>...${snippet}...</small>`;
                item.onclick = () => {
                    bus.publish('goto-page', page);
                    document.getElementById('searchPanel')!.style.display = 'none';
                };
                results.appendChild(item);
            }
        });

        if (!found) {
            results.innerHTML = '<div style="padding: 8px;">Nessun risultato</div>';
        }
    };

    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            const val = (e.target as HTMLInputElement).value;
            if (val && this.worker) {
                // Request text for all pages if not loaded
                for(let i=1; i<=totalPages; i++) {
                    if (!pageTexts.has(i)) {
                        this.worker.postMessage({ type: 'GET_TEXT', payload: { pageNumber: i } });
                    }
                }
                performSearch(val);
            } else {
                const results = document.getElementById('searchResults');
                if (results) results.innerHTML = '';
            }
        });
    }


    let currentPageForRead = 1;
    bus.subscribe('page-changed', (page: number) => {
        currentPageForRead = page;
    });

    bus.subscribe('read-aloud', () => {
        if (this.worker) {
            this.worker.postMessage({ type: 'GET_TEXT', payload: { pageNumber: currentPageForRead } });

            const reader = (payload: any) => {
                if (payload.pageNumber === currentPageForRead) {
                    if (window.speechSynthesis.speaking) {
                        window.speechSynthesis.cancel();
                        return;
                    }
                    const utterance = new SpeechSynthesisUtterance(payload.text);
                    utterance.lang = 'it-IT';
                    window.speechSynthesis.speak(utterance);
                }
            };
            bus.subscribe('text-content', reader);
        }
    });

    this.hideBootScreen();
  }

  private updateStatus(text: string) {
    if (this.bootStatus) {
        this.bootStatus.innerText = text;
    }
  }

  private hideBootScreen() {
    this.bootScreen.classList.add('hidden');
    this.bootScreen.classList.remove('loading');
  }

  private handleCriticalError(err: any) {
    console.error('[CRITICAL ERROR]', err);
    this.updateStatus(`Errore Critico: ${err}`);
  }
}

function startApp() {
  try {
    new PDFiuhApp();
  } catch (err) {
    console.error('App crash during init:', err);
  }
}

if (document.readyState === 'loading') {
  window.addEventListener('DOMContentLoaded', startApp);
} else {
  startApp();
}
