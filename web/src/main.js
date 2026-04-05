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

import init, { PdfWebEngine } from '../pkg/pdfiuh_core.js';
import { openDb, savePageAnnotations, loadPageAnnotations } from './db.js';

// =====================
// CONSTANTS
// =====================

/** Strumenti di annotazione selezionabili dall'utente. */
const Tool = Object.freeze({
  NONE:      'none',
  HIGHLIGHT: 'highlight',
  INK:       'ink',
  NOTE:      'note',
});

const ZOOM_STEPS = [0.5, 1.0, 1.5, 2.0];

// =====================
// DOCUMENT MODEL
// =====================

/** Stato globale dell'applicazione — tutto in un unico oggetto. */
const state = {
  /** Numero totale di pagine del documento corrente */
  pageCount: 0,
  /** Pagina corrente (1-indexed) */
  currentPage: 1,
  /** Indice scala di rendering corrente in ZOOM_STEPS */
  zoomIndex: 1, // Default: 1.0
  /** Strumento attivo */
  tool: Tool.NONE,
  /** Hash identificativo del documento corrente (per chiavi IndexedDB) */
  docHash: '',
};

const inputState = {
  isPointerDown: false,
  isPanning: false,
  panOffsetX: 0,
  panOffsetY: 0,
  panStartX: 0,
  panStartY: 0,
  highlightStart: null,
  inkColor: '#e63946',
  inkThickness: 2.5,
  highlightColor: { r: 137, g: 87, b: 229, a: 128 },
};

function currentScale() {
  return ZOOM_STEPS[state.zoomIndex];
}

// Riferimenti DOM
const canvas    = /** @type {HTMLCanvasElement} */ (document.getElementById('pdf-canvas'));
const glassPane = /** @type {HTMLCanvasElement} */ (document.getElementById('glass-pane'));
const ctx       = canvas.getContext('2d');
const glassCtx  = glassPane.getContext('2d');
const statusEl  = document.getElementById('status');
const fileInput = document.getElementById('file-input');
const dndOverlay= document.getElementById('dnd-overlay');
const pageInfoEl = document.getElementById('page-info');
const zoomInfoEl = document.getElementById('zoom-info');

// =====================
// CORE ENGINE
// =====================

const pdfEngine = {
  worker: null,
  wasmEngine: null,
  isRendering: false,
};

/**
 * Crea il Web Worker che gestisce PDF.js.
 * Il Worker è isolato: non ha accesso al DOM né allo stato globale.
 */
function spawnPdfWorker() {
  pdfEngine.worker = new Worker(
    new URL('./pdf-worker.js', import.meta.url),
    { type: 'module' }
  );

  pdfEngine.worker.addEventListener('message', onWorkerMessage);
  pdfEngine.worker.addEventListener('error', (e) => {
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
      renderPage(state.currentPage);
      break;

    case 'RENDERED': {
      const { bitmap, width, height } = e.data;
      canvas.width  = width;
      canvas.height = height;
      glassPane.width  = width;
      glassPane.height = height;

      // Ensure CSS size matches internal resolution
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      glassPane.style.width = `${width}px`;
      glassPane.style.height = `${height}px`;

      ctx.drawImage(bitmap, 0, 0);
      bitmap.close(); // Libera immediatamente la memoria GPU.

      const viewerContainer = document.getElementById('viewer-container');
      if (viewerContainer && !viewerContainer.classList.contains('visible')) {
        viewerContainer.classList.add('visible');
      }

      redrawAnnotations();
      setStatus(`Pagina ${state.currentPage} / ${state.pageCount}`);
      pdfEngine.isRendering = false;
      break;
    }

    case 'LOAD_ERROR':
      setStatus(`Errore caricamento PDF: ${e.data.message}`, true);
      break;

    case 'RENDER_ERROR':
      setStatus(`Errore rendering pagina ${e.data.pageIndex + 1}: ${e.data.message}`, true);
      pdfEngine.isRendering = false;
      break;

    default:
      console.warn('[main] Messaggio Worker sconosciuto:', type);
  }
}

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

    // Reset panning
    inputState.panOffsetX = 0;
    inputState.panOffsetY = 0;
    applyPan();

    updateNavUI();

    // Trasferisce il buffer al Worker: operazione zero-copy.
    const buffer = await file.arrayBuffer();
    pdfEngine.worker.postMessage({ type: 'LOAD', buffer }, [buffer]);

    // Inizializza (o resetta) il motore WASM per la pagina 1.
    if (pdfEngine.wasmEngine) {
      pdfEngine.wasmEngine.set_page(1);
    }

    // Prova a ripristinare le annotazioni salvate per la pagina 1.
    await restoreAnnotations(1);
  } catch (err) {
    setStatus(`Errore irreversibile caricamento file: ${err.message}`, true);
  }
}

