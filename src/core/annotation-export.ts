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
    paths?: any[]; // Per annotazioni inchiostro: array di punti [x1,y1,x2,y2,...]
  };
  createdAt: number;
  updatedAt: number;
}

/**
 * Converte un array di annotazioni in formato XFDF
 * Supporta tutti i tipi di annotazione: highlight, note, ink, text
 */
export function toXFDF(annotations: AnnotationExport[], docId: string): string {
  let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
  xml += '<xfdf xmlns="http://www.adobe.com/xfdf/" xml:space="preserve">\n';
  xml += '  <annots>\n';

  for (const ann of annotations) {
    // Iniziamo l'annotazione
    xml += `    <annotation id="${ann.id}" page="${ann.pageNumber}"`;

    // Aggiungiamo attributi specifici per tipo
    if (ann.type === 'highlight') {
      xml += ' subtype="Highlight"';
    } else if (ann.type === 'note') {
      xml += ' subtype="Note"';
    } else if (ann.type === 'ink') {
      xml += ' subtype="Ink"';
    } else if (ann.type === 'text') {
      xml += ' subtype="Text"';
    }

    xml += ` created="${ann.createdAt}" modified="${ann.updatedAt}">`;

    // Gestiamo il contenuto in base al tipo
    if (ann.data.text) {
      // Per note e testo, il contenuto va direttamente nell'elemento annotation
      xml += ann.data.text;
    } else if (ann.type === 'ink' && ann.data.paths) {
      // Per l'inchiostro, possiamo aggiungere punti come elementi separati
      // Tuttavia, XFDF standard non supporta direttamente l'inchiostro complesso
      # No standard way to represent complex ink in XFDF, so we'll store as custom data
      xml += `<!-- Ink data: ${JSON.stringify(ann.data.paths)} -->`;
    }

    // Aggiungiamo il rettangolo se presente
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

/**
 * Analizza una stringa XFDF e restituisce le annotazioni
 * Supporta i tipi base di annotazione
 */
export function parseXFDF(xml: string): AnnotationExport[] {
  const annotations: AnnotationExport[] = [];
  const parser = new DOMParser();
  const doc = parser.parseFromString(xml, 'text/xml');
  const annots = doc.getElementsByTagName('annotation');

  for (let i = 0; i < annots.length; i++) {
    const ann = annots[i];
    const subtype = ann.getAttribute('subtype') || 'note';

    // Mappiamo il subtype di XFDF ai nostri tipi
    let type: AnnotationExport['type'] = 'note';
    if (subtype === 'Highlight') type = 'highlight';
    else if (subtype === 'Ink') type = 'ink';
    else if (subtype === 'Text') type = 'text';
    // note rimane come default

    // Estraiamo le coordinate del rettangolo se presente
    const rectElem = ann.getElementsByTagName('rect')[0];
    const rect = rectElem ? {
      x: parseFloat(rectElem.getAttribute('x') || '0'),
      y: parseFloat(rectElem.getAttribute('y') || '0'),
      width: parseFloat(rectElem.getAttribute('width') || '0'),
      height: parseFloat(rectElem.getAttribute('height') || '0')
    } : undefined;

    // Estraiamo il testo per note e annotazioni di testo
    const textContent = ann.textContent?.trim() || undefined;

    // Gestiamo i dati dell'inchiostro se presenti come commento
    let paths: any[] | undefined;
    if (type === 'ink') {
      const commentNodes = ann.childNodes;
      for (let j = 0; j < commentNodes.length; j++) {
        const node = commentNodes[j];
        if (node.nodeType === Node.COMMENT_NODE && node.textContent.trim().startsWith('Ink data:')) {
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
      docId: 'unknown', // Questo dovrebbe essere passato separatamente in un'implementazione reale
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