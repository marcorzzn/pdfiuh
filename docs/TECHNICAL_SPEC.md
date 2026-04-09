# Technical Specification: pdfiuh Web Architecture v3.0

## 1. Executive Summary
**pdfiuh** is a high-performance, offline-first PDF reader and annotation tool. The core objective is to provide a "Microsoft Edge-like" experience within a browser, ensuring the UI remains responsive (60fps) regardless of PDF complexity.

## 2. Core Architectural Pillars

### 2.1 Thread Isolation (The Worker Model)
To prevent main-thread blocking, all heavy PDF operations are delegated to a dedicated Web Worker.
- **Worker Responsibility:** PDF parsing, page rendering, text extraction, and coordinate calculation.
- **Main Thread Responsibility:** UI orchestration, event handling, and DOM updates.
- **Communication:** Asynchronous message passing via `postMessage`.

### 2.2 Rendering Pipeline (The Hybrid Approach)
We employ a dual-layer compositing system:
- **Raster Layer (Background):** 
    - Uses `pdfjs-dist` for rendering.
    - Employs `OffscreenCanvas` within the worker to generate page bitmaps.
    - Bitmaps are transferred to the main thread using `transferToImageBitmap()` for zero-copy performance.
- **Interactive Layer (Foreground):**
    - An **SVG Overlay** perfectly aligned with the raster canvas.
    - All annotations (highlights, ink, notes) are rendered as SVG elements.
    - **Coordinate System:** All positions are stored as normalized percentages (0-1) relative to page dimensions to ensure consistency across zoom levels and screen sizes.

### 2.3 Data Persistence (Offline-First)
The app operates on a "Local-First" principle:
- **Client Storage:** **IndexedDB** (via `Dexie.js`) stores:
    - Raw PDF binary buffers (to avoid re-downloading).
    - Annotation metadata (JSON).
- **Sync Strategy:** Local changes are persisted immediately and synchronized to the backend asynchronously when online.
- **Interoperability:** Support for **XFDF** (XML based) for exporting/importing annotations.

## 3. Implementation Detail

### 3.1 PDF Rendering Flow
1. `Main Thread` $\rightarrow$ `Worker`: `LOAD_PDF` (with ArrayBuffer).
2. `Worker`: Parses PDF $\rightarrow$ Calculates total pages $\rightarrow$ returns metadata.
3. `Main Thread` $\rightarrow$ `Worker`: `RENDER_PAGE` (page number, scale).
4. `Worker`: 
    - Obtains page from PDF.js.
    - Renders to `OffscreenCanvas`.
    - `transferToImageBitmap()` $\rightarrow$ `Main Thread`.
5. `Main Thread`: Draws bitmap to the screen.

### 3.2 Annotation Lifecycle
1. **Creation:** User draws on SVG layer $\rightarrow$ Coordinates normalized $\rightarrow$ Saved to IndexedDB.
2. **Rendering:** App reads IndexedDB $\rightarrow$ Maps normalized coords to current canvas size $\rightarrow$ Renders SVG elements.
3. **Export:** `pdf-lib` is used to embed these annotations back into a physical PDF file for download.

## 4. GitHub Pages Optimization
- **Base Path:** Configured via `vite.config.ts` to match the repository name.
- **PWA:** Service Worker caches the `pdf.worker.js` and application assets.
- **Deployment:** Automated via GitHub Actions.

## 5. Performance KPIs
- **Time to First Page (TTFP):** $< 500\text{ms}$ for standard documents.
- **UI Frame Rate:** Stable $60\text{fps}$ during scroll/zoom.
- **Memory Footprint:** Optimized via LRU cache for rendered page bitmaps.
