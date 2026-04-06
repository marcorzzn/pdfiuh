import './ui/components/Toolbar';
import './ui/components/Sidebar';
import './ui/components/Viewer';
import { bus } from './core/event-bus';

class PDFiuhApp {
  private worker: Worker;
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

    this.registerServiceWorker();
    this.initWorker();
  }

  private async registerServiceWorker() {
    if ('serviceWorker' in navigator) {
      try {
        await navigator.serviceWorker.register('/public/sw.js');
        console.log('[PWA] Service Worker registered successfully.');
      } catch (err) {
        console.error('[PWA] Service Worker registration failed:', err);
      }
    }
  }

  private initWorker() {
    this.worker = new Worker(
      new URL('./core/worker.ts', import.meta.url),
      { type: 'module' }
    );

    this.worker.onmessage = (e) => this.handleWorkerMessage(e.data);
    this.worker.onerror = (err) => this.handleCriticalError(err);

    this.updateStatus('Inizializzazione Motore WASM...');
    this.worker.postMessage({ type: 'INIT' });
  }

  private handleWorkerMessage(data: any) {
    const { type, payload } = data;

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
        this.handleCriticalError(payload);
        break;
    }
  }

  private loadDemoPDF() {
    const mockBuffer = new ArrayBuffer(1024);
    this.worker.postMessage({
      type: 'LOAD_PDF',
      payload: { buffer: mockBuffer }
    }, [mockBuffer]);
  }

  private setupMainUI(totalPages: number, outline: any[]) {
    this.appContainer.innerHTML = '';
    this.appContainer.className = 'pdfiuh-app';
    this.appContainer.style.display = 'grid';

    this.appContainer.innerHTML = `
      <pdfiuh-toolbar></pdfiuh-toolbar>
      <pdfiuh-sidebar id="main-sidebar"></pdfiuh-sidebar>
      <pdfiuh-viewer id="main-viewer"></pdfiuh-viewer>
    `;

    this.sidebarComponent = document.getElementById('main-sidebar');
    this.sidebarComponent.updateToC(outline);

    this.viewerComponent = document.getElementById('main-viewer');
    this.viewerComponent.setDocumentInfo(this.currentDocId, totalPages, this.worker);

    this.hideBootScreen();
  }

  private updateStatus(text: string) {
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
  }
}

window.addEventListener('DOMContentLoaded', () => {
  new PDFiuhApp();
});
