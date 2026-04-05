<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { currentPage, totalPages, zoom, rotation, isLoading, isError, errorMsg } from '../stores/viewer.store';
  import { currentPdfBuffer, setPdfBuffer } from '../stores/pdf.store';
  import { detectProfile } from '../core/device-profile';
  import PdfRendererWorker from '../workers/pdf-renderer.worker?worker';
  import type { DeviceProfile } from '../core/device-profile';

  const props = $props<{ docId: string }>();

  let renderWorker: Worker;
  let canvas: HTMLCanvasElement;

  let profile: DeviceProfile | null = null;
  let error = $state<Record<number, string>>({});

  $effect(() => {
    if (!profile) return;
    const z = $zoom;
    const page = $currentPage;
    requestRender(page, z);
  });

  $effect(() => {
    if (!profile) return;
    const _rot = $rotation;
    // Re-render on rotation
    requestRender($currentPage, $zoom);
  });

  onMount(async () => {
    profile = await detectProfile();
    renderWorker = new PdfRendererWorker();

    // Set max pool based on device profile
    renderWorker.postMessage({ type: 'SET_MAX_POOL', payload: { maxPool: profile.maxPagePool } });

    renderWorker.onmessage = (e) => {
      const { type, numPages, fingerprint, pageNumber, bitmap, width, height, message } = e.data;

      if (type === 'LOADED') {
        totalPages.set(numPages);
        isLoading.set(false);
        // Render first page immediately
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
        return;
      }
    };

    // Load PDF from currentPdfBuffer store
    currentPdfBuffer.subscribe(async (buffer) => {
      if (!buffer || !renderWorker) return;
      isLoading.set(true);
      isError.set(false);
      renderWorker.postMessage({ type: 'LOAD', payload: { buffer } }, [buffer]);
    });
  });

  onDestroy(() => {
    renderWorker?.postMessage({ type: 'CLEANUP' });
    renderWorker?.terminate();
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
    ctx.drawImage(bitmap, 0, 0, bitmap.width, bitmap.height);
    bitmap.close();
  }

  // Expose function for App to call when loading new PDFs
  export { setPdfBuffer };
</script>

<div class="viewer-container">
  {#if $isError}
    <div class="error">Errore: {$errorMsg}</div>
  {/if}
  <canvas bind:this={canvas} class="pdf-canvas" />
</div>

<style>
  .viewer-container {
    flex: 1;
    overflow: auto;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--surface);
    position: relative;
  }
  .pdf-canvas {
    box-shadow: 0 2px 16px rgba(0, 0, 0, 0.5);
    margin: 16px;
    background: white;
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
  }
</style>
