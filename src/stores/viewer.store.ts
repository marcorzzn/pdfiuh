import { writable } from 'svelte/store';

export const currentPage = writable(1);
export const totalPages = writable(0);
export const zoom = writable(1.0);
export const rotation = writable(0);
export const isLoading = writable(false);
export const isError = writable(false);
export const errorMsg = writable('');

export function setPage(page: number, max: number) {
  currentPage.set(Math.max(1, Math.min(max, page)));
}

export function zoomBy(delta: number) {
  zoom.update(z => Math.max(0.25, Math.min(4.0, z + delta)));
}

export function setZoom(z: number) {
  zoom.set(Math.max(0.25, Math.min(4.0, z)));
}

export function resetZoom() {
  zoom.set(1.0);
}

export function rotate() {
  rotation.update(r => (r + 90) % 360);
}
