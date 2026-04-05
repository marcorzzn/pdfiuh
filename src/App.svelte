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

  function handlePdfLoad(docId: string, buffer: ArrayBuffer, name: string) {
    pdfLoaded = true;
    currentDocId = docId;
    fileName = name;
    setPdfBuffer(buffer);
  }

  function toggleSidebar() {
    sidebarOpen = !sidebarOpen;
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
      <Viewer docId={currentDocId || ''} />
      <AnnotationLayer docId={currentDocId || ''} />
    </div>
  </div>
{/if}

<style>
  .main-content {
    display: flex;
    flex: 1;
    overflow: hidden;
    position: relative;
  }
  .sidenav-open .viewer-area {
    margin-left: 0;
  }
</style>
