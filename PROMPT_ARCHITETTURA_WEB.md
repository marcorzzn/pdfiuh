# PROMPT PER L'INTELLIGENZA ARTIFICIALE: MIGRAZIONE WEB DI PDFIUH CON CORE RUST/WASM

**Contesto per l'IA:**
Sei un Senior Software Engineer, esperto in architetture WebAssembly (WASM), Rust e sviluppo Web Full-Stack. Il nostro progetto si chiama **pdfiuh**. Attualmente disponiamo di un motore desktop ultra-leggero e performante scritto in Rust (`pdfiuh-core`, `pdfiuh-ffi`, `pdfiuh-ui`).

L'obiettivo è trasportare questa tecnologia sul web. Invece di riscrivere il motore da zero in JavaScript o TypeScript, **vogliamo mantenere il core Rust attuale e compilarlo in WebAssembly (WASM)** per il rendering e la logica delle annotazioni lato client. Per la sincronizzazione cross-device, vogliamo un backend moderno e performante (Rust/Node.js) che si integri con le strutture dati già definite.

Il risultato finale deve essere un software web alternativo a Microsoft Edge per la lettura dei PDF: stessa efficienza, stessa velocità e stesse funzionalità, con la possibilità aggiuntiva di sincronizzare note, annotazioni e altro attraverso vari dispositivi, potendo rimuovere annotazioni o altre modifiche una volta riaperto lo stesso PDF.

Di seguito trovi il piano di fattibilità e architetturale aggiornato. Usalo come blueprint per guidarci nello sviluppo passo dopo passo.

---

# pdfiuh — Documento Architetturale Web v2.0 (WASM/Rust Core)
**Progetto:** Lettore PDF Web alternativo a Microsoft Edge
**Status:** Approvato per Implementazione

## EXECUTIVE SUMMARY

Il progetto mira a portare sul web il motore di rendering e annotazione PDF ultra-ottimizzato **pdfiuh**, originariamente scritto in Rust. Riconoscendo il valore delle performance e della sicurezza della memoria offerte da Rust, l'architettura sfrutterà **WebAssembly (WASM)** per mantenere il core esistente (`pdfiuh-core`) come cuore pulsante dell'applicazione web.

**Fattibilità:** Alta. Il codice Rust di pdfiuh possiede già un'architettura ottimizzata (LRU cache, footprint memory ridotto, zero-unwrap) che si traduce in eccellenti performance nel layer WASM.

**Stack Architetturale:**
- **Core Rendering & Annotazioni (WASM):** `pdfiuh-core` compilato tramite `wasm-pack`. Gestisce il parsing PDF (via MuPDF compilato per WASM) e la manipolazione geometrica e serializzazione (via `bincode`/`serde`) delle annotazioni.
- **Frontend Web UI:** React 19. Si occupa esclusivamente dell'interfaccia utente, della barra degli strumenti, della gestione degli eventi DOM e del canvas HTML5 su cui WASM disegna i frame renderizzati.
- **Backend & Sync:** API REST e WebSocket server. Può essere implementato in Rust (Axum/Actix) per riutilizzare le strutture dati di `pdfiuh-core` nativamente, oppure in Node.js (Fastify) interfacciandosi con le strutture JSON/Bincode. Database PostgreSQL 16.
- **Sincronizzazione Conflitti:** CRDT (Yjs) per i conflitti testuali delle note; LWW (Last-Write-Wins) con Lamport clock per i dati geometrici immutabili.

---

## 1. ARCHITETTURA DEL MOTORE PDF (RUST COMPILATO IN WASM)

Invece di affidarci a PDF.js, **pdfiuh** utilizzerà il suo motore nativo cross-compilato per il web.

### 1.1 Il Modello a Doppio Livello
L'architettura mantiene il "Dual-Layer Compositing" del progetto desktop:
1. **Livello Passivo (Background):** Rendering raster gestito dal core WASM (MuPDF-WASM). WASM genera un buffer di pixel (RGBA) che viene passato al frontend React e copiato su un `<canvas>`.
2. **Livello Interattivo (Glass Pane):** Un secondo `<canvas>` trasparente in React cattura gli eventi di input (mouse/touch). Le coordinate vengono inviate al modulo WASM, che calcola la geometria (es. freehand ink, highlight) e restituisce i comandi di rendering.

