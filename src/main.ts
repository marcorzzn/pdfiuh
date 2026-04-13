import './ui/styles.css';
import './ui/components/Toolbar';
import './ui/components/Sidebar';
import './ui/components/Viewer';
import WorkerConstructor from './engine/pdf-worker?worker';

import { store } from './state/store';
import { bus } from './core/event-bus';
import { detectProfile } from './engine/device-profile';
import { exportPDF } from './annotations/export';
import { storage } from './annotations/storage';

class PDFiuhApp {
  private worker: Worker | null = null;
<<<<<<< HEAD
  private bootStatus: HTMLElement;
  private bootScreen: HTMLElement;
  private appContainer: HTMLElement;
  private viewerComponent: any;
  private sidebarComponent: any;
  private currentDocId = '';
  private fileName = '';
=======
  private bootStatus = document.getElementById('boot-status')!;
  private bootScreen = document.getElementById('boot-screen')!;
  private appContainer = document.getElementById('viewer-container')!;
  private activeFile: File | null = null;
>>>>>>> 692cdb1 (Refactor: Rifondazione architettura Fluent UI, worker estrazione testo e virtual scrolling)

  constructor() {
    this.init();
  }

  private async init() {
    console.log('[Main] App started. Initializing...');

    // 1. Detect hardware profile
    const profile = detectProfile();
    store.set('deviceProfile', profile.tier);
    console.log('[Main] Device profile:', profile.tier);

    // 2. Setup storage
    this.updateStatus('Inizializzazione database...');
    // Dexie initializes on first query automatically

    // 3. Register SW
    this.registerServiceWorker();
<<<<<<< HEAD
    this.initWorker();

    bus.subscribe('pdf-file-loaded', (data: any) => {
        this.handleFileUpload(data.file, data.arrayBuffer);
    });
=======

    // 4. Init Worker
    this.initWorker(profile.maxPagePool);
  }

  private initWorker(maxPool: number) {
    try {
      this.worker = new WorkerConstructor();
      this.worker.onmessage = (e) => this.handleWorkerMessage(e.data);
      this.worker.onerror = (err) => this.handleCriticalError(err.message || 'Worker crash');

      this.worker.postMessage({ type: 'SET_MAX_POOL', payload: { maxPool } });
      this.showHomeScreen();

      this.setupEventBindings();
    } catch (err) {
      this.handleCriticalError(`Impossibile avviare il Worker: ${err}`);
    }
  }

  private setupEventBindings() {
    bus.subscribe('open-file', () => this.promptOpenFile());
    
    bus.subscribe('export-pdf', () => {
      this.worker?.postMessage({ type: 'GET_PDF_BUFFER' });
    });

    const body = document.body;
    store.subscribe('theme', (t) => {
      body.setAttribute('data-theme', t);
    });
    // Set initial
    body.setAttribute('data-theme', store.get('theme'));
  }

  private promptOpenFile() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/pdf';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) this.handleFileUpload(file);
    };
    input.click();
