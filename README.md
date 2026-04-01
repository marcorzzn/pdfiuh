# pdfiuh

**pdfiuh** è un lettore PDF nativo, ultra-leggero e ad alte prestazioni.

## Descrizione

Il progetto è ingegnerizzato per garantire prestazioni estreme sul limite inferiore dell'hardware operativo globale, ottimizzato specificamente per essere fluido e reattivo in ambienti con scarse risorse di calcolo e memoria, garantendo al contempo robustezza e sicurezza tramite l'impiego del linguaggio Rust.

Il sistema è basato su tre componenti principali (organizzati come workspace Cargo):
* **core**: il motore Rust nativo di elaborazione senza GC.
* **desktop**: componente FFI per i binding a `mupdf` e interfaccia grafica basata su `slint` UI.
* **web**: interfaccia orientata al web e build webassembly.

## Prerequisiti

* **Rust:** Toolchain aggiornata (Edition 2024).

## Build

Per compilare l'intero workspace, naviga nella root e avvia:

```bash
cargo build --release
```

## Struttura del progetto
* `core/`: Il logic engine del progetto, integrato per il parsing PDF e la logica condivisa.
* `desktop/`: Implementazioni desktop, contenente binding FFI (desktop/ffi) e UI (desktop/ui).
* `web/`: Client e binding web-based.
* `assets/`, `docs/`, `scripts/`: Assets grafici, documentazione aggiuntiva e utility scripts.

## Licenza

Questo progetto è rilasciato sotto la licenza AGPL-3.0-only.
