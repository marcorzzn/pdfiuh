<script lang="ts">
  import Toolbar from './ui/Toolbar.svelte';
  import Viewer from './ui/Viewer.svelte';
  import AnnotationLayer from './ui/AnnotationLayer.svelte';
  import Sidebar from './ui/Sidebar.svelte';
  import DropZone from './ui/DropZone.svelte';
  import { setPdfBuffer } from './stores/pdf.store';
  import './styles/global.css';
  import './styles/themes.css';

  let pdfLoaded = $state(false);
  let sidebarOpen = $state(false);
  let currentDocId = $state<string | null>(null);
  let fileName = $state('');

  // Dimensioni del canvas PDF renderizzato — servono a AnnotationLayer per
  // dimensionare il suo SVG overlay correttamente (FIX BUG #5)
  let canvasWidth = $state(0);
  let canvasHeight = $state(0);

  function handlePdfLoad(docId: string, buffer: ArrayBuffer, name: string) {
    pdfLoaded = true;
    currentDocId = docId;
    fileName = name;
    setPdfBuffer(buffer);
  }

  function toggleSidebar() {
    sidebarOpen = !sidebarOpen;
  }

  // Callback passata a Viewer per aggiornare le dimensioni del canvas
  function onCanvasResized(w: number, h: number) {
    canvasWidth = w;
    canvasHeight = h;
  }
</script>

{#if !pdfLoaded}
  <DropZone onload={(d, b, n) => handlePdfLoad(d, b, n)} />
{:else}
  <Toolbar
    docId={currentDocId || ''}
    onsidebar={toggleSidebar}
  />
  <div class="main-content" class:sidenav-open={sidebarOpen}>
    <Sidebar docId={currentDocId || ''} open={sidebarOpen} onclose={toggleSidebar} />
    <div class="viewer-area">
      <Viewer
        docId={currentDocId || ''}
        oncanvasresized={onCanvasResized}
      />
      {#if canvasWidth > 0}
        <AnnotationLayer
          docId={currentDocId || ''}
          canvasWidth={canvasWidth}
          canvasHeight={canvasHeight}
        />
      {/if}
    </div>
  </div>
{/if}

<style>
  .main-content {
    display: flex;
    flex: 1;
    overflow: hidden;
    position: relative;
    min-height: 0;
  }
  .viewer-area {
    flex: 1;
    position: relative;
    overflow: hidden;
    min-height: 0;
  }
</style>