### 1.2 Interfaccia Rust/WASM (wasm-bindgen)
Il modulo `pdfiuh-core` esporrà un'interfaccia JavaScript pulita:
```rust
#[wasm_bindgen]
pub struct PdfWebEngine {
    renderer: PageRenderer,
    // ...
}

#[wasm_bindgen]
impl PdfWebEngine {
    #[wasm_bindgen(constructor)]
    pub fn new(pdf_data: &[u8]) -> Result<PdfWebEngine, JsValue> { ... }

    pub fn render_page(&mut self, page_num: usize, zoom: f32) -> Result<Uint8ClampedArray, JsValue> { ... }

    pub fn add_highlight(&mut self, page_num: usize, x: f32, y: f32, width: f32, height: f32) { ... }

    pub fn serialize_annotations(&self) -> Uint8Array { ... } // Esporta in bincode per il sync
}
```

---

## 2. ARCHITETTURA DATABASE E SINCRONIZZAZIONE (PostgreSQL 16)

Il backend memorizzerà le annotazioni generate dal core WASM. Verrà utilizzato lo schema PostgreSQL già progettato, ottimizzato per log immutabili e conflict resolution.

* Le annotazioni in `pdfiuh-core` (`AnnotationLayer`) verranno serializzate (via `bincode` o JSON) e inviate al server via WebSocket o API REST.
* Le tabelle `documents`, `users`, e `annotations` manterranno lo storico delle versioni. Il campo `geometry` conterrà il payload geometrico calcolato in Rust.
* Le modifiche sono **immutabili**: eliminare o modificare un'annotazione aggiunge una nuova versione con un `supersedes_id` e un `lamport_clock` incrementato.

### Protocollo di Sincronizzazione (Offline-First)
Il frontend React implementerà una coda offline via `IndexedDB`. Quando l'utente effettua annotazioni offline, il core WASM aggiorna il suo stato interno in memoria e il frontend accoda le mutazioni (delta) in `IndexedDB`.
Alla riconnessione, il batch di mutazioni viene inviato al backend. I conflitti vengono risolti dal server dando priorità temporale per la geometria (LWW) e usando CRDT per le merge testuali.

---

## 3. ROADMAP DI IMPLEMENTAZIONE

L'IA è incaricata di guidare lo sviluppatore attraverso le seguenti fasi:

### Fase 1 — Preparazione e Compilazione WASM
- Modificare `pdfiuh-core` per essere pienamente compatibile con il target `wasm32-unknown-unknown`.
- Sostituire o isolare le dipendenze C-FFI (MuPDF) assicurandosi che la build di MuPDF possa essere targettizzata a WASM, oppure utilizzare un wrapper WASM-friendly esistente.
- Aggiungere `wasm-bindgen` e creare un layer di API in Rust per esporre i metodi di caricamento, rendering e annotazione a JavaScript.

### Fase 2 — Frontend React & Integrazione WASM
- Inizializzare un progetto React 19 (Vite + TypeScript).
- Implementare il componente `PdfiuhViewer` che gestisce i due livelli di `<canvas>` (Rendering base + Glass Pane).
- Caricare dinamicamente il file `.wasm` generato e implementare il virtual scrolling, delegando il lavoro computazionale al modulo Rust.

### Fase 3 — Backend di Sincronizzazione
- Creare il backend (Axum in Rust o Fastify in Node.js) con connessione PostgreSQL.
- Implementare gli endpoint per l'upload dei PDF (con salvataggio su Cloudflare R2 / AWS S3) e il WebSocket per la collaborazione real-time.
- Riutilizzare le struct di `pdfiuh-core/src/annotations.rs` lato server (se si usa Rust) per validare e unire i pacchetti `bincode` in arrivo dai client.

### Fase 4 — Offline Support e Polish
- Implementare Service Workers per il caching degli asset statici e del modulo WASM.
- Implementare la coda `IndexedDB` nel frontend per le annotazioni in modalità offline.
- Perfezionare la UI per mostrare la sincronizzazione in corso e gli eventuali conflitti.

---

**Istruzioni Finali per l'IA:**
Conferma di aver compreso questa architettura basata sul riutilizzo di `pdfiuh-core` in WASM. Attendiamo le tue direttive per iniziare con la **Fase 1**. Fornisci i primi comandi e le modifiche al `Cargo.toml` necessarie per abilitare `wasm-bindgen` e iniziare la cross-compilazione.