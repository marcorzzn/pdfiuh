import { writable } from 'svelte/store';
import type { Annotation } from '../core/annotation-store';
import { saveAnnotation, deleteAnnotation, updateAnnotationRecord, getAllAnnotations } from '../core/annotation-store';

export const annotations = writable<Annotation[]>([]);
export const activeTool = writable<'select' | 'highlight' | 'note' | 'ink' | 'underline' | 'strikeout'>('select');

export async function addAnnotation(annotation: Omit<Annotation, 'id' | 'createdAt' | 'updatedAt'>) {
  const newAnn: Omit<Annotation, 'id'> = {
    ...annotation,
    createdAt: Date.now(),
    updatedAt: Date.now()
  };
  const id = await saveAnnotation(newAnn);
  annotations.update(list => [...list, { ...newAnn, id } as Annotation]);
  return id;
}

export async function removeAnnotation(id: number) {
  await deleteAnnotation(id);
  annotations.update(list => list.filter(a => a.id !== id));
}

export async function modifyAnnotation(id: number, data: Partial<Omit<Annotation, 'id'>>) {
  await updateAnnotationRecord(id, data);
  annotations.update(list =>
    list.map(a => a.id === id ? { ...a, ...data, updatedAt: Date.now() } : a)
  );
}

export async function loadAnnotations(docId: string) {
  const loaded = await getAllAnnotations(docId);
  annotations.set(loaded);
}

export function clearAnnotations() {
  annotations.set([]);
}
