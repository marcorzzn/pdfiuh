/**
 * pdfiuh Annotation Storage
 * Gestisce la persistenza delle annotazioni in IndexedDB usando Dexie.js.
 */

import Dexie, { type Table } from 'dexie';

export interface Annotation {
  id: string;
  docId: string; // campo esplicito per il documento
  page: number;
  type: 'ink' | 'highlight' | 'text';
  color: string;
  width?: number;
  points?: number[]; // [x1, y1, x2, y2, ...] per coordinate normalizzate
  text?: string;
  rect?: { x: number; y: number; w: number; h: number }; // Coordinate normalizzate
}

class PdfiuhDB extends Dexie {
  annotations!: Table<Annotation>;

  constructor() {
    super('pdfiuh_db');
    this.version(1).stores({
      annotations: 'id, docId, page' // id è la chiave primaria
    });
  }
}

const db = new PdfiuhDB();

export const storage = {
  async saveAnnotation(docId: string, annotation: Annotation) {
    await db.annotations.put({ ...annotation, docId });
  },

  async loadAnnotations(docId: string): Promise<Annotation[]> {
    return db.annotations.where('docId').equals(docId).toArray();
  },

  async deleteAnnotation(docId: string, annotationId: string) {
    await db.annotations
      .where({ id: annotationId, docId })
      .delete();
  }
};
