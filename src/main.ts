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
          <div class="home-icon">📄</div>
          <h1>Benvenuto in pdfiuh</h1>
          <p>Il tuo lettore PDF ultra-leggero e performante.</p>

          <div id="drop-zone" class="drop-zone">
            <div class="drop-zone-content">
              <span class="drop-zone-icon">⬆️</span>
              <p>Trascina qui il tuo PDF o <span>clicca per selezionarlo</span></p>
            </div>
            <input type="file" id="file-input" accept="application/pdf" style="display: none;">
          </div>

          <div class="home-footer">
            Sincronizzazione cross-device • Offline-first • Privacy totale
          </div>
        </div>
      </div>
    `;

    this.bootScreen.classList.add('home-mode');

    const dropZone = this.bootScreen.querySelector('#drop-zone');
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

      dropZone.ondragleave = () => {
        dropZone.classList.remove('drag-over');
      };

      dropZone.ondrop = (e) => {
        e.preventDefault();
        dropZone.classList.remove('drag-over');
        const file = e.dataTransfer.files?.[0];
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
      console.log('[Main] Sending LOAD message to worker...');
      this.worker?.postMessage({
        type: 'LOAD',
        payload: { buffer: arrayBuffer }
      }, [arrayBuffer]);
    } catch (err) {
      this.handleCriticalError(`Errore durante la lettura del file: ${err}`);
    }
  }

  private async registerServiceWorker() {
    if ('serviceWorker' in navigator) {
      try {
        await navigator.serviceWorker.register('./sw.js');
        console.log('[Main] Service Worker registered.');
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
