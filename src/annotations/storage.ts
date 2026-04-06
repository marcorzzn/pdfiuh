/**
 * pdfiuh Annotation Storage
 * Gestisce la persistenza delle annotazioni in IndexedDB.
 */

export interface Annotation {
  id: string;
  page: number;
  type: 'ink' | 'highlight' | 'text';
  color: string;
  width?: number;
  points?: number[]; // [x1, y1, x2, y2, ...] per coordinate normalizzate
  text?: string;
  rect?: { x: number; y: number; w: number; h: number }; // Coordinate normalizzate
}

class AnnotationStore {
  private dbName = 'pdfiuh_annotations';
  private storeName = 'annotations';
  private db: IDBDatabase | null = null;

  async init() {
    return new Promise<void>((resolve, reject) => {
      const request = indexedDB.open(this.dbName, 1);

      request.onupgradeneeded = (e) => {
        const db = (e.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(this.storeName)) {
          db.createObjectStore(this.storeName, { keyPath: 'id' });
        }
      };

      request.onsuccess = (e) => {
        this.db = (e.target as IDBOpenDBRequest).result;
        resolve();
      };

      request.onerror = () => reject(new Error('Failed to open IndexedDB'));
    });
  }

  async saveAnnotation(docId: string, annotation: Annotation) {
    if (!this.db) await this.init();
    const tx = this.db!.transaction(this.storeName, 'readwrite');
    const store = tx.objectStore(this.storeName);

    // Usiamo un id composto docId + annotationId
    const compositeId = `${docId}_${annotation.id}`;
    await store.put({ ...annotation, id: compositeId });
  }

  async loadAnnotations(docId: string): Promise<Annotation[]> {
    if (!this.db) await this.init();
    return new Promise((resolve) => {
      const tx = this.db!.transaction(this.storeName, 'readonly');
      const store = tx.objectStore(this.storeName);
      const request = store.getAll();

      request.onsuccess = () => {
        const all = request.result as Annotation[];
        // Filtriamo solo le annotazioni relative a questo documento
        const filtered = all.filter(a => a.id.startsWith(`${docId}_`));
        resolve(filtered);
      };
    });
  }

  async deleteAnnotation(docId: string, annotationId: string) {
    if (!this.db) await this.init();
    const tx = this.db!.transaction(this.storeName, 'readwrite');
    const store = tx.objectStore(this.storeName);
    await store.delete(`${docId}_${annotationId}`);
  }
}

export const storage = new AnnotationStore();
