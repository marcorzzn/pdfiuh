# THE PDFIUH CODEX: MASTER TECHNICAL & OPERATIONAL DOCUMENTATION
**Versione:** 1.0 (Unified Master File)
**Progetto:** `pdfiuh` - Lettore PDF nativo, ultra-leggero e ad alte prestazioni.

---

## PARTE 1: VISIONE ARCHITETTONICA E VINCOLI DI SISTEMA

### 1.1 Baseline Hardware (Il "Target Zero")
Il software è ingegnerizzato per garantire prestazioni estreme sul limite inferiore dell'hardware operativo globale. Il target di riferimento è bloccato sulle specifiche fisiche di un eMachines eM355 con sistema operativo Windows 7 Starter (32-bit): processore Intel Atom N455 @ 1.66GHz (1 core logico / 2 thread) e rigorosamente 2,00 GB di memoria RAM fisica totale.
* **Limiti di Memoria:** Consumo in stato di idle < 30 MB. RAM operativa massima in fase di picco ~940 MB.
* **Storage I/O:** Ottimizzato per dischi meccanici. Nessuna scrittura in background; salvataggio solo su comando esplicito.

### 1.2 Stack Tecnologico
* **Core Logic:** Rust (Edition 2024). Assenza di Garbage Collector, memory safety a livello di compilatore.
* **Motore PDF (Fase FFI):** MuPDF C-bindings. Moduli superflui (XPS, EPUB, JS) disabilitati in fase di compilazione. Allocazione di memoria deviata su `mimalloc` per prevenire la frammentazione.
* **UI Desktop:** Slint UI. Framework nativo leggerissimo, rendering via CPU o accelerazione GPU di base. Nessuna dipendenza web.

### 1.3 Dual-Layer Compositing (Glass Pane)
L'interfaccia si divide in due livelli per garantire 60 fps durante le annotazioni:
1.  **Livello Passivo (Background):** Rendering raster bitmap della pagina PDF gestito da MuPDF.
2.  **Livello Interattivo (Glass Pane):** Canvas vettoriale trasparente gestito da Slint UI per evidenziazioni, post-it e free-hand ink. I dati vivono in RAM e vengono iniettati nel PDF originale solo al salvataggio.

---

## PARTE 2: IL PARADOSSO DELLA SUPERVISIONE E L'USO DELL'IA

Questo documento abilita lo sviluppo assistito dall'IA, NON lo sviluppo con pilota automatico. 

### 2.1 Requisiti di Validazione (Checkpoint)
Prima di accettare qualsiasi codice generato dall'IA (Jules, Claude, Copilot), il Supervisore Umano deve verificare:
* Il codice compila con zero warning?
* Tutti i test passano?
* I casi di errore sono gestiti esplicitamente (nessun `.unwrap()` nascosto)?
* Il codice `unsafe` è giustificato con commenti `// SAFETY:`?
* Il software gira fluidamente sull'hardware target reale?

