/**
 * pdfiuh Web — Orchestratore principale (Dashboard Edition)
 *
 * Architettura Dual-Layer:
 *   Layer 0 (raster):  PDF.js dentro un Web Worker → ImageBitmap → #pdf-canvas
 *   Layer 1 (vettore): PdfWebEngine (WASM/Rust)    → Canvas2D    → #glass-pane
 *
 * Nessun framework. Nessuna dipendenza runtime oltre pdfjs-dist e il modulo WASM.
 * Tutto il processing è off-main-thread o locale; nessun dato lascia il browser.
 */

import * as pdfjsLib from 'pdfjs-dist';
import init, { PdfWebEngine } from '../pkg/pdfiuh_core.js';

// ---------------------------------------------------------------------------
// 0. Configurazione PDF.js
// ---------------------------------------------------------------------------

pdfjsLib.GlobalWorkerOptions.workerSrc =
  `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;

// ---------------------------------------------------------------------------
// 1. Costanti e stato globale
// ---------------------------------------------------------------------------

/** Strumenti di annotazione selezionabili dall'utente. */
const Tool = Object.freeze({
  NONE:      'none',
  HIGHLIGHT: 'highlight',
  INK:       'ink',
  NOTE:      'note',
});

const ZOOM_STEPS = [0.5, 0.75, 1.0, 1.25, 1.5, 2.0, 3.0];

/** Stato globale dell'applicazione — tutto in un unico oggetto. */
const state = {
  /** @type {PdfWebEngine | null} Motore WASM */
  engine: null,
  /** @type {Worker | null} Web Worker che gestisce PDF.js */
  pdfWorker: null,
  /** Numero totale di pagine del documento corrente */
  pageCount: 0,
  /** Pagina corrente (1-indexed) */
  currentPage: 1,
  /** Indice scala di rendering corrente in ZOOM_STEPS */
  zoomIndex: 2, // Default: 1.0
  /** Strumento attivo */
  tool: Tool.NONE,
  /** Flag: il puntatore è premuto sul glass pane */
  isPointerDown: false,
  /** Hash identificativo del documento corrente (per chiavi IndexedDB) */
  docHash: '',
  /** Colore inchiostro corrente (formato CSS hex) */
  inkColor: '#e63946',
  /** Spessore inchiostro in punti */
  inkThickness: 2.5,
  /** Colore highlight (RGBA esplodito per passaggio a WASM) */
  highlightColor: { r: 137, g: 87, b: 229, a: 128 }, // GitHub purple
  highlightStart: null,
  isRendering: false,
};

function currentScale() {
  return ZOOM_STEPS[state.zoomIndex];
}

// ---------------------------------------------------------------------------
// 2. Riferimenti DOM
// ---------------------------------------------------------------------------

const canvas    = /** @type {HTMLCanvasElement} */ (document.getElementById('pdf-canvas'));
const glassPane = /** @type {HTMLCanvasElement} */ (document.getElementById('glass-pane'));
const ctx       = canvas.getContext('2d');
const glassCtx  = glassPane.getContext('2d');
const statusEl  = document.getElementById('status');
const fileInput = document.getElementById('file-input');
const dndOverlay= document.getElementById('dnd-overlay');

const pageInfoEl = document.getElementById('page-info');
const zoomInfoEl = document.getElementById('zoom-info');

// ---------------------------------------------------------------------------
// 3. Comunicazione con il Web Worker PDF.js
// ---------------------------------------------------------------------------

/**
 * Crea il Web Worker che gestisce PDF.js.
 * Il Worker è isolato: non ha accesso al DOM né allo stato globale.
 */
function spawnPdfWorker() {
  // Usa import.meta.url per un percorso relativo al bundle Vite.
  state.pdfWorker = new Worker(
    new URL('./pdf-worker.js', import.meta.url),
    { type: 'module' }
  );

  state.pdfWorker.addEventListener('message', onWorkerMessage);
  state.pdfWorker.addEventListener('error', (e) => {
    setStatus(`Errore Worker: ${e.message}`, true);
  });
}

/**
 * Gestisce tutti i messaggi in arrivo dal Worker PDF.js.
 * @param {MessageEvent} e
 */
function onWorkerMessage(e) {
  const { type } = e.data;

  switch (type) {
    case 'LOADED':
      state.pageCount = e.data.pageCount;
      setStatus(`Documento caricato — ${state.pageCount} pagine`);
      updateNavUI();
      renderCurrentPage();
      break;

    case 'RENDERED': {
      const { bitmap, width, height } = e.data;
      canvas.width  = width;
      canvas.height = height;
      glassPane.width  = width;
      glassPane.height = height;
      ctx.drawImage(bitmap, 0, 0);
      bitmap.close(); // Libera immediatamente la memoria GPU.
      redrawAnnotations();
      setStatus(`Pagina ${state.currentPage} / ${state.pageCount}`);
      state.isRendering = false;
      break;
    }

    case 'LOAD_ERROR':
      setStatus(`Errore caricamento PDF: ${e.data.message}`, true);
      break;

    case 'RENDER_ERROR':
      setStatus(`Errore rendering pagina ${e.data.pageIndex + 1}: ${e.data.message}`, true);
      state.isRendering = false;
      break;

    default:
      console.warn('[main] Messaggio Worker sconosciuto:', type);
  }
}

// ---------------------------------------------------------------------------
// 4. Caricamento documento
// ---------------------------------------------------------------------------

/**
 * Carica un file PDF dal filesystem locale.
 * @param {File} file
 */
async function loadPdfFile(file) {
  if (!file) return;
  try {
    setStatus(`Caricamento "${file.name}"…`);

    // Azzera lo stato navigazione.
    state.currentPage = 1;
    state.pageCount   = 0;
    state.docHash     = await computeFileHash(file);
    updateNavUI();

    // Trasferisce il buffer al Worker: operazione zero-copy.
    const buffer = await file.arrayBuffer();
    state.pdfWorker.postMessage({ type: 'LOAD', buffer }, [buffer]);

    // Inizializza (o resetta) il motore WASM per la pagina 1.
    if (state.engine) {
      state.engine.set_page(1);
    }

    // Prova a ripristinare le annotazioni salvate per la pagina 1.
    await restoreAnnotations(1);
  } catch (err) {
    setStatus(`Errore irreversibile caricamento file: ${err.message}`, true);
  }
}

/**
 * Ordina al Worker di renderizzare la pagina corrente alla scala corrente.
 */
function renderCurrentPage() {
  if (!state.pdfWorker || state.pageCount === 0 || state.isRendering) return;
  state.isRendering = true;
  setStatus(`Rendering pagina ${state.currentPage}…`);
  state.pdfWorker.postMessage({
    type:      'RENDER',
    pageIndex: state.currentPage - 1,
    scale:     currentScale(),
  });
}

function updateNavUI() {
  pageInfoEl.textContent = `${state.pageCount > 0 ? state.currentPage : 0} / ${state.pageCount}`;
  zoomInfoEl.textContent = `${Math.round(currentScale() * 100)}%`;
}

// ---------------------------------------------------------------------------
// 5. Motore WASM — annotazioni
// ---------------------------------------------------------------------------

/**
 * Ridisegna tutte le annotazioni del layer corrente sul glass pane.
 * Chiamato dopo ogni render PDF e dopo ogni modifica alle annotazioni.
 */
function redrawAnnotations() {
  glassCtx.clearRect(0, 0, glassPane.width, glassPane.height);

  if (!state.engine || state.engine.annotation_count() === 0) return;

  // Deserializza il layer Rust in JS per accedere ai dati geometrici.
  try {
    const bytes = state.engine.serialize_annotations();
    // Placeholder visivo finché non abbiamo parse bincode in JS
    glassCtx.save();
    glassCtx.font = '12px monospace';
    glassCtx.fillStyle = 'rgba(137, 87, 229, 0.8)'; // GitHub purple
    glassCtx.fillText(`Layer: ${state.engine.annotation_count()} annotaz. (${bytes.length}B)`, 8, 16);
    glassCtx.restore();
  } catch (err) {
    console.error('[main] redrawAnnotations:', err);
  }
}

// ---------------------------------------------------------------------------
// 6. Gestione eventi mouse / pointer sul glass pane
// ---------------------------------------------------------------------------

/**
 * Converte le coordinate del pointer (in pixel CSS) in punti PDF alla scala 1.0,
 * così il WASM engine lavora su coordinate normalizzate indipendenti dallo zoom.
 * In questa implementazione base il WASM engine riceve le coordinate scalate (le stesse del canvas).
 * @param {PointerEvent} e
 * @returns {{ x: number, y: number }}
 */
function toPdfCoords(e) {
  const rect = glassPane.getBoundingClientRect();
  const scaleX = glassPane.width  / rect.width;
  const scaleY = glassPane.height / rect.height;
  return {
    x: (e.clientX - rect.left) * scaleX,
    y: (e.clientY - rect.top)  * scaleY,
  };
}

glassPane.addEventListener('pointerdown', (e) => {
  if (e.button !== 0) return; // Solo tasto sinistro.
  if (!state.engine || state.tool === Tool.NONE) return;

  state.isPointerDown = true;
  glassPane.setPointerCapture(e.pointerId);

  const { x, y } = toPdfCoords(e);

  if (state.tool === Tool.INK) {
    state.engine.add_freehand_point(x, y);
  }

  if (state.tool === Tool.NOTE) {
    // Per le note: mostra un prompt e aggiungi subito.
    const text = window.prompt('Testo della nota:');
    if (text && text.trim() !== '') {
      state.engine.add_sticky_note(x, y, text.trim());
      redrawAnnotations();
      saveAnnotations();
    }
    state.isPointerDown = false;
  }
});

glassPane.addEventListener('pointermove', (e) => {
  if (!state.isPointerDown || !state.engine) return;

  const { x, y } = toPdfCoords(e);

  if (state.tool === Tool.INK) {
    state.engine.add_freehand_point(x, y);

    // Anteprima in tempo reale del tratto.
    const pts = state.engine.freehand_point_count();
    if (pts >= 2) {
      glassCtx.lineWidth   = state.inkThickness;
      glassCtx.strokeStyle = state.inkColor;
      glassCtx.lineCap     = 'round';
      glassCtx.lineJoin    = 'round';
      glassCtx.beginPath();
      glassCtx.stroke();
    }
  }

  if (state.tool === Tool.HIGHLIGHT) {
    // Preview del rettangolo di selezione durante il drag.
    if (state.highlightStart) {
      const { x: sx, y: sy } = state.highlightStart;
      glassCtx.clearRect(0, 0, glassPane.width, glassPane.height);
      redrawAnnotations();
      const { r, g, b, a } = state.highlightColor;
      glassCtx.fillStyle = `rgba(${r},${g},${b},${a / 255})`;
      glassCtx.fillRect(sx, sy, x - sx, y - sy);
    }
  }
});

glassPane.addEventListener('pointerup', async (e) => {
  if (!state.isPointerDown || !state.engine) return;
  state.isPointerDown = false;

  const { x, y } = toPdfCoords(e);

  switch (state.tool) {
    case Tool.INK: {
      const committed = state.engine.commit_freehand(
        parseInt(state.inkColor.slice(1, 3), 16),
        parseInt(state.inkColor.slice(3, 5), 16),
        parseInt(state.inkColor.slice(5, 7), 16),
        255,                  // alpha solid per inchiostro
        state.inkThickness,
      );
      if (committed) {
        redrawAnnotations();
        await saveAnnotations();
      }
      break;
    }

    case Tool.HIGHLIGHT: {
      if (state.highlightStart) {
        const { x: sx, y: sy } = state.highlightStart;
        const w = x - sx;
        const h = y - sy;
        if (Math.abs(w) > 4 && Math.abs(h) > 4) {
          const { r, g, b, a } = state.highlightColor;
          state.engine.add_highlight_colored(
            Math.min(sx, x), Math.min(sy, y),
            Math.abs(w), Math.abs(h),
            r, g, b, a,
          );
          redrawAnnotations();
          await saveAnnotations();
        }
        state.highlightStart = null;
      }
      break;
    }
  }
});

glassPane.addEventListener('pointerdown', (e) => {
  if (state.tool === Tool.HIGHLIGHT && e.button === 0) {
    state.highlightStart = toPdfCoords(e);
  }
}, { capture: true }); // capture per leggere il punto prima degli altri listener

// Annulla il tratto se il pointer esce dalla finestra.
window.addEventListener('pointercancel', () => {
  if (state.engine && state.isPointerDown && state.tool === Tool.INK) {
    state.engine.discard_freehand();
  }
  state.isPointerDown = false;
  state.highlightStart = null;
});

// Escape annulla il freehand in costruzione.
window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && state.engine) {
    state.engine.discard_freehand();
    state.isPointerDown  = false;
    state.highlightStart = null;
    redrawAnnotations();
  }
});

// ---------------------------------------------------------------------------
// 7. Persistenza IndexedDB
// ---------------------------------------------------------------------------

const DB_NAME    = 'pdfiuh';
const DB_VERSION = 1;
const STORE_NAME = 'annotations';

/**
 * Apre (o crea) il database IndexedDB.
 * @returns {Promise<IDBDatabase>}
 */
function openDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE_NAME)) {
          req.result.createObjectStore(STORE_NAME);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror   = () => reject(req.error);
  });
}

/**
 * Costruisce la chiave di storage per il layer corrente.
 * Formato: `"<docHash>:<pageNum>"`.
 * @returns {string}
 */
function storageKey() {
  return `${state.docHash}:${state.currentPage}`;
}

/**
 * Salva il layer di annotazioni corrente in IndexedDB (async, fire-and-forget).
 */
async function saveAnnotations() {
  if (!state.engine || !state.docHash) return;
  try {
    const bytes = state.engine.serialize_annotations();
    const db    = await openDb();
    const tx    = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).put(bytes, storageKey());
    await new Promise((res, rej) => { tx.oncomplete = res; tx.onerror = rej; });
    db.close();
  } catch (err) {
    console.error('[main] saveAnnotations:', err);
  }
}

/**
 * Ripristina le annotazioni salvate per la pagina indicata.
 * Se non trovate, il layer rimane vuoto (nessun errore).
 * @param {number} page
 */
async function restoreAnnotations(page) {
  if (!state.engine || !state.docHash) return;

  const key = `${state.docHash}:${page}`;
  try {
    const db    = await openDb();
    const tx    = db.transaction(STORE_NAME, 'readonly');
    const req   = tx.objectStore(STORE_NAME).get(key);
    const bytes = await new Promise((res, rej) => { req.onsuccess = () => res(req.result); req.onerror = rej; });
    db.close();

    if (bytes instanceof Uint8Array && bytes.length > 0) {
      // Imposta prima la pagina corrente nel motore, poi deserializza.
      state.engine.set_page(page);
      state.engine.force_deserialize_annotations(bytes);
      console.log(`[main] Annotazioni ripristinate per pagina ${page} (${bytes.length} bytes)`);
    } else {
        // Pulisci lo stato wasm per questa pagina se non ci sono annotazioni salvate
        if (state.engine.annotation_count() > 0) {
            state.engine.clear_annotations();
        }
    }
  } catch (err) {
    // Non è un errore bloccante: il documento potrebbe essere nuovo.
    console.warn('[main] restoreAnnotations:', err);
    if (state.engine && state.engine.annotation_count() > 0) {
         state.engine.clear_annotations();
    }
  }
}

// ---------------------------------------------------------------------------
// 8. Navigazione e Zoom
// ---------------------------------------------------------------------------

/**
 * Naviga alla pagina indicata, salvando lo stato corrente e ripristinando quello nuovo.
 * @param {number} newPage
 */
async function goToPage(newPage) {
  if (newPage < 1 || newPage > state.pageCount || newPage === state.currentPage) return;

  // Salva le annotazioni della pagina che si sta lasciando.
  await saveAnnotations();

  state.currentPage = newPage;
  updateNavUI();

  // Inizializza il motore per la nuova pagina.
  if (state.engine) {
    state.engine.set_page(newPage);
    await restoreAnnotations(newPage);
  }

  renderCurrentPage();
}

/**
 * Cambia il livello di zoom
 * @param {number} step - +1 (zoom in) o -1 (zoom out)
 */
function changeZoom(step) {
    const newIndex = state.zoomIndex + step;
    if (newIndex >= 0 && newIndex < ZOOM_STEPS.length) {
        state.zoomIndex = newIndex;
        updateNavUI();
        renderCurrentPage();
    }
}


// ---------------------------------------------------------------------------
// 9. Selezione strumento
// ---------------------------------------------------------------------------

/**
 * Cambia lo strumento attivo e aggiorna il cursore del canvas.
 * @param {string} tool — uno dei valori di `Tool`
 */
function selectTool(tool) {
  state.tool = tool;
  const cursors = {
    [Tool.NONE]:      'default',
    [Tool.HIGHLIGHT]: 'crosshair',
    [Tool.INK]:       'crosshair',
    [Tool.NOTE]:      'cell',
  };
  glassPane.style.cursor = cursors[tool] ?? 'default';

  // Aggiorna visivamente i pulsanti toolbar (rimuove classe `active` da tutti).
  document.querySelectorAll('[data-tool]').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.tool === tool);
  });
}

// ---------------------------------------------------------------------------
// 10. Utilità
// ---------------------------------------------------------------------------

/**
 * Calcola un hash SHA-256 troncato del file per usarlo come chiave DB.
 * @param {File} file
 * @returns {Promise<string>}
 */
async function computeFileHash(file) {
  try {
    // Legge solo i primi 64 KB per velocità (sufficiente per identificare il file).
    const slice  = file.slice(0, 65_536);
    const buffer = await slice.arrayBuffer();
    const digest = await crypto.subtle.digest('SHA-256', buffer);
    return Array.from(new Uint8Array(digest))
      .slice(0, 8)
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  } catch {
    // Fallback: usa nome + dimensione se SubtleCrypto non disponibile.
    return `${file.name}-${file.size}`;
  }
}

/**
 * Aggiorna il testo dello status bar.
 * @param {string} msg
 * @param {boolean} [isError]
 */
function setStatus(msg, isError = false) {
  statusEl.textContent = msg;
  statusEl.style.color = isError ? '#e63946' : '#8b949e';
}

// ---------------------------------------------------------------------------
// 11. Binding UI → logica
// ---------------------------------------------------------------------------

// Apertura file tramite <input type="file">
if (fileInput) {
  fileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) loadPdfFile(file);
    e.target.value = ''; // Reset
  });
}

const openBtn = document.getElementById('open-btn');
if (openBtn) {
  openBtn.addEventListener('click', () => fileInput?.click());
}

// Drag-and-drop sul body
let dragCounter = 0;

document.body.addEventListener('dragenter', (e) => {
    e.preventDefault();
    dragCounter++;
    dndOverlay.classList.add('active');
});

document.body.addEventListener('dragover', (e) => {
    e.preventDefault();
});

document.body.addEventListener('dragleave', (e) => {
    e.preventDefault();
    dragCounter--;
    if (dragCounter === 0) {
        dndOverlay.classList.remove('active');
    }
});

document.body.addEventListener('drop', (e) => {
    e.preventDefault();
    dragCounter = 0;
    dndOverlay.classList.remove('active');

    const file = e.dataTransfer?.files[0];
    if (file?.type === 'application/pdf') {
        loadPdfFile(file);
    } else {
        setStatus("Errore: Il file rilasciato non è un PDF.", true);
    }
});

// Bottoni strumento
document.querySelectorAll('[data-tool]').forEach((btn) => {
  btn.addEventListener('click', () => selectTool(btn.dataset.tool));
});

// Navigazione pagina
const prevBtn = document.getElementById('prev-btn');
const nextBtn = document.getElementById('next-btn');
if (prevBtn) prevBtn.addEventListener('click', () => goToPage(state.currentPage - 1));
if (nextBtn) nextBtn.addEventListener('click', () => goToPage(state.currentPage + 1));

// Zoom
const zoomInBtn = document.getElementById('zoom-in-btn');
const zoomOutBtn = document.getElementById('zoom-out-btn');
if (zoomInBtn) zoomInBtn.addEventListener('click', () => changeZoom(1));
if (zoomOutBtn) zoomOutBtn.addEventListener('click', () => changeZoom(-1));

// Reset Annotations
const clearBtn = document.getElementById('clear-btn');
if (clearBtn) {
    clearBtn.addEventListener('click', async () => {
        if (!state.engine) return;
        if (confirm("Vuoi davvero cancellare tutte le annotazioni in questa pagina?")) {
            state.engine.clear_annotations();
            redrawAnnotations();
            await saveAnnotations();
        }
    });
}

// Salva le annotazioni quando si chiude/ricarica la pagina
window.addEventListener('beforeunload', () => {
    // Nota: IndexedDB potrebbe non completare transazioni async in beforeunload,
    // ma la salviamo comunque prima del cambio pagina per sicurezza.
    saveAnnotations();
});


// ---------------------------------------------------------------------------
// 12. Bootstrap
// ---------------------------------------------------------------------------

/**
 * Inizializza l'applicazione:
 *   1. Carica il modulo WASM.
 *   2. Crea il Web Worker PDF.js.
 *   3. Crea il motore di annotazione per la pagina 1.
 */
async function boot() {
  setStatus('Caricamento modulo WASM…');
  try {
    await init();
    console.log('[main] Modulo WASM pdfiuh_core caricato.');
  } catch (err) {
    setStatus(`Errore WASM: ${err.message}`, true);
    console.error('[main] boot WASM:', err);
    return;
  }

  spawnPdfWorker();

  try {
    state.engine = new PdfWebEngine(1);
    console.log('[main] PdfWebEngine inizializzato per pagina 1.');
  } catch (err) {
    setStatus(`Errore motore Rust: ${err}`, true);
    console.error('[main] boot engine:', err);
    return;
  }

  setStatus('Pronto — trascina un PDF o clicca "Apri"');
}

boot();
