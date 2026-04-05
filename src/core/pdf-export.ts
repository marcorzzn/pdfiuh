import { PDFDocument, rgb } from 'pdf-lib';
import type { Annotation } from './annotation-store';

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? { r: parseInt(result[1], 16) / 255, g: parseInt(result[2], 16) / 255, b: parseInt(result[3], 16) / 255 }
    : { r: 1, g: 1, b: 0 };
}

export async function embedAnnotations(pdfBytes: Uint8Array, annotations: Annotation[]): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.load(pdfBytes);
  const pages = pdfDoc.getPages();

  for (const ann of annotations) {
    const page = pages[ann.pageNumber - 1];
    if (!page) continue;

    switch (ann.type) {
      case 'highlight': {
        const rect = ann.data.rect;
        if (!rect) continue;
        const color = ann.data.color ? hexToRgb(ann.data.color) : { r: 1, g: 1, b: 0 };
        page.drawRectangle({
          x: rect.x,
          y: rect.y,
          width: rect.width,
          height: rect.height,
          color: rgb(color.r, color.g, color.b),
          opacity: 0.3,
        });
        break;
      }
      case 'note': {
        const x = ann.data.rect?.x ?? 100;
        const y = ann.data.rect?.y ?? 100;
        page.drawText(ann.data.text ?? '', { x, y, size: 12, color: rgb(0, 0, 0) });
        break;
      }
      case 'underline': {
        const rect = ann.data.rect;
        if (!rect) continue;
        page.drawLine({
          start: { x: rect.x, y: rect.y },
          end: { x: rect.x + rect.width, y: rect.y },
          thickness: 1,
          color: rgb(0, 0, 1),
        });
        break;
      }
      case 'strikeout': {
        const rect = ann.data.rect;
        if (!rect) continue;
        page.drawLine({
          start: { x: rect.x, y: rect.y + rect.height / 2 },
          end: { x: rect.x + rect.width, y: rect.y + rect.height / 2 },
          thickness: 1,
          color: rgb(1, 0, 0),
        });
        break;
      }
    }
  }

  return pdfDoc.save();
}

export async function downloadAnnotatedPDF(pdfBytes: Uint8Array, annotations: Annotation[], filename: string) {
  const result = await embedAnnotations(pdfBytes, annotations);
  const blob = new Blob([result], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
