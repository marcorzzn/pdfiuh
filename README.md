# pdfiuh — PDF Web Reader

Lettore PDF con annotazioni, progettato per GitHub Pages. Offline-first, single-user, ottimizzato anche per hardware legacy.

## Stack

| Layer | Tecnologia |
|---|---|
| Framework UI | Svelte 5 + TypeScript + Vite |
| Rendering PDF | PDF.js v4+ (Web Worker, OffscreenCanvas) |
| Persistenza | Dexie.js + IndexedDB |
| PWA | Service Worker + manifest |
| Export | pdf-lib (PDF embed) + XFDF (sidecar) |

## Cosa fa

- **Carica PDF** via drag & drop o selezione file
- **Rendering** su Canvas con Web Worker (thread separato)
- **Annotazioni**: evidenziazione, note, inchiostro, sottolineatura, barrato
- **Persistenza automatica**: annotazioni salvate in IndexedDB
- **Export**: download XFDF (ri-editabile) o PDF con annotazioni incorporate
- **PWA**: installabile, funziona offline
- **Degradazione adattiva**: rileva hardware e scala le risorse

## Setup

```bash
npm install
npm run dev        # server di sviluppo
npm run build      # build per produzione
npm run preview    # preview build produzione
npm run check      # type check Svelte
npm test           # Vitest
```

## Struttura

```
src/
├── core/            # Logica di business
│   ├── annotation-store.ts    # Dexie.js CRUD
│   ├── annotation-export.ts   # XFDF import/export
│   ├── pdf-export.ts          # pdf-lib: embed annotazioni
│   ├── pdf-loader.ts          # caricamento + hashing PDF
│   └── device-profile.ts      # hardware detection
├── workers/         # Web Workers
│   ├── pdf-renderer.worker.ts # rendering off-main-thread
│   └── search.worker.ts       # full-text search (v2)
├── ui/              # Componenti Svelte
│   ├── Viewer.svelte          # Canvas + navigazione
│   ├── Toolbar.svelte         # Zoom, annotazioni, salvataggio
│   ├── AnnotationLayer.svelte # SVG overlay
│   ├── Sidebar.svelte         # Lista annotazioni
│   └── DropZone.svelte        # Drag & drop apertura PDF
├── stores/          # Svelte stores
│   ├── viewer.store.ts        # pagina, zoom, rotazione
│   ├── annotations.store.ts   # annotazioni in memoria
│   └── pdf.store.ts           # buffer PDF corrente
└── styles/
    ├── global.css             # Variabili CSS, reset
    └── themes.css             # Tema chiaro/scuro
```

## Roadmap

- **Fase 1** — Rendering base + navigazione
- **Fase 2** — Annotazioni + persistenza IndexedDB
- **Fase 3** — Export XFDF + pdf-lib
- **Fase 4** — PWA + ottimizzazioni low-end
- **Fase 5** — Ricerca full-text (Lunr.js)
