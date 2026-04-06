/**
 * pdfiuh Annotation Export/Import
 * Implementa la serializzazione e deserializzazione di annotazioni in formato XFDF.
 */

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
    xml += `    <annotation id="${ann.id}" page="${ann.pageNumber}" type="${ann.type}" created="${ann.createdAt}" modified="${ann.updatedAt}">`;
    if (ann.data.text) {
      xml += ann.data.text;
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
    annotations.push({
      id: ann.getAttribute('id') || '0',
      docId: 'unknown',
      pageNumber: parseInt(ann.getAttribute('page') || '1', 10),
      type: (ann.getAttribute('type') || 'note') as any,
      data: {
        text: ann.textContent?.trim(),
        rect: { x: 0, y: 0, width: 0, height: 0 }
      },
      createdAt: parseInt(ann.getAttribute('created') || '0', 10),
      updatedAt: parseInt(ann.getAttribute('modified') || '0', 10)
    });
  }

  return annotations;
}
