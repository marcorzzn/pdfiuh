import Dexie, { Table } from 'dexie';

export interface AnnotationData {
  rect?: { x: number; y: number; width: number; height: number };
  paths?: { points: { x: number; y: number }[] }[];
  text?: string;
  color?: string;
}

export interface Annotation {
  id?: number;
  docId: string;
  pageNumber: number;
  type: 'highlight' | 'note' | 'ink' | 'underline' | 'strikeout';
  data: AnnotationData;
  createdAt: number;
  updatedAt: number;
}

export class AnnotationDB extends Dexie {
  annotations!: Table<Annotation, number>;

  constructor() {
    super('PDFReaderDB');
    this.version(1).stores({
      annotations: '++id, docId, [docId+pageNumber], type, createdAt'
    });
  }
}

export const db = new AnnotationDB();

export async function getAnnotations(docId: string, page: number) {
  return db.annotations
    .where('[docId+pageNumber]')
    .equals([docId, page])
    .toArray();
}

export async function getAllAnnotations(docId: string) {
  return db.annotations.where('docId').equals(docId).toArray();
}

export async function saveAnnotation(annotation: Omit<Annotation, 'id'>): Promise<number> {
  return db.annotations.add(annotation as Annotation);
}

export async function updateAnnotationRecord(id: number, data: Partial<Omit<Annotation, 'id'>>) {
  return db.annotations.update(id, { ...data, updatedAt: Date.now() });
}

export async function deleteAnnotation(id: number) {
  return db.annotations.delete(id);
}

export async function clearAnnotations(docId: string) {
  return db.annotations.where('docId').equals(docId).delete();
}
