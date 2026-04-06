<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { currentPage, totalPages, zoom, rotation, isLoading, isError, errorMsg } from '../stores/viewer.store';
  import { currentPdfBuffer } from '../stores/pdf.store';
  import { detectProfile } from '../core/device-profile';
  import PdfRendererWorker from '../workers/pdf-renderer.worker?worker';
  import type { DeviceProfile } from '../core/device-profile';
  import type { Unsubscriber } from 'svelte/store';

  const props = $props<{ docId: string }>();

  let renderWorker: Worker | null = null;
  let canvas: HTMLCanvasElement;

  // FIX BUG #4c: profile come $state così gli $effect lo tracciano come dipendenza
  let profile = $state<DeviceProfile | null>(null);

  // FIX BUG #4a: manteniamo la referenza all'unsubscriber per cleanup
  let bufferUnsub: Unsubscriber | null = null;

  $effect(() => {
    // FIX BUG #4c: ora $effect rilegge profile come dipendenza reattiva
    if (!profile || !renderWorker) return;
    const z = $zoom;
    const page = $currentPage;
    requestRender(page, z);
  });

  $effect(() => {
    if (!profile || !renderWorker) return;
    const _rot = $rotation;
    requestRender($currentPage, $zoom);
  });

  onMount(async () => {
    profile = await detectProfile();
    renderWorker = new PdfRendererWorker();

    renderWorker.postMessage({ type: 'SET_MAX_POOL', payload: { maxPool: profile.maxPagePool } });

    renderWorker.onmessage = (e) => {
      const { type, numPages, pageNumber, bitmap, message } = e.data;

      if (type === 'LOADED') {
        totalPages.set(numPages);
        isLoading.set(false);
        requestRender(1, $zoom);
        return;
      }

      if (type === 'RENDERED') {
        renderBitmap(bitmap);
        return;
      }

      if (type === 'ERROR') {
        isLoading.set(false);
        isError.set(true);
        errorMsg.set(message || 'Errore sconosciuto');
        console.error('[PDF Worker Error]', message);
        return;
      }
    };

    renderWorker.onerror = (e) => {
      isLoading.set(false);
      isError.set(true);
      errorMsg.set(`Worker error: ${e.message}`);
    };

    // FIX BUG #4a + #4b: subscribe con cleanup + copia difensiva del buffer
    // Il buffer viene TRASFERITO al worker (postMessage transferable).
    // Facciamo una copia PRIMA del transfer per non invalidare il buffer nel store.
    bufferUnsub = currentPdfBuffer.subscribe(async (buffer) => {
      if (!buffer || !renderWorker) return;
      if (buffer.byteLength === 0) return; // buffer già detached, skip

      isLoading.set(true);
      isError.set(false);

      // FIX BUG #4b: copia il buffer prima di trasferirlo.
      // Senza copia, dopo postMessage con [buffer] il buffer nel store diventa
      // un ArrayBuffer detached (byteLength=0), rompendo eventuali reload.
      const bufferCopy = buffer.slice(0);
      renderWorker.postMessage(
        { type: 'LOAD', payload: { buffer: bufferCopy } },
        [bufferCopy]
      );
    });
  });

  onDestroy(() => {
    // FIX BUG #4a: cleanup subscription
    bufferUnsub?.();
    renderWorker?.postMessage({ type: 'CLEANUP' });
    renderWorker?.terminate();
    renderWorker = null;
  });

  function requestRender(page: number, z: number) {
    if (!renderWorker || !profile) return;
    const scale = z * profile.renderScale;
    renderWorker.postMessage({
      type: 'RENDER',
      payload: { pageNumber: page, scale }
    });
  }

  function renderBitmap(bitmap: ImageBitmap) {
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    ctx.drawImage(bitmap, 0, 0);
    bitmap.close();
    // notifica App delle nuove dimensioni
    props.oncanvasresized?.(canvas.width, canvas.height);
  }
</script>

<div class="viewer-container">
  {#if $isLoading}
    <div class="loading-overlay">
      <div class="spinner"></div>
    </div>
  {/if}
  {#if $isError}
    <div class="error">
      <strong>Errore rendering:</strong> {$errorMsg}
    </div>
  {/if}
  <canvas bind:this={canvas} class="pdf-canvas" />
</div>

<style>
  .viewer-container {
    flex: 1;
    overflow: auto;
    display: flex;
    align-items: flex-start;
    justify-content: center;
    background: var(--surface);
    position: relative;
    min-height: 0;
  }
  .pdf-canvas {
    box-shadow: 0 2px 16px rgba(0, 0, 0, 0.5);
    margin: 16px;
    background: white;
    display: block;
  }
  .loading-overlay {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(13, 15, 20, 0.6);
    z-index: 20;
  }
  .error {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(13, 15, 20, 0.9);
    color: var(--accent2);
    font-size: 14px;
    z-index: 10;
    padding: 20px;
    text-align: center;
  }
</style>
