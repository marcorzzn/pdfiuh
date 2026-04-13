/**
 * pdfiuh Annotation Export
 * Embeds annotations natively into the PDF using pdf-lib, or exports to XFDF.
 */
import { PDFDocument, rgb } from 'pdf-lib';
import { storage } from './storage';
import { toXFDF, parseXFDF } from '../core/annotation-export';
import { store } from '../state/store';

export async function exportPDF(docId: string, pdfBuffer: ArrayBuffer, fileName: string): Promise<void> {
  const pdfDoc = await PDFDocument.load(pdfBuffer);
  const annots = await storage.loadAnnotations(docId);

  if (annots.length === 0) {
    downloadBlob(new Blob([pdfBuffer]), fileName);
    return;
  }

  const pages = pdfDoc.getPages();

  for (const ann of annots) {
    const page = pages[ann.page - 1];
    if (!page) continue;

    const { width, height } = page.getSize();
    const colorRGB = hexToRgb(ann.color || '#000000');

    if (ann.type === 'highlight' && ann.rect) {
      // Draw a rectangle over the text with blend mode
      page.drawRectangle({
        x: ann.rect.x * width,
        y: height - (ann.rect.y + ann.rect.h) * height, // PDF y is inverted
        width: ann.rect.w * width,
        height: ann.rect.h * height,
        color: rgb(colorRGB.r, colorRGB.g, colorRGB.b),
        opacity: ann.opacity || 0.35,
      });
    } else if (ann.type === 'ink' && ann.points && ann.points.length >= 4) {
      // Draw lines
      for (let i = 0; i < ann.points.length - 2; i += 2) {
        page.drawLine({
          start: {
            x: ann.points[i] * width,
            y: height - ann.points[i + 1] * height,
          },
          end: {
            x: ann.points[i + 2] * width,
            y: height - ann.points[i + 3] * height,
          },
          thickness: ann.width || 2,
          color: rgb(colorRGB.r, colorRGB.g, colorRGB.b),
        });
      }
    } else if (ann.type === 'note' && ann.points && ann.text) {
      // Basic text embedding for note
      page.drawText(ann.text, {
        x: ann.points[0] * width,
        y: height - ann.points[1] * height - 12,
        size: 12,
        color: rgb(colorRGB.r, colorRGB.g, colorRGB.b),
      });
    }
  }

  const pdfBytes = await pdfDoc.save();
  downloadBlob(new Blob([pdfBytes], { type: 'application/pdf' }), fileName.replace('.pdf', '_annots.pdf'));
}

export async function exportXFDF(docId: string, fileName: string): Promise<void> {
  const annots = await storage.loadAnnotations(docId);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const exportFormat: any[] = annots.map(a => ({
    id: a.id,
    docId,
    pageNumber: a.page,
    type: a.type,
    data: {
      rect: a.rect,
      text: a.text,
      color: a.color,
      paths: a.points,
    },
    createdAt: a.createdAt,
    updatedAt: a.updatedAt,
  }));

  const xml = toXFDF(exportFormat, docId);
  downloadBlob(new Blob([xml], { type: 'application/vnd.adobe.xfdf' }), fileName.replace('.pdf', '') + '.xfdf');
}

export async function importXFDF(docId: string, xfdfString: string): Promise<void> {
  const imported = parseXFDF(xfdfString);
  for (const ann of imported) {
    if (ann.docId && ann.docId !== docId) {
      console.warn(`XFDF annot docId mismatch: ${ann.docId} != ${docId}`);
      // Usually we still allow importing if user explicitly requested it.
    }
    await storage.saveAnnotation(docId, {
      page: ann.pageNumber,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      type: ann.type as any,
      color: ann.data.color || '#000000',
      rect: ann.data.rect,
      text: ann.data.text,
      points: ann.data.paths,
    });
  }
}

// ---- Helpers ----

function hexToRgb(hex: string) {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  return { r: isNaN(r) ? 0 : r, g: isNaN(g) ? 0 : g, b: isNaN(b) ? 0 : b };
}

function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 100);
}
