import type { Annotation } from './annotation-store';

export function toXFDF(annotations: Annotation[], docId: string): string {
  let xfdf = '<?xml version="1.0" encoding="UTF-8"?>\n';
  xfdf += '<xfdf xmlns="http://ns.adobe.com/xfdf/" xml:space="preserve">\n';
  xfdf += `  <f href="${docId}.pdf"/>\n`;
  xfdf += '  <annots>\n';

  for (const ann of annotations) {
    xfdf += `    <annotation `;
    xfdf += `id="${ann.id}" `;
    xfdf += `page="${ann.pageNumber}" `;
    xfdf += `type="${ann.type}" `;
    xfdf += `created="${ann.createdAt}" `;
    xfdf += `modified="${ann.updatedAt}"`;

    if (ann.data.color) {
      xfdf += ` color="${ann.data.color}"`;
    }

    if (ann.data.rect) {
      const { x, y, width, height } = ann.data.rect;
      xfdf += ` x="${x}" y="${y}" width="${width}" height="${height}"`;
    }

    xfdf += `>${ann.data.text ?? ''}</annotation>\n`;
  }

  xfdf += '  </annots>\n';
  xfdf += '</xfdf>';
  return xfdf;
}

export function parseXFDF(xml: string): {
  id: number;
  pageNumber: number;
  type: Annotation['type'];
  createdAt: number;
  updatedAt: number;
  data: { text?: string; color?: string; rect?: { x: number; y: number; width: number; height: number } };
}[] {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xml, 'text/xml');
  const annotations: { id: number; pageNumber: number; type: Annotation['type']; createdAt: number; updatedAt: number; data: { text?: string; color?: string; rect?: { x: number; y: number; width: number; height: number } } }[] = [];

  const annots = doc.getElementsByTagName('annotation');
  for (const el of Array.from(annots)) {
    const entry = {
      id: parseInt(el.getAttribute('id') || '0'),
      pageNumber: parseInt(el.getAttribute('page') || '0'),
      type: (el.getAttribute('type') || 'note') as Annotation['type'],
      createdAt: parseInt(el.getAttribute('created') || '0'),
      updatedAt: parseInt(el.getAttribute('modified') || '0'),
      data: {
        text: el.textContent ?? undefined,
        color: el.getAttribute('color') ?? undefined,
      }
    };

    const x = parseFloat(el.getAttribute('x') || '0');
    const y = parseFloat(el.getAttribute('y') || '0');
    const w = parseFloat(el.getAttribute('width') || '0');
    const h = parseFloat(el.getAttribute('height') || '0');
    if (w && h) {
      entry.data = { ...entry.data, rect: { x, y, width: w, height: h } } as typeof entry.data;
    }

    annotations.push(entry);
  }

  return annotations;
}

export function downloadXFDF(annotations: Annotation[], docId: string) {
  const xfdf = toXFDF(annotations, docId);
  const blob = new Blob([xfdf], { type: 'application/vnd.adobe.xfdf' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${docId}.xfdf`;
  a.click();
  URL.revokeObjectURL(url);
}

export async function loadXFDFFromFile(file: File) {
  const text = await file.text();
  return parseXFDF(text);
}
