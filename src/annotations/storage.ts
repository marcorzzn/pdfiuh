/**
 * pdfiuh Annotation Storage
<<<<<<< HEAD
 * Gestisce la persistenza delle annotazioni in IndexedDB usando Dexie.js.
=======
 * Persistent annotation store using Dexie.js (IndexedDB wrapper).
 * All coordinates are normalized (0.0 - 1.0) relative to the page.
>>>>>>> 692cdb1 (Refactor: Rifondazione architettura Fluent UI, worker estrazione testo e virtual scrolling)
 */
import Dexie, { type Table } from 'dexie';

import Dexie, { type Table } from 'dexie';

export interface Annotation {
  id: string;
<<<<<<< HEAD
  docId: string; // campo esplicito per il documento
=======
  docId: string;
>>>>>>> 692cdb1 (Refactor: Rifondazione architettura Fluent UI, worker estrazione testo e virtual scrolling)
  page: number;
  type: 'ink' | 'highlight' | 'note' | 'eraser';
  color: string;
  opacity?: number;
  width?: number;
  points?: number[];       // [nx1, ny1, nx2, ny2, ...] normalized
  text?: string;
  rect?: { x: number; y: number; w: number; h: number }; // normalized
  createdAt: number;
  updatedAt: number;
}

<<<<<<< HEAD
class PdfiuhDB extends Dexie {
  annotations!: Table<Annotation>;

  constructor() {
    super('pdfiuh_db');
    this.version(1).stores({
      annotations: 'id, docId, page' // id è la chiave primaria
=======
class AnnotationDB extends Dexie {
  annotations!: Table<Annotation, string>;

  constructor() {
    super('pdfiuh_v2');
    this.version(1).stores({
      annotations: 'id, docId, page, [docId+page]',
    });
  }
}

const db = new AnnotationDB();

class AnnotationStore {
  /** Generate a unique annotation ID */
  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  }

  /** Save a new annotation */
  async saveAnnotation(docId: string, annotation: Omit<Annotation, 'id' | 'docId' | 'createdAt' | 'updatedAt'>): Promise<string> {
    const id = this.generateId();
    const now = Date.now();
    await db.annotations.put({
      ...annotation,
      id,
      docId,
      createdAt: now,
      updatedAt: now,
>>>>>>> 692cdb1 (Refactor: Rifondazione architettura Fluent UI, worker estrazione testo e virtual scrolling)
    });
    return id;
  }
<<<<<<< HEAD
=======

  /** Update an existing annotation */
  async updateAnnotation(id: string, changes: Partial<Annotation>): Promise<void> {
    await db.annotations.update(id, { ...changes, updatedAt: Date.now() });
  }

  /** Load all annotations for a document, optionally filtered by page */
  async loadAnnotations(docId: string, page?: number): Promise<Annotation[]> {
    if (page !== undefined) {
      return db.annotations
        .where('[docId+page]')
        .equals([docId, page])
        .toArray();
    }
    return db.annotations
      .where('docId')
      .equals(docId)
      .toArray();
  }

  /** Delete a specific annotation */
  async deleteAnnotation(id: string): Promise<void> {
    await db.annotations.delete(id);
  }

  /** Delete all annotations for a document */
  async deleteAllAnnotations(docId: string): Promise<void> {
    await db.annotations
      .where('docId')
      .equals(docId)
      .delete();
  }

  /** Count annotations for a document page */
  async countAnnotations(docId: string, page?: number): Promise<number> {
    if (page !== undefined) {
      return db.annotations
        .where('[docId+page]')
        .equals([docId, page])
        .count();
    }
    return db.annotations
      .where('docId')
      .equals(docId)
      .count();
  }
>>>>>>> 692cdb1 (Refactor: Rifondazione architettura Fluent UI, worker estrazione testo e virtual scrolling)
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
