import React, { useEffect, useRef, useState } from 'react';
import * as pdfjsLib from 'pdfjs-dist';

// Use standard worker for pdf.js
pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;

const PdfViewer = ({ fileUrl }) => {
  const canvasRef = useRef(null);
  const overlayRef = useRef(null);
  const [engine, setEngine] = useState(null);

  useEffect(() => {
    // Caricamento del modulo WASM
    const loadWasm = async () => {
      try {
        const wasm = await import('../pkg/pdfiuh_core.js');
        await wasm.default(); // Initialize the wasm module
        const engineInstance = new wasm.PdfWebEngine(1);
        setEngine(engineInstance);
        console.log("WASM Engine loaded.");
      } catch (err) {
        console.error("Failed to load WASM engine:", err);
      }
    };
    loadWasm();
  }, []);

  useEffect(() => {
    const loadPdf = async () => {
      if (!fileUrl) return;

      const loadingTask = pdfjsLib.getDocument(fileUrl);
      const pdf = await loadingTask.promise;
      const page = await pdf.getPage(1);

      const viewport = page.getViewport({ scale: 1.5 });
      const canvas = canvasRef.current;
      const context = canvas.getContext('2d');
      canvas.height = viewport.height;
      canvas.width = viewport.width;

      const renderContext = {
        canvasContext: context,
        viewport: viewport,
      };

      await page.render(renderContext).promise;

      if (overlayRef.current) {
        overlayRef.current.height = viewport.height;
        overlayRef.current.width = viewport.width;
      }
    };

    loadPdf();
  }, [fileUrl]);

  const handlePointerDown = (e) => {
    if (!engine) return;
    const rect = overlayRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    engine.add_freehand_point(x, y);
    console.log("Pointer down", x, y);
  };

  const handlePointerUp = (e) => {
    if (!engine) return;
    engine.commit_freehand(255, 0, 0, 255, 2.0);
    console.log("Pointer up - committed freehand stroke");
  };

  return (
    <div style={{ position: 'relative', display: 'inline-block' }}>
      {/* Background raster canvas (PDF rendering) */}
      <canvas ref={canvasRef} style={{ display: 'block' }} />
      {/* Foreground vector canvas (Annotations & Interaction) */}
      <canvas
        ref={overlayRef}
        style={{ position: 'absolute', top: 0, left: 0, touchAction: 'none' }}
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
      />
    </div>
  );
};

export default PdfViewer;