### 2.2 Sistema a Semaforo (Triage dei Task)
* 🟢 **Verde (Sicuro per l'IA):** Strutture dati, test unitari, serializzazione, UI Slint di base. Alta percentuale di successo.
* 🟡 **Giallo (IA con cautela):** Binding FFI, logica di rendering, script di build incrociata. Richiede validazione umana attenta.
* 🔴 **Rosso (Solo Umano):** Decisioni architetturali, profilazione memoria, validazione sicurezza. L'IA genera solo il boilerplate.

---

## PARTE 3: IL BOOTCAMP DEL SUPERVISORE (12 SETTIMANE)

Per supervisionare efficacemente l'IA, il Project Manager deve completare un percorso formativo mirato di 300 ore (25h/settimana).

### Fase 1: Rust Fondamentale (Settimane 1-4)
* **Obiettivo:** Comprendere ownership, lifetimes e gestione degli errori.
* **Output Pratico:** `pdf-meta`, un tool CLI per estrarre metadati da file PDF grezzi.
* **Focus:** Sostituire l'uso di `panic!` con `Result<T, E>` tramite il crate `thiserror`.

### Fase 2: FFI e C Interop (Settimane 5-8)
* **Obiettivo:** Gestire la memoria non sicura e collegare librerie esterne.
* **Output Pratico:** Wrapper sicuro in Rust per `libsqlite3` usando i raw pointer.
* **Focus:** Studio del *Rustonomicon*, utilizzo di `bindgen`, rilevamento di memory leak con Valgrind e Miri.

### Fase 3: PDF + UI (Settimane 9-12)
* **Obiettivo:** Combinare parsing e interfaccia.
* **Output Pratico:** "Aether Mini", un visualizzatore base usando crate esistenti e Slint UI.
* **Graduation:** Capacità di leggere 500 righe di Rust intermedio, diagnosticare un segfault e validare codice FFI scritto dall'IA.

---

## PARTE 4: MANUALE OPERATIVO QUOTIDIANO (QUICK REFERENCE)

### 4.1 L'Albero Decisionale (5 Secondi)
"Posso validare l'output che sto chiedendo all'IA?"
* SI ➔ Controlla il colore del task (🟢/🟡) ➔ Procedi.
* NO ➔ FERMATI ➔ Studia il concetto o delega a un esperto umano.

### 4.2 Scorciatoie di Validazione
* **Sicurezza (30s):** `grep -r "unwrap()" src/` (deve essere 0). `grep -r "unsafe" src/ | grep -v "SAFETY"` (deve essere vuoto).
* **Memoria (5m):** Usa Valgrind (`valgrind --leak-check=yes target/debug/pdfiuh-ui`) e cerca sezioni "definitely lost".
* **Performance (2m):** Compila in release (`cargo build --release`). Controlla che il binario sia < 10MB. 

### 4.3 Red Flags (Segnali di Allarme nell'Output IA)
Rifiuta immediatamente il codice generato dall'IA se presenta:
* Uso non documentato di `.unwrap()` o `.expect()`.
* Blocchi `unsafe` senza giustificazione logica.
* Allocazioni dinamiche continue all'interno di cicli chiusi (hot paths).

---

## PARTE 5: JULES MASTER EXECUTION PLAN (SYSTEM PROMPT)

*Da fornire all'agente IA autonomo al momento dell'avvio dello sviluppo.*

**Role:** Senior Rust Systems Engineer
**Project:** Sviluppo di `pdfiuh`, un lettore PDF ultra-leggero.
**Constraint Primario:** Hardware single-core 1.66GHz, max 2GB RAM. Idle RAM < 30MB. Nessun uso di `unwrap()`. Un task alla volta.

### Phase 0: Foundation (Workspace & Licenza)
1. Inizializza un repository Git.
2. Crea un Cargo workspace `pdfiuh` con membri: `pdfiuh-core`, `pdfiuh-ui`, `pdfiuh-ffi`.
3. Configura `Cargo.toml` globale con `license = "AGPL-3.0-only"`. Aggiungi `thiserror`, `anyhow`, `serde` e `mimalloc`.
4. Imposta `mimalloc` come allocatore globale in `pdfiuh-core`.
5. Implementa la gestione errori (`PdfiuhError`) in `pdfiuh-core/src/error.rs`.

### Phase 1: MuPDF Integration (FFI Bindings)
1. Usa `cc` e `bindgen` in `pdfiuh-ffi/build.rs` per compilare MuPDF minimale. Disabilita `FZ_ENABLE_XPS`, `FZ_ENABLE_SVG`, `FZ_ENABLE_EPUB`, `FZ_ENABLE_JS`.
2. Implementa i safe wrapper (`MuPdfContext`, `PdfDocument`) in `pdfiuh-ffi/src/lib.rs`, incapsulando i puntatori grezzi.
3. Implementa i trait `Drop` per la deallocazione sicura della memoria C.

### Phase 2: Slint UI Foundation
1. Crea il layout in `pdfiuh-ui/ui/main.slint` (toolbar, ScrollView).
2. Configura `pdfiuh-ui/src/main.rs` per le callback e la logica di base.
3. Crea `PageRenderer` in `pdfiuh-core/src/render.rs` con una cache LRU limitata a max 20 MB di footprint in RAM.

### Phase 3: Annotazioni (Vector Overlay)
1. Definisci `Point`, `Color`, `Rect`, l'enum `Annotation` e `AnnotationLayer` in `pdfiuh-core/src/annotations.rs`.
2. Implementa `serde` (Serialize, Deserialize) e `bincode` per la persistenza veloce e non distruttiva del Glass Pane in memoria.

### Phase 4: Testing & QA
1. Scrivi test di integrazione in `pdfiuh-core/tests/integration.rs` (apertura, conteggio pagine, render, serializzazione) assumendo fixture nella cartella `tests/fixtures/`.
2. Configura `criterion` per il benchmarking dei colli di bottiglia in `aether-core/benches/memory_profile.rs`.
