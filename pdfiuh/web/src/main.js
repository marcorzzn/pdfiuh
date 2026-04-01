import * as pdfjsLib from 'pdfjs-dist';
import init, { PdfWebEngine } from '../pkg/pdfiuh_core.js';

// Setup worker
pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;

let pdfDoc = null;
let pageNum = 1;
let scale = 1.5;
let engine = null;

const canvas = document.getElementById('pdf-canvas');
const ctx = canvas.getContext('2d');
const glassPane = document.getElementById('glass-pane');
const glassCtx = glassPane.getContext('2d');
const statusSpan = document.getElementById('status');

async function renderPage(num) {
    statusSpan.textContent = `Rendering pagina ${num}...`;
    
    const page = await pdfDoc.getPage(num);
    const viewport = page.getViewport({ scale: scale });
    
    // Canvas di base
    canvas.height = viewport.height;
    canvas.width = viewport.width;
    
    // Glass pane (sopra)
    glassPane.height = viewport.height;
    glassPane.width = viewport.width;

    const renderContext = {
        canvasContext: ctx,
        viewport: viewport
    };
    
    await page.render(renderContext).promise;
    
    // Disegna annotazioni dal motore Rust
    drawAnnotations();
    statusSpan.textContent = `Pronto`;
}

function drawAnnotations() {
    glassCtx.clearRect(0, 0, glassPane.width, glassPane.height);
    
    // Qui in un'implementazione reale estrarremmo le annotazioni usando l'engine WASM.
    // Per ora abbiamo `serialize_annotations`, lo deserializzeremmo e disegneremmo.
    // Simuliamo il rendering di un rettangolo giallo trasparente per il test.
    glassCtx.fillStyle = 'rgba(255, 255, 0, 0.4)';
    glassCtx.fillRect(100, 100, 200, 50);
}

document.getElementById('highlight-btn').addEventListener('click', () => {
    if (!engine) return;
    
    // Chiama il motore Rust!
    engine.add_highlight(100.0, 100.0, 200.0, 50.0);
    console.log("Annotazione aggiunta in memoria Rust");
    
    // Ottieni i bytes bincode
    const bytes = engine.serialize_annotations();
    console.log(`Payload serializzato da Rust (${bytes.length} bytes):`, bytes);
    
    drawAnnotations();
});

async function boot() {
    try {
        // 1. Inizializza WASM
        await init();
        console.log("pdfiuh WASM caricato!");
        engine = new PdfWebEngine(pageNum);
        
        // 2. Carica PDF Dummy (per evitare errori CORS, creiamo un PDF vuoto minimo)
        const pdfData = atob(
            'JVBERi0xLjcKCjEgMCBvYmogICUgZW50cnkgcG9pbnQKPDwKICAvVHlwZSAvQ2F0YWxvZwog' +
            'IC9QYWdlcyAyIDAgUgo+PgplbmRvYmoKCjIgMCBvYmoKPDwKICAvVHlwZSAvUGFnZXMKICAv' +
            'TWVkaWFCb3ggWyAwIDAgMjAwIDIwMCBdCiAgL0NvdW50IDEKICAvS2lkcyBbIDMgMCBSIF0K' +
            'Pj4KZW5kb2JqCgozIDAgb2JqCjw8CiAgL1R5cGUgL1BhZ2UKICAvUGFyZW50IDIgMCBSCiAg' +
            'L1Jlc291cmNlcyA8PAogICAgL0ZvbnQgPDwKICAgICAgL0YxIDQgMCBSCj4+CiAgPj4KICAv' +
            'Q29udGVudHMgNSAwIFIKPj4KZW5kb2JqCgo0IDAgb2JqCjw8CiAgL1R5cGUgL0ZvbnQKICAv' +
            'U3VidHlwZSAvVHlwZTExCiAgL0Jhc2VGb250IC9UaW1lcy1Sb21hbgo+PgplbmRvYmoKCjUg' +
            'MCBvYmoKPDwgL0xlbmd0aCA0NCA+PgpzdHJlYW0KQlQKNzA1MCAwIFRECi9GMSAxMiBUZgoK' +
            'KHBkZml1aCBXZWIsIENpYW8hKSBUagoKRVQKZW5kc3RyZWFtCmVuZG9iagoKeHJlZgowIDYK' +
            'MDAwMDAwMDAwMCA2NTUzNSBmIAowMDAwMDAwMDEwIDAwMDAwIG4gCjAwMDAwMDAwNTkgMDAw' +
            'MDAgbiAKMDAwMDAwMDE0OCAwMDAwMCBuIAowMDAwMDAwMjg1IDAwMDAwIG4gCjAwMDAwMDAz' +
            'NzMgMDAwMDAgbiAKdHJhaWxlcgo8PAogIC9TaXplIDYKICAvUm9vdCAxIDAgUgo+PgpzdGFy' +
            'dHhyZWYKNDY4CiUlRU9GCg=='
        );
        const uint8Array = new Uint8Array(pdfData.length);
        for (let i = 0; i < pdfData.length; i++) {
            uint8Array[i] = pdfData.charCodeAt(i);
        }

        const loadingTask = pdfjsLib.getDocument({data: uint8Array});
        pdfDoc = await loadingTask.promise;
        
        renderPage(pageNum);
    } catch (err) {
        console.error("Errore di inizializzazione:", err);
        statusSpan.textContent = "Errore: " + err.message;
    }
}

boot();
