# pdfiuh — PDF Web Reader

Lettore PDF con annotazioni, progettato per GitHub Pages. Offline-first, single-user, ottimizzato anche per hardware legacy.

## Stack

| Layer | Tecnologia |
|---|---|
| UI | Web Components (Custom Elements) + TypeScript + Vite |
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
- **Ricerca full-text**: Ctrl+F con highlighting preciso nel text layer

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
│   └── event-bus.ts           # Pub/Sub system
├── engine/          # Engine modules
│   ├── device-profile.ts      # hardware detection
│   └── pdf-worker.ts          # Web Worker: rendering, text extraction
├── state/           # State management
│   └── store.ts               # Reactive pub/sub store
├── annotations/     # Annotation system
│   ├── engine.ts              # Coordinate conversion utilities
│   ├── export.ts              # XFDF import/export + pdf-lib embed
│   ├── storage.ts             # Dexie.js IndexedDB wrapper
│   └── svg-layer.ts           # SVG annotation overlay (ink, highlight, notes)
├── ui/              # Web Components
│   ├── components/
│   │   ├── find-bar.ts        # Ctrl+F search with precise highlighting
│   │   ├── Sidebar.ts         # Tabbed sidebar (ToC + thumbnails)
│   │   ├── Toolbar.ts         # Main toolbar with tools, zoom, navigation
│   │   └── Viewer.ts          # Virtual scrolling page viewer
│   └── styles/
│       ├── fluent.css         # Fluent Design tokens, light/dark themes
│       ├── toolbar.css        # Toolbar styles
│       └── viewer.css         # Viewer + sidebar styles
└── main.ts          # App entry point, worker message router
```

## Roadmap

- **Fase 1** ✅ Rendering base + navigazione
- **Fase 2** ✅ Annotazioni + persistenza IndexedDB
- **Fase 3** ✅ Export XFDF + pdf-lib
- **Fase 4** ✅ PWA + ottimizzazioni low-end
- **Fase 5** ✅ Ricerca full-text con highlighting preciso
