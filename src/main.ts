import './ui/components/Toolbar';
import './ui/components/Sidebar';
import './ui/components/Viewer';
import WorkerConstructor from './core/worker?worker';
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
    this.updateStatus('Connessione al motore WASM...');

    try {
      // Utilizziamo l'import ?worker di Vite per la massima compatibilità di bundling
      this.worker = new WorkerConstructor();


      this.worker.onmessage = (e) => this.handleWorkerMessage(e.data);
      this.worker.onerror = (err) => this.handleCriticalError(`Errore Worker: ${err}`);

      // Timeout di sicurezza: se il worker non risponde in 5 secondi, c'è un problema di caricamento
      const bootTimeout = setTimeout(() => {
        if (this.bootScreen.style.display !== 'none') {
          this.handleCriticalError('Il motore PDF non risponde. Verifica la connessione o ricarica la pagina.');
        }
      }, 5000);

      this.worker.postMessage({ type: 'INIT' });

      // Rimuoviamo il timeout quando riceviamo la prima risposta
      this.worker.addEventListener('message', () => clearTimeout(bootTimeout), { once: true });

    } catch (err) {
      this.handleCriticalError(`Impossibile avviare il Worker: ${err}`);
    }
  }

  private handleWorkerMessage(data: any) {
    const { type, payload } = data;
    console.log(`[Main] Worker Message: ${type}`);

    switch (type) {
      case 'INIT_SUCCESS':
        this.updateStatus('Motore Pronto. Caricamento Documento...');
        this.loadDemoPDF();
        break;

      case 'PDF_LOADED':
        this.updateStatus('Documento Caricato. Costruzione Interfaccia...');
        this.setupMainUI(payload.totalPages, payload.outline);
        break;

      case 'ERROR':
        this.handleCriticalError(`Errore Motore: ${payload}`);
        break;
    }
  }

  private loadDemoPDF() {
    console.log('[Main] Loading demo PDF...');
    const mockBuffer = new ArrayBuffer(1024);
    this.worker?.postMessage({
      type: 'LOAD_PDF',
      payload: { buffer: mockBuffer }
    }, [mockBuffer]);
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