/**
 * Calcola un hash SHA-256 troncato del file per usarlo come chiave DB.
 * @param {File} file
 * @returns {Promise<string>}
 */
async function computeFileHash(file) {
  try {
    const slice  = file.slice(0, 65_536);
    const buffer = await slice.arrayBuffer();
    const digest = await crypto.subtle.digest('SHA-256', buffer);
    return Array.from(new Uint8Array(digest))
      .slice(0, 8)
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  } catch {
    return `${file.name}-${file.size}`;
  }
}

// =====================
// RENDERING PIPELINE
// =====================

/**
 * Ordina al Worker di renderizzare la pagina alla scala corrente.
 * @param {number} pageNum
 */
function renderPage(pageNum) {
  if (!pdfEngine.worker || state.pageCount === 0 || pdfEngine.isRendering) return;
  pdfEngine.isRendering = true;
  setStatus(`Rendering pagina ${pageNum}…`);
  pdfEngine.worker.postMessage({
    type:      'RENDER',
    pageIndex: pageNum - 1,
    scale:     currentScale(),
  });
}

function updateNavUI() {
  pageInfoEl.textContent = `Pagina [ ${state.pageCount > 0 ? state.currentPage : 0} ] di [ ${state.pageCount} ]`;
  zoomInfoEl.textContent = `${currentScale().toFixed(1)}x`;
}

/**
 * Naviga alla pagina indicata (Sumatra-style, clamp limits)
 * @param {number} newPage
 */
async function goToPageSafe(newPage) {
  const clamped = Math.max(1, Math.min(newPage, state.pageCount));
  if (clamped === state.currentPage || state.pageCount === 0) return;

  // Salva le annotazioni della pagina che si sta lasciando.
  await saveAnnotations();

  state.currentPage = clamped;
  updateNavUI();

  // Inizializza il motore per la nuova pagina.
  if (pdfEngine.wasmEngine) {
    pdfEngine.wasmEngine.set_page(clamped);
    await restoreAnnotations(clamped);
  }

  renderPage(clamped);
}

function changeZoom(step) {
    const newIndex = state.zoomIndex + step;
    if (newIndex >= 0 && newIndex < ZOOM_STEPS.length) {
        state.zoomIndex = newIndex;
        updateNavUI();
        renderPage(state.currentPage);
    }
}

function applyPan() {
  const transform = `translate(${inputState.panOffsetX}px, ${inputState.panOffsetY}px)`;
  canvas.style.transform = transform;
  glassPane.style.transform = transform;
}


// =====================
// ANNOTATION ENGINE
// =====================

/**
 * Ridisegna tutte le annotazioni del layer corrente sul glass pane.
 * Chiamato dopo ogni render PDF e dopo ogni modifica alle annotazioni.
 */
