# pdfiuh

[![Deploy to GitHub Pages](https://github.com/marcorzzn/pdfiuh/actions/workflows/deploy.yml/badge.svg)](https://github.com/marcorzzn/pdfiuh/actions)
[![Live Demo](https://img.shields.io/badge/Live_Demo-marcorzzn.github.io%2Fpdfiuh-blue?style=for-the-badge)](https://marcorzzn.github.io/pdfiuh/)

**pdfiuh** è ora un lettore PDF Web e strumento di annotazione ultra-leggero, potenziato da un core vettoriale in **Rust** compilato via **WebAssembly (WASM)**.

👉 **[Prova pdfiuh direttamente nel browser!](https://marcorzzn.github.io/pdfiuh/)**

## Descrizione (Web Edition Pivot)

A seguito di un pivot architetturale strategico, il focus primario di `pdfiuh` è la Web Edition. Il software garantisce prestazioni estreme e massima fluidità anche in hardware fortemente vincolati (es. single-core, <2GB RAM), pur offrendo complete funzionalità per la lettura dei documenti e l'annotazione (Freehand, evidenziatore, ecc).

Il sistema sfrutta un approccio ibrido unico:
1.  Il rendering raster e la gestione dei file PDF sono delegati asincronamente in un Web Worker al collaudato motore `pdf.js` per garantire la massima stabilità in Javascript.
2.  L'intera pipeline di annotazioni, logica vettoriale e manipolazione geometrica e interazioni sono computate da un modulo **WebAssembly** generato a partire da codice Rust che funge da core nativo.

## Architettura

Il sistema è basato su tre componenti principali (organizzati come workspace Cargo):
* **core**: Il logic engine scritto in Rust, compilato via `wasm-pack` come libreria WASM. Contiene la logica vettoriale ad alte prestazioni.
* **web**: Frontend basato su **React 19** e **Vite**, ingegnerizzato con un'architettura _"Double Canvas"_ (un canvas di sfondo per i pixel PDF e un overlay trasparente per i vettori WASM interattivi).
* **desktop**: Componente FFI legacy per binding di terze parti e prove di concetto native.

## Prerequisiti Sviluppo

* **Node.js** v20+ e `npm` (per l'ecosistema web).
* **Rust:** Toolchain aggiornata (Edition 2024), con il target configurato per webassembly: `rustup target add wasm32-unknown-unknown` e `wasm-pack`.

## Build (Locale per la Web Edition)

Per sviluppare l'intera applicazione in locale, puoi fare il build sequenziale:

```bash
# 1. Compila il motore Rust in WASM
cd core
wasm-pack build --target web --out-dir ../web/pkg

# 2. Installa le dipendenze web e fai partire il server Vite
cd ../web
npm install
npm run dev
```

## Deployment CI/CD

Ogni push sul branch `main` innescherà automaticamente una GitHub Action che compilerà il core in WASM, farà il bundle del frontend Vite e aggiornerà la release su **GitHub Pages** al link soprastante. Tutto il carico computazionale viene evitato sulle macchine locali degli sviluppatori!

## Licenza

Questo progetto è rilasciato sotto la licenza AGPL-3.0-only.