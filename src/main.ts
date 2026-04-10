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
  private currentDocId = 'demo-doc-123';

  constructor() {
    this.bootStatus = document.getElementById('boot-status')!;
    this.bootScreen = document.getElementById('boot-screen')!;
    this.appContainer = document.getElementById('viewer-container')!;

    console.log('[Main] App started. Initializing...');
    this.updateStatus('Avvio sistema...');

    this.registerServiceWorker();
    this.initWorker();
  }

  private showHomeScreen() {
    console.log('[Main] Showing Home Screen');

    this.bootScreen.innerHTML = `
      <div class="home-container">
        <div class="home-card">
          <div class="logo-mark">
            <svg viewBox="0 0 48 48" width="48" height="48">
              <defs>
                <linearGradient id="logoGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" style="stop-color:#61afef;stop-opacity:1" />
                  <stop offset="100%" style="stop-color:#4d9fdf;stop-opacity:1" />
                </linearGradient>
              </defs>
              <rect x="8" y="6" width="32" height="36" rx="4" fill="none" stroke="url(#logoGrad)" stroke-width="2"/>
              <line x1="14" y1="14" x2="34" y2="14" stroke="url(#logoGrad)" stroke-width="2" stroke-linecap="round"/>
              <line x1="14" y1="22" x2="34" y2="22" stroke="url(#logoGrad)" stroke-width="2" stroke-linecap="round" opacity="0.6"/>
              <line x1="14" y1="30" x2="28" y2="30" stroke="url(#logoGrad)" stroke-width="2" stroke-linecap="round" opacity="0.4"/>
            </svg>
          </div>
          <h1>pdfiuh</h1>
          <p class="tagline">PDF reader moderno e minimalista</p>

          <div id="drop-zone" class="drop-zone">
            <div class="drop-zone-content">
              <svg class="upload-icon" viewBox="0 0 24 24" width="32" height="32">
                <path d="M12 16V4m0 0l-4 4m4-4l4 4" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
                <path d="M20 16v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none" opacity="0.5"/>
              </svg>
              <p>Trascina un file PDF oppure <span>clicca per cercare</span></p>
            </div>
            <input type="file" id="file-input" accept="application/pdf" style="display: none;">
          </div>

          <div class="features">
            <div class="feature-item">
              <svg viewBox="0 0 24 24" width="16" height="16"><path d="M12 2v20M2 12h20" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
              <span>Offline-first</span>
            </div>
            <div class="feature-item">
              <svg viewBox="0 0 24 24" width="16" height="16"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" stroke="currentColor" stroke-width="2" fill="none"/></svg>
              <span>Privacy totale</span>
            </div>
            <div class="feature-item">
              <svg viewBox="0 0 24 24" width="16" height="16"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" stroke="currentColor" stroke-width="2" fill="none"/></svg>
              <span>Ultra veloce</span>
            </div>
          </div>
        </div>
      </div>
    `;

    this.bootScreen.classList.add('home-mode');

    const dropZone = this.bootScreen.querySelector('#drop-zone') as HTMLElement;
    const fileInput = this.bootScreen.querySelector('#file-input') as HTMLInputElement;

    if (dropZone && fileInput) {
      dropZone.onclick = () => fileInput.click();

      fileInput.onchange = (e: Event) => {
        const file = (e.target as HTMLInputElement).files?.[0];
        if (file) this.handleFileUpload(file);
      };

      dropZone.ondragover = (e: DragEvent) => {
        e.preventDefault();
        dropZone.classList.add('drag-over');
      };

      dropZone.ondragleave = () => {
        dropZone.classList.remove('drag-over');
      };

      dropZone.ondrop = (e: DragEvent) => {
        e.preventDefault();
        dropZone.classList.remove('drag-over');
        const file = e.dataTransfer?.files?.[0];
        if (file && file.type === 'application/pdf') {
          this.handleFileUpload(file);
        } else {
          alert('Per favore, carica un file PDF valido.');
        }
      };
    }
  }

  private async handleFileUpload(file: File) {
    console.log(`[Main] Uploading file: ${file.name} (${file.size} bytes)`);
    this.updateStatus(`Caricamento di ${file.name}...`);

    try {
      const arrayBuffer = await file.arrayBuffer();
      console.log('[Main] File read successfully, sending to worker...');
      
      // Creiamo una copia del buffer per il transfer
      const bufferCopy = arrayBuffer.slice(0);
      
      this.worker?.postMessage({
        type: 'LOAD',
        payload: { buffer: bufferCopy }
      }, [bufferCopy]);
      
      console.log('[Main] Message sent to worker, waiting for response...');
    } catch (err) {
      console.error('[Main] Error reading file:', err);
      this.handleCriticalError(`Errore durante la lettura del file: ${err}`);
    }
  }

  private async registerServiceWorker() {
    if ('serviceWorker' in navigator) {
      try {
        // Registriamo il SW con path assoluto che include il base path di GitHub Pages
        await navigator.serviceWorker.register('/pdfiuh/sw.js');
        console.log('[Main] Service Worker registered at /pdfiuh/sw.js');
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

      case 'ERROR':
        this.handleCriticalError(data.message || data.payload || 'Errore sconosciuto del worker');
        break;
    }
  }

  private setupMainUI(totalPages: number, outline: any[]) {
    console.log('[Main] Setting up UI...');
    this.appContainer.innerHTML = '';
    this.appContainer.className = 'pdfiuh-app';
    this.appContainer.style.display = 'grid';

    this.appContainer.innerHTML = `
      <pdfiuh-toolbar></pdfiuh-toolbar>
      <pdfiuh-sidebar id="main-sidebar"></pdfiuh-sidebar>
      <pdfiuh-viewer id="main-viewer"></pdfiuh-viewer>
    `;

    this.sidebarComponent = document.getElementById('main-sidebar');
    if (this.sidebarComponent) {
      this.sidebarComponent.updateToC(outline);
    }

    this.viewerComponent = document.getElementById('main-viewer');
    if (this.viewerComponent) {
      this.viewerComponent.setDocumentInfo(this.currentDocId, totalPages, this.worker);
    }

    this.hideBootScreen();
  }

  private updateStatus(text: string) {
    console.log(`[Status] ${text}`);
    this.bootStatus.innerText = text;
  }

  private hideBootScreen() {
    this.bootScreen.style.opacity = '0';
    setTimeout(() => {
      this.bootScreen.style.display = 'none';
    }, 300);
  }

  private handleCriticalError(err: any) {
    console.error('[CRITICAL ERROR]', err);
    this.bootStatus.style.color = 'var(--error-color)';
    this.bootStatus.innerText = `Errore Critico: ${err}`;
    this.bootScreen.style.opacity = '1';
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