>>>>>>> 692cdb1 (Refactor: Rifondazione architettura Fluent UI, worker estrazione testo e virtual scrolling)
  }

  private showHomeScreen() {
    console.log('[Main] Showing Home Screen');

    this.bootScreen.innerHTML = `
<<<<<<< HEAD
        <div class="upload-box" id="upload-box">
            <div class="upload-icon">📄</div>
            <div class="upload-text">Trascina un file PDF oppure clicca</div>
            <div class="upload-subtext">Offline-first • Privacy totale • Ultra veloce</div>
            <input type="file" id="file-input" accept=".pdf" style="display: none;">
=======
      <div class="home-container">
        <div class="home-card">
          <img src="./icons/icon-192.png" alt="pdfiuh" class="home-logo" onerror="this.style.display='none'">
          <h1>pdfiuh</h1>
          <p>Il tuo lettore e annotatore PDF web-native.<br/>Veloce, offline e privacy-first.</p>

          <div id="drop-zone" class="drop-zone">
            <div class="drop-zone-content">
              <svg class="drop-zone-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M12 15V3m0 0L8.5 6.5M12 3l3.5 3.5M2 17l.621 2.485A2 2 0 0 0 4.561 21h14.878a2 2 0 0 0 1.94-1.515L22 17"></path></svg>
              <p>Trascina qui un file PDF o <a>Scegli file</a></p>
            </div>
            <input type="file" id="file-input" accept="application/pdf" class="visually-hidden">
          </div>

          <div class="home-footer">
            Tutti i file vengono aperti localmente nel browser. Nessun dato viene inviato ai server.
          </div>
>>>>>>> 692cdb1 (Refactor: Rifondazione architettura Fluent UI, worker estrazione testo e virtual scrolling)
        </div>
        <div class="spinner"></div>
        <div id="boot-status"></div>
    `;
    this.bootStatus = this.bootScreen.querySelector('#boot-status')!;

<<<<<<< HEAD
    const dropZone = this.bootScreen.querySelector('#upload-box') as HTMLElement;
=======
    this.bootScreen.classList.remove('hidden');

    const dropZone = this.bootScreen.querySelector('#drop-zone') as HTMLElement;
>>>>>>> 692cdb1 (Refactor: Rifondazione architettura Fluent UI, worker estrazione testo e virtual scrolling)
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

<<<<<<< HEAD
      dropZone.ondragleave = () => {
        dropZone.classList.remove('drag-over');
      };

      dropZone.ondrop = async (e: DragEvent) => {
=======
      dropZone.ondrop = (e) => {
>>>>>>> 692cdb1 (Refactor: Rifondazione architettura Fluent UI, worker estrazione testo e virtual scrolling)
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
      
      dropZone.ondragleave = () => {
        dropZone.classList.remove('drag-over');
      };
    }
  }

<<<<<<< HEAD
  private async handleFileUpload(file: File, arrayBuffer: ArrayBuffer) {
    this.fileName = file.name;
    this.currentDocId = `doc_${Date.now()}`;
    console.log(`[Main] Uploading file: ${file.name} (${file.size} bytes)`);

    this.bootScreen.classList.add('loading');
    this.updateStatus(`Caricamento di ${file.name}...`);

    try {
      const bufferCopy = arrayBuffer.slice(0);
      
=======
  private async handleFileUpload(file: File) {
    this.activeFile = file;
    store.set('fileName', file.name);
    
    // Hash file content or name to generate docId
    const docId = await this.generateDocId(file.name, file.size);
    store.set('docId', docId);

    // Show boot loading again
    this.bootScreen.innerHTML = `
      <div class="boot-spinner"></div>
      <div id="boot-status">Caricamento di ${file.name}...</div>
    `;
    this.bootStatus = document.getElementById('boot-status')!;

    try {
      const arrayBuffer = await file.arrayBuffer();
>>>>>>> 692cdb1 (Refactor: Rifondazione architettura Fluent UI, worker estrazione testo e virtual scrolling)
      this.worker?.postMessage({
        type: 'LOAD',
        payload: { buffer: bufferCopy }
      }, [bufferCopy]);
    } catch (err) {
<<<<<<< HEAD
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
=======
      this.handleCriticalError(`Errore lettura file: ${err}`);
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private handleWorkerMessage(data: { type: string, payload?: any, message?: string }) {
    const { type, payload, message } = data;
>>>>>>> 692cdb1 (Refactor: Rifondazione architettura Fluent UI, worker estrazione testo e virtual scrolling)

    switch (type) {
      case 'LOADED':
        this.updateStatus('Costruzione interfaccia...');
        this.setupMainUI(payload.totalPages, payload.outline, payload.pageWidth, payload.pageHeight);
        break;

      case 'PDF_BUFFER':
        exportPDF(store.get('docId'), payload.buffer, this.activeFile?.name || 'document.pdf');
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
        this.handleCriticalError(message || 'Errore sconosciuto del worker');
        break;
    }
  }

<<<<<<< HEAD

  private setupMainUI(totalPages: number, outline: any[]) {
    console.log('[Main] Setting up UI...');
    this.appContainer.innerHTML = '';
    this.appContainer.className = 'pdfiuh-app';
    this.appContainer.style.display = 'flex';

=======
  private setupMainUI(totalPages: number, outline: any[], pageWidth: number, pageHeight: number) {
>>>>>>> 692cdb1 (Refactor: Rifondazione architettura Fluent UI, worker estrazione testo e virtual scrolling)
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

    const sidebar = document.getElementById('main-sidebar') as any;
    const viewer = document.getElementById('main-viewer') as any;

    if (sidebar) {
      sidebar.setWorker(this.worker);
      sidebar.updateToC(outline || []);
    }

    if (viewer) {
      viewer.setDocumentInfo(store.get('docId'), totalPages, this.worker, pageWidth, pageHeight);
    }

<<<<<<< HEAD
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
=======
    this.appContainer.style.display = 'grid';
    
    // Hide boot screen
    this.bootScreen.classList.add('hidden');
    store.set('sidebarOpen', store.get('deviceProfile') !== 'low');
  }

  private async generateDocId(name: string, size: number): Promise<string> {
    return `doc_${name.replace(/[^a-z0-9]/gi, '_')}_${size}`;
  }

  private async registerServiceWorker() {
    if ('serviceWorker' in navigator) {
      try {
        await navigator.serviceWorker.register('./sw.js');
      } catch (err) {
        console.warn('[Main] SW registration failed:', err);
      }
    }
  }

  private updateStatus(text: string) {
    if (this.bootStatus) this.bootStatus.innerText = text;
  }

  private handleCriticalError(err: string) {
    console.error('[CRITICAL ERROR]', err);
    if (!this.bootStatus) return;
    this.bootStatus.style.color = '#e06c75';
    this.bootStatus.innerText = `Errore Critico: ${err}`;
    this.bootScreen.classList.remove('hidden');
>>>>>>> 692cdb1 (Refactor: Rifondazione architettura Fluent UI, worker estrazione testo e virtual scrolling)
  }
}

if (document.readyState === 'loading') {
  window.addEventListener('DOMContentLoaded', () => new PDFiuhApp());
} else {
  new PDFiuhApp();
}
