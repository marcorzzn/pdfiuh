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
  private bootStatus = document.getElementById('boot-status')!;
  private bootScreen = document.getElementById('boot-screen')!;
  private appContainer = document.getElementById('viewer-container')!;
  private activeFile: File | null = null;
  private viewerElement: any = null;
  private sidebarElement: any = null;

  constructor() {
    this.init();
  }

  private async init() {
    console.log('[Main] App started. Initializing...');
    this.updateStatus('Avvio sistema...');

    // Check for file hash in URL (restoring from deep link)
    const hash = window.location.hash.slice(1); // e.g. file=MyDoc.pdf
    if (hash.startsWith('file=')) {
      const fileName = decodeURIComponent(hash.substring(5));
      document.title = `${fileName} — pdfiuh`;
      this.updateStatus(`File: ${fileName}`);
    }

    // 1. Detect hardware profile
    const profile = detectProfile();
    store.set('deviceProfile', profile.tier);
    console.log('[Main] Device profile:', profile.tier);

    // 2. Setup storage
    this.updateStatus('Inizializzazione database...');
    // Dexie initializes on first query automatically

    // 3. Register SW
    this.registerServiceWorker();

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
  }

  private showHomeScreen() {
    console.log('[Main] Showing Home Screen');

    this.bootScreen.innerHTML = `
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
        </div>
      </div>
    `;

    this.bootScreen.classList.remove('hidden');

    const dropZone = this.bootScreen.querySelector('#drop-zone') as HTMLElement;
    const fileInput = this.bootScreen.querySelector('#file-input') as HTMLInputElement;

    if (dropZone && fileInput) {
      dropZone.onclick = () => fileInput.click();

      fileInput.onchange = (e) => {
        const file = (e.target as HTMLInputElement).files?.[0];
        if (file) this.handleFileUpload(file);
      };

      dropZone.ondragover = (e) => {
        e.preventDefault();
        dropZone.classList.add('drag-over');
      };

      dropZone.ondrop = (e) => {
        e.preventDefault();
        dropZone.classList.remove('drag-over');
        const file = e.dataTransfer?.files?.[0];
        if (file && file.type === 'application/pdf') {
          this.handleFileUpload(file);
        } else {
          alert('Per favore, carica un file PDF valido.');
        }
      };
      
      dropZone.ondragleave = () => {
        dropZone.classList.remove('drag-over');
      };
    }
  }

  private async handleFileUpload(file: File) {
    this.activeFile = file;
    store.set('fileName', file.name);

    // Update URL hash to reflect the file (like Edge/Chrome PDF reader)
    window.location.hash = `file=${encodeURIComponent(file.name)}`;
    document.title = `${file.name} — pdfiuh`;

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
      this.worker?.postMessage({
        type: 'LOAD',
        payload: { buffer: arrayBuffer }
      }, [arrayBuffer]);
    } catch (err) {
      this.handleCriticalError(`Errore lettura file: ${err}`);
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private handleWorkerMessage(data: { type: string, payload?: any, message?: string }) {
    const { type, payload, message } = data;

    switch (type) {
      case 'LOADED':
        this.updateStatus('Costruzione interfaccia...');
        this.setupMainUI(payload.totalPages, payload.outline, payload.pageWidth, payload.pageHeight);
        break;

      case 'RENDERED':
        // Forward RENDERED page to the Viewer component
        this.viewerElement?.handleWorkerMessage(data);
        break;

      case 'THUMBNAIL_RENDERED':
        // Forward thumbnail to Sidebar
        this.sidebarElement?.handleThumbnailRendered(
          payload?.pageNumber,
          payload?.bitmap,
          payload?.width,
          payload?.height
        );
        break;

      case 'TEXT_EXTRACTED':
        // Text extraction result — used by find-bar via viewer
        if (payload) {
          bus.publish('text-extracted', { pageNumber: payload.pageNumber, text: payload.text });
        }
        break;

      case 'PAGE_COUNT':
        // Fast page count (before full load)
        break;

      case 'PDF_BUFFER':
        exportPDF(store.get('docId'), payload.buffer, this.activeFile?.name || 'document.pdf');
        break;

      case 'ERROR':
        this.handleCriticalError(message || 'Errore sconosciuto del worker');
        break;
    }
  }

  private setupMainUI(totalPages: number, outline: any[], pageWidth: number, pageHeight: number) {
    this.appContainer.innerHTML = `
      <pdfiuh-toolbar></pdfiuh-toolbar>
      <pdfiuh-sidebar id="main-sidebar"></pdfiuh-sidebar>
      <pdfiuh-viewer id="main-viewer"></pdfiuh-viewer>
    `;

    this.sidebarElement = document.getElementById('main-sidebar');
    this.viewerElement = document.getElementById('main-viewer');

    if (this.sidebarElement) {
      this.sidebarElement.setWorker(this.worker);
      this.sidebarElement.updateToC(outline || []);
    }

    if (this.viewerElement) {
      this.viewerElement.setDocumentInfo(store.get('docId'), totalPages, this.worker, pageWidth, pageHeight);
    }

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
  }
}

if (document.readyState === 'loading') {
  window.addEventListener('DOMContentLoaded', () => new PDFiuhApp());
} else {
  new PDFiuhApp();
}