const annotationsEngine = {
  redraw() {
    glassCtx.clearRect(0, 0, glassPane.width, glassPane.height);

    if (!pdfEngine.wasmEngine || pdfEngine.wasmEngine.annotation_count() === 0) return;

    try {
      const bytes = pdfEngine.wasmEngine.serialize_annotations();
      glassCtx.save();
      glassCtx.font = '12px monospace';
      glassCtx.fillStyle = 'rgba(137, 87, 229, 0.8)'; // GitHub purple
      glassCtx.fillText(`Layer: ${pdfEngine.wasmEngine.annotation_count()} annotaz. (${bytes.length}B)`, 8, 16);
      glassCtx.restore();
    } catch (err) {
      console.error('[main] redrawAnnotations:', err);
    }
  },

  async save() {
    if (!pdfEngine.wasmEngine || !state.docHash) return;
    try {
      const bytes = pdfEngine.wasmEngine.serialize_annotations();
      await savePageAnnotations(state.docHash, state.currentPage, bytes);
    } catch (err) {
      console.error('[main] saveAnnotations:', err);
    }
  },

  async restore(page) {
    if (!pdfEngine.wasmEngine || !state.docHash) return;

    try {
      const bytes = await loadPageAnnotations(state.docHash, page);
      if (bytes instanceof Uint8Array && bytes.length > 0) {
        pdfEngine.wasmEngine.set_page(page);
        pdfEngine.wasmEngine.force_deserialize_annotations(bytes);
      } else {
          if (pdfEngine.wasmEngine.annotation_count() > 0) {
              pdfEngine.wasmEngine.clear_annotations();
          }
      }
    } catch (err) {
      console.warn('[main] restoreAnnotations:', err);
      if (pdfEngine.wasmEngine && pdfEngine.wasmEngine.annotation_count() > 0) {
          pdfEngine.wasmEngine.clear_annotations();
      }
    }
  }
};

function redrawAnnotations() {
  annotationsEngine.redraw();
}
async function saveAnnotations() {
  await annotationsEngine.save();
}
async function restoreAnnotations(page) {
  await annotationsEngine.restore(page);
}

/**
 * Converte le coordinate del pointer (in pixel CSS) in punti PDF alla scala 1.0,
 * tenendo conto delle dimensioni reali del canvas e della scala.
 * @param {MouseEvent|PointerEvent} e
 * @returns {{ x: number, y: number }}
 */
function screenToPdfCoords(e) {
  const rect = canvas.getBoundingClientRect();

  // Convert from screen CSS pixels to Canvas internal resolution pixels
  const xCanvas = (e.clientX - rect.left) * (canvas.width / rect.width);
  const yCanvas = (e.clientY - rect.top) * (canvas.height / rect.height);

  // Normalize according to viewport scale so WASM always gets standard 1.0 coords
  const scale = currentScale();
  return {
    x: xCanvas / scale,
    y: (canvas.height - yCanvas) / scale // Standard PDF logic often inverts Y, user requested this!
  };
}

// =====================
// UI LAYER
// =====================

function setStatus(msg, isError = false) {
  statusEl.textContent = msg;
  statusEl.style.color = isError ? '#e63946' : '#8b949e';
}

function selectTool(tool) {
  state.tool = tool;
  const cursors = {
    [Tool.NONE]:      'default',
    [Tool.HIGHLIGHT]: 'crosshair',
    [Tool.INK]:       'crosshair',
    [Tool.NOTE]:      'cell',
  };
  glassPane.style.cursor = cursors[tool] ?? 'default';

  document.querySelectorAll('[data-tool]').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.tool === tool);
  });
}

