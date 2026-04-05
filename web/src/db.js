/**
 * pdfiuh Web — Database Wrapper per IndexedDB
 *
 * Gestisce il salvataggio e recupero locale delle annotazioni.
 */

const DB_NAME    = 'pdfiuh';
const DB_VERSION = 1;
const STORE_NAME = 'annotations';

/**
 * Apre (o crea) il database IndexedDB.
 * @returns {Promise<IDBDatabase>}
 */
export function openDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE_NAME)) {
          req.result.createObjectStore(STORE_NAME);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror   = () => reject(req.error);
  });
}

/**
 * Salva i byte delle annotazioni per un dato hash di file e pagina.
 * @param {string} docHash
 * @param {number} page
 * @param {Uint8Array} bytes
 * @returns {Promise<void>}
 */
export async function savePageAnnotations(docHash, page, bytes) {
    if (!docHash) return;
    const key = `${docHash}:${page}`;
    const db = await openDb();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        store.put(bytes, key);
        tx.oncomplete = () => {
            db.close();
            resolve();
        };
        tx.onerror = () => {
            db.close();
            reject(tx.error);
        };
    });
}

/**
 * Recupera i byte delle annotazioni per un dato hash di file e pagina.
 * @param {string} docHash
 * @param {number} page
 * @returns {Promise<Uint8Array|null>}
 */
export async function loadPageAnnotations(docHash, page) {
    if (!docHash) return null;
    const key = `${docHash}:${page}`;
    const db = await openDb();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);
        const req = store.get(key);
        req.onsuccess = () => {
            db.close();
            resolve(req.result || null);
        };
        req.onerror = () => {
            db.close();
            reject(req.error);
        };
    });
}
