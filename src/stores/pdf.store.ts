import { writable } from 'svelte/store';

export const currentPdfBuffer = writable<ArrayBuffer | null>(null);

export function setPdfBuffer(buffer: ArrayBuffer) {
  currentPdfBuffer.set(buffer);
}

export function clearPdfBuffer() {
  currentPdfBuffer.set(null);
}