function bindEvents() {
  // Input file
  if (fileInput) {
    fileInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (file) loadPdfFile(file);
      e.target.value = '';
    });
  }
  if (openBtn) openBtn.addEventListener('click', () => fileInput?.click());

  // Drag-and-drop
  let dragCounter = 0;
  document.body.addEventListener('dragenter', (e) => {
      e.preventDefault();
      dragCounter++;
      dndOverlay.classList.add('active');
  });
  document.body.addEventListener('dragover', (e) => e.preventDefault());
  document.body.addEventListener('dragleave', (e) => {
      e.preventDefault();
      dragCounter--;
      if (dragCounter === 0) dndOverlay.classList.remove('active');
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

  // Bottoni toolbar
  document.querySelectorAll('[data-tool]').forEach((btn) => {
    btn.addEventListener('click', () => selectTool(btn.dataset.tool));
  });

  const prevBtn = document.getElementById('prev-btn');
  const nextBtn = document.getElementById('next-btn');
  if (prevBtn) prevBtn.addEventListener('click', () => goToPageSafe(state.currentPage - 1));
  if (nextBtn) nextBtn.addEventListener('click', () => goToPageSafe(state.currentPage + 1));

  const zoomInBtn = document.getElementById('zoom-in-btn');
  const zoomOutBtn = document.getElementById('zoom-out-btn');
  if (zoomInBtn) zoomInBtn.addEventListener('click', () => changeZoom(1));
  if (zoomOutBtn) zoomOutBtn.addEventListener('click', () => changeZoom(-1));

  const clearBtn = document.getElementById('clear-btn');
  if (clearBtn) {
      clearBtn.addEventListener('click', async () => {
          if (!pdfEngine.wasmEngine) return;
          if (confirm("Vuoi davvero cancellare tutte le annotazioni in questa pagina?")) {
              pdfEngine.wasmEngine.clear_annotations();
              redrawAnnotations();
              await saveAnnotations();
          }
      });
  }

  // Navigazione: Sumatra-style (Scroll + Keyboard)
  let wheelAccumulator = 0;
  let lastWheelTrigger = 0;

  window.addEventListener('wheel', (e) => {
    // Avoid interfering with zoom (Ctrl+Wheel) or when no doc is loaded
    if (e.ctrlKey || state.pageCount === 0) return;

    // Prevent default scroll behavior
    e.preventDefault();

    const now = performance.now();
    wheelAccumulator += e.deltaY;

    if (Math.abs(wheelAccumulator) < 50) return;
    if (now - lastWheelTrigger < 140) return;

    if (wheelAccumulator > 0) {
      goToPageSafe(state.currentPage + 1);
    } else {
      goToPageSafe(state.currentPage - 1);
    }

    wheelAccumulator = 0;
    lastWheelTrigger = now;
  }, { passive: false });

  window.addEventListener('keydown', (e) => {
    if (e.target.tagName === 'INPUT') return;

    switch (e.key) {
      case 'ArrowDown':
      case 'PageDown':
        e.preventDefault();
        goToPageSafe(state.currentPage + 1);
        break;
      case 'ArrowUp':
      case 'PageUp':
        e.preventDefault();
        goToPageSafe(state.currentPage - 1);
        break;
      case 'Escape':
        if (pdfEngine.wasmEngine && inputState.isPointerDown) {
          pdfEngine.wasmEngine.discard_freehand();
          inputState.isPointerDown = false;
          inputState.highlightStart = null;
          redrawAnnotations();
        }
        break;
    }
  });

  // Annotazioni: Glass Pane pointer events
  glassPane.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return; // Solo tasto sinistro.
    if (!pdfEngine.wasmEngine || state.tool === Tool.NONE) return;

    inputState.isPointerDown = true;
    glassPane.setPointerCapture(e.pointerId);

    const { x, y } = screenToPdfCoords(e);

    if (state.tool === Tool.INK) {
      pdfEngine.wasmEngine.add_freehand_point(x, y);

      // Need a way to visualize current ink since redrawAnnotations only redraws committed.
      // But for this simple refactor, redrawAnnotations displays text placeholders for now.
    }

    if (state.tool === Tool.NOTE) {
      const text = window.prompt('Testo della nota:');
      if (text && text.trim() !== '') {
        pdfEngine.wasmEngine.add_sticky_note(x, y, text.trim());
        redrawAnnotations();
        saveAnnotations();
      }
      inputState.isPointerDown = false;
    }
  });

  glassPane.addEventListener('pointermove', (e) => {
    if (!inputState.isPointerDown || !pdfEngine.wasmEngine) return;

    const { x, y } = screenToPdfCoords(e);

    if (state.tool === Tool.INK) {
      pdfEngine.wasmEngine.add_freehand_point(x, y);
      const pts = pdfEngine.wasmEngine.freehand_point_count();
      // To draw the preview on the glassPane (which is at viewport scale, inverted Y)
      // we need a quick way, or just trigger redrawAnnotations!
      redrawAnnotations();
    }

    if (state.tool === Tool.HIGHLIGHT) {
      if (inputState.highlightStart) {
        const { x: sx, y: sy } = inputState.highlightStart;
        const width = Math.abs(x - sx);
        const height = Math.abs(y - sy);

        glassCtx.clearRect(0, 0, glassPane.width, glassPane.height);
        redrawAnnotations();

        const scale = currentScale();
        const drawX = Math.min(sx, x) * scale;
        const drawY = canvas.height - (Math.max(sy, y) * scale); // Convert inverted Y back to screen Y

        const { r, g, b, a } = inputState.highlightColor;
        glassCtx.fillStyle = `rgba(${r},${g},${b},${a / 255})`;
        glassCtx.fillRect(drawX, drawY, width * scale, height * scale);
      }
    }
  });

  glassPane.addEventListener('pointerup', async (e) => {
    if (!inputState.isPointerDown || !pdfEngine.wasmEngine) return;
    inputState.isPointerDown = false;

    const { x, y } = screenToPdfCoords(e);

    switch (state.tool) {
      case Tool.INK: {
        const committed = pdfEngine.wasmEngine.commit_freehand(
          parseInt(inputState.inkColor.slice(1, 3), 16),
          parseInt(inputState.inkColor.slice(3, 5), 16),
          parseInt(inputState.inkColor.slice(5, 7), 16),
          255, inputState.inkThickness
        );
        if (committed) {
          redrawAnnotations();
          await saveAnnotations();
        }
        break;
      }
      case Tool.HIGHLIGHT: {
        if (inputState.highlightStart) {
          const { x: sx, y: sy } = inputState.highlightStart;
          const w = x - sx;
          const h = y - sy;
          if (Math.abs(w) > 4 && Math.abs(h) > 4) {
            const { r, g, b, a } = inputState.highlightColor;
            pdfEngine.wasmEngine.add_highlight_colored(
              Math.min(sx, x), Math.min(sy, y),
              Math.abs(w), Math.abs(h), r, g, b, a
            );
            redrawAnnotations();
            await saveAnnotations();
          }
          inputState.highlightStart = null;
        }
        break;
      }
    }
  });

  glassPane.addEventListener('pointerdown', (e) => {
    if (state.tool === Tool.HIGHLIGHT && e.button === 0) {
      inputState.highlightStart = screenToPdfCoords(e);
    }
  }, { capture: true });

  window.addEventListener('pointercancel', () => {
    if (pdfEngine.wasmEngine && inputState.isPointerDown && state.tool === Tool.INK) {
      pdfEngine.wasmEngine.discard_freehand();
    }
    inputState.isPointerDown = false;
    inputState.highlightStart = null;
  });

  // Pan (Middle Click / Space + Drag)
  const viewerContainer = document.getElementById('viewer-container');
  let spacePressed = false;

  window.addEventListener('keydown', (e) => {
    if (e.code === 'Space' && e.target.tagName !== 'INPUT') {
      e.preventDefault();
      spacePressed = true;
      glassPane.style.cursor = 'grab';
    }
  });
  window.addEventListener('keyup', (e) => {
    if (e.code === 'Space') {
      spacePressed = false;
      glassPane.style.cursor = state.tool === Tool.NONE ? 'default' : 'crosshair';
    }
  });

  viewerContainer.addEventListener('mousedown', (e) => {
    if (e.button === 1 || spacePressed) {
      e.preventDefault();
      inputState.isPanning = true;
      inputState.panStartX = e.clientX - inputState.panOffsetX;
      inputState.panStartY = e.clientY - inputState.panOffsetY;
      glassPane.style.cursor = 'grabbing';
    }
  });

  window.addEventListener('mousemove', (e) => {
    if (!inputState.isPanning) return;
    e.preventDefault();
    inputState.panOffsetX = e.clientX - inputState.panStartX;
    inputState.panOffsetY = e.clientY - inputState.panStartY;
    applyPan();
  });

  window.addEventListener('mouseup', (e) => {
    if (inputState.isPanning) {
      inputState.isPanning = false;
      glassPane.style.cursor = spacePressed ? 'grab' : (state.tool === Tool.NONE ? 'default' : 'crosshair');
    }
  });

  window.addEventListener('beforeunload', () => saveAnnotations());
}

// =====================
// BOOTSTRAP
// =====================

/**
 * Inizializza l'applicazione.
 */
async function boot() {
  setStatus('Caricamento modulo WASM…');
  try {
    await init();
  } catch (err) {
    setStatus(`Errore WASM: ${err.message}`, true);
    return;
  }

  spawnPdfWorker();

  try {
    pdfEngine.wasmEngine = new PdfWebEngine(1);
  } catch (err) {
    setStatus(`Errore motore Rust: ${err}`, true);
    return;
  }

  bindEvents();
  setStatus('Pronto — trascina un PDF o clicca "Apri"');
}

const openBtn = document.getElementById('open-btn'); // For bindEvents
boot();
