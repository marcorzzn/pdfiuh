/**
 * pdfiuh Annotation Export
 * Embeds annotations natively into the PDF using pdf-lib, or exports to XFDF.
 */
import { PDFDocument, rgb } from 'pdf-lib';
import { storage } from './storage';
import { store } from '../state/store';

// --- XFDF Core Functions ---

export interface AnnotationExport {
  id: number | string;
  docId: string;
  pageNumber: number;
  type: 'highlight' | 'note' | 'ink' | 'text';
  data: {
    rect?: { x: number; y: number; width: number; height: number };
    text?: string;
    color?: string;
    paths?: any[]; 
  };
  createdAt: number;
  updatedAt: number;
}

export function toXFDF(annotations: AnnotationExport[], docId: string): string {
  let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
  xml += '<xfdf xmlns="http://www.adobe.com/xfdf/" xml:space="preserve">\n';
  xml += '  <annots>\n';

  for (const ann of annotations) {
    xml += `    <annotation id="${ann.id}" page="${ann.pageNumber}"`;
    if (ann.type === 'highlight') xml += ' subtype="Highlight"';
    else if (ann.type === 'note') xml += ' subtype="Note"';
    else if (ann.type === 'ink') xml += ' subtype="Ink"';
    else if (ann.type === 'text') xml += ' subtype="Text"';

    xml += ` created="${ann.createdAt}" modified="${ann.updatedAt}">`;

    if (ann.data.text) {
      xml += ann.data.text;
    } else if (ann.type === 'ink' && ann.data.paths) {
      xml += `<!-- Ink data: ${JSON.stringify(ann.data.paths)} -->`;
    }

    if (ann.data.rect) {
      const { x, y, width, height } = ann.data.rect;
      xml += `<rect x="${x}" y="${y}" width="${width}" height="${height}" />`;
    }

    xml += '</annotation>\n';
  }

  xml += '  </annots>\n';
  xml += '</xfdf>';
  return xml;
}

export function parseXFDF(xml: string): AnnotationExport[] {
  const annotations: AnnotationExport[] = [];
  const parser = new DOMParser();
  const doc = parser.parseFromString(xml, 'text/xml');
  const annots = doc.getElementsByTagName('annotation');

  for (let i = 0; i < annots.length; i++) {
    const ann = annots[i];
    const subtype = ann.getAttribute('subtype') || 'note';

    let type: AnnotationExport['type'] = 'note';
    if (subtype === 'Highlight') type = 'highlight';
    else if (subtype === 'Ink') type = 'ink';
    else if (subtype === 'Text') type = 'text';

    const rectElem = ann.getElementsByTagName('rect')[0];
    const rect = rectElem ? {
      x: parseFloat(rectElem.getAttribute('x') || '0'),
      y: parseFloat(rectElem.getAttribute('y') || '0'),
      width: parseFloat(rectElem.getAttribute('width') || '0'),
      height: parseFloat(rectElem.getAttribute('height') || '0')
    } : undefined;

    const textContent = ann.textContent?.trim() || undefined;

    let paths: any[] | undefined;
    if (type === 'ink') {
      const commentNodes = ann.childNodes;
      for (let j = 0; j < commentNodes.length; j++) {
        const node = commentNodes[j];
        if (node.nodeType === 8 && node.textContent?.trim().startsWith('Ink data:')) {
          try {
            const jsonStr = node.textContent.trim().substring('Ink data:'.length).trim();
            paths = JSON.parse(jsonStr);
          } catch (e) {
            console.warn('Could not parse ink data from XFDF comment:', e);
          }
          break;
        }
      }
    }

    annotations.push({
      id: ann.getAttribute('id') || '0',
      docId: 'unknown',
      pageNumber: parseInt(ann.getAttribute('page') || '1', 10),
      type: type as any,
      data: {
        rect: rect,
        text: textContent,
        color: ann.getAttribute('color') || undefined,
        paths: paths
      },
      createdAt: parseInt(ann.getAttribute('created') || '0', 10),
      updatedAt: parseInt(ann.getAttribute('modified') || '0', 10)
    });
  }

  return annotations;
}

// --- PDF-lib Integration ---

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
      page.drawRectangle({
        x: ann.rect.x * width,
        y: height - (ann.rect.y + ann.rect.h) * height,
        width: ann.rect.w * width,
        height: ann.rect.h * height,
        color: rgb(colorRGB.r, colorRGB.g, colorRGB.b),
        opacity: ann.opacity || 0.35,
      });
    } else if (ann.type === 'ink' && ann.points && ann.points.length >= 4) {
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
