<script lang="ts">
  import { currentPage, totalPages, zoom, zoomBy, resetZoom, rotate } from '../stores/viewer.store';
  import { activeTool, loadAnnotations } from '../stores/annotations.store';
  import { getAllAnnotations } from '../core/annotation-store';
  import { downloadXFDF } from '../core/annotation-export';
  import type { Annotation } from '../core/annotation-store';

  let { docId, onsidebar }: { docId: string; onsidebar: () => void } = $props();

  let showSaveMenu = $state(false);
  let loadedAnnotations = $state<Annotation[]>([]);

  async function loadAndCacheAnnotations() {
    loadedAnnotations = await getAllAnnotations(docId);
  }

  async function downloadXFDFFile() {
    if (loadedAnnotations.length === 0) {
      loadedAnnotations = await getAllAnnotations(docId);
    }
    downloadXFDF(loadedAnnotations, docId);
    showSaveMenu = false;
  }

  function toggleAnnotationTool(tool: Annotation['type']) {
    activeTool.update(t => t === tool ? 'select' : tool);
  }

  const toolIcons: Record<string, string> = {
    highlight: '✏️',
    note: '📝',
    ink: '🖍️',
    underline: 'U̲',
    strikeout: 'S̶'
  };
</script>

<div class="toolbar">
  <button class="btn icon" onclick={onsidebar} title="Sidebar">☰</button>

  <div class="separator"></div>

  <button class="btn icon" onclick={() => currentPage.update(p => Math.max(1, p - 1))} title="Pagina precedente">◀</button>
  <span class="page-info">
    <input type="number" bind:value={$currentPage} min="1" max={$totalPages} />
    <span class="total">/ {$totalPages}</span>
  </span>
  <button class="btn icon" onclick={() => currentPage.update(p => Math.min($totalPages, p + 1))} title="Pagina successiva">▶</button>

  <div class="separator"></div>

  <button class="btn icon" onclick={() => zoomBy(-0.25)} title="Rimpicciolisci">−</button>
  <span class="zoom-display">{$zoom.toFixed(2)}x</span>
  <button class="btn icon" onclick={() => zoomBy(0.25)} title="Ingrandisci">+</button>
  <button class="btn fit" onclick={resetZoom} title="Zoom 100%">1:1</button>

  <div class="separator"></div>

  <button class="btn icon" onclick={rotate} title="Ruota">&#x21bb;</button>

  <div class="separator"></div>

  {#each ['highlight', 'note', 'ink', 'underline', 'strikeout'] as tool}
    <button
      class="btn"
      class:active={$activeTool === tool}
      onclick={() => toggleAnnotationTool(tool as Annotation['type'])}
      title={tool}
    >
      {toolIcons[tool]}
    </button>
  {/each}

  <div class="separator"></div>

  <button class="btn" onclick={() => { showSaveMenu = !showSaveMenu; loadAndCacheAnnotations(); }}>&#x1F4BE;</button>
  {#if showSaveMenu}
    <div class="save-menu">
      <button class="btn" onclick={downloadXFDFFile}>Scarica annotazioni (XFDF)</button>
      <span class="hint">PDF annotato sara disponibile dopo integrazione pdf-lib</span>
    </div>
  {/if}
</div>

<style>
  .toolbar {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 8px 12px;
    background: var(--surface);
    border-bottom: 1px solid var(--border);
    min-height: 48px;
    flex-wrap: wrap;
  }
  .separator { width: 1px; height: 24px; background: var(--border); margin: 0 4px; }
  .page-info { display: flex; align-items: center; gap: 4px; font-size: 13px; color: var(--text); }
  .page-info input { width: 3em; text-align: center; background: var(--surface2); border: 1px solid var(--border); border-radius: 3px; color: var(--text-hi); padding: 2px 4px; font-size: 13px; }
  .total { color: var(--text-lo); }
  .zoom-display { font-size: 12px; min-width: 3.5em; text-align: center; color: var(--text); font-family: var(--mono); }
  .save-menu { position: absolute; top: 52px; right: 16px; display: flex; flex-direction: column; gap: 8px; background: var(--surface); border: 1px solid var(--border); border-radius: 6px; padding: 12px; z-index: 100; min-width: 220px; }
  .hint { font-size: 11px; color: var(--text-lo); line-height: 1.4; }
</style>
