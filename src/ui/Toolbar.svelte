<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { currentPage, totalPages, zoom, zoomBy, setZoom, resetZoom, rotate } from '../stores/viewer.store';
  import { activeTool, loadAnnotations } from '../stores/annotations.store';
  import { getAllAnnotations } from '../core/annotation-store';
  import { downloadXFDF } from '../core/annotation-export';
  import type { Annotation } from '../core/annotation-store';

  const props = $props<{ docId: string }>();

  const dispatch = createEventDispatcher<{ sidebar: void }>();

  let showSaveMenu = $state(false);
  let loadedAnnotations = $state<Annotation[]>([]);

  async function loadAndCacheAnnotations() {
    loadedAnnotations = await getAllAnnotations(props.docId);
  }

  async function downloadXFDFFile() {
    if (loadedAnnotations.length === 0) {
      loadedAnnotations = await getAllAnnotations(props.docId);
    }
    downloadXFDF(loadedAnnotations, props.docId);
    showSaveMenu = false;
  }

  function toggleAnnotationTool(tool: Annotation['type']) {
    activeTool.update(t => t === tool ? 'select' : tool);
  }

  const toolIcons: Record<string, string> = {
    highlight: '\u{1F58D}\u{FE0F}',
    note: '\u{1F4DD}',
    ink: '\u{270F}\u{FE0F}',
    underline: 'U\u0332',
    strikeout: 'S\u0336'
  };
</script>

<div class="toolbar">
  <button class="btn icon" on:click={() => dispatch('sidebar')} title="Sidebar">\u2630;</button>

  <div class="separator"></div>

  <!-- Page navigation -->
  <button class="btn icon" on:click={() => currentPage.update(p => Math.max(1, p - 1))} title="Pagina precedente">&9664;</button>
  <span class="page-info">
    <input type="number" bind:value={$currentPage} min="1" max={$totalPages} />
    <span class="total">/ {$totalPages}</span>
  </span>
  <button class="btn icon" on:click={() => currentPage.update(p => Math.min($totalPages, p + 1))} title="Pagina successiva">&9654;</button>

  <div class="separator"></div>

  <!-- Zoom -->
  <button class="btn icon" on:click={() => zoomBy(-0.25)} title="Rimpicciolisci">&minus;</button>
  <span class="zoom-display">{$zoom.toFixed(2)}x</span>
  <button class="btn icon" on:click={() => zoomBy(0.25)} title="Ingrandisci">+</button>
  <button class="btn fit" on:click={resetZoom} title="Zoom 100%">1:1</button>

  <div class="separator"></div>

  <!-- Rotation -->
  <button class="btn icon" on:click={rotate} title="Ruota">&#x21bb;</button>

  <div class="separator"></div>

  <!-- Annotation tools -->
  {#each ['highlight', 'note', 'ink', 'underline', 'strikeout'] as tool}
    <button
      class="btn"
      class:active={$activeTool === tool}
      on:click={() => toggleAnnotationTool(tool as Annotation['type'])}
      title={tool}
    >
      {toolIcons[tool]}
    </button>
  {/each}

  <div class="separator"></div>

  <!-- Save menu -->
  <button class="btn" on:click={() => { showSaveMenu = !showSaveMenu; loadAndCacheAnnotations(); }}>&#x1F4BE;</button>
  {#if showSaveMenu}
    <div class="save-menu">
      <button class="btn" on:click={downloadXFDFFile}>Scarica annotazioni (XFDF)</button>
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
  .separator {
    width: 1px;
    height: 24px;
    background: var(--border);
    margin: 0 4px;
  }
  .page-info {
    display: flex;
    align-items: center;
    gap: 4px;
    font-size: 13px;
    color: var(--text);
  }
  .page-info input {
    width: 3em;
    text-align: center;
    background: var(--surface2);
    border: 1px solid var(--border);
    border-radius: 3px;
    color: var(--text-hi);
    padding: 2px 4px;
    font-size: 13px;
  }
  .total { color: var(--text-lo); }
  .zoom-display {
    font-size: 12px;
    min-width: 3.5em;
    text-align: center;
    color: var(--text);
    font-family: var(--mono);
  }
  .save-menu {
    position: absolute;
    top: 52px;
    right: 16px;
    display: flex;
    flex-direction: column;
    gap: 8px;
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 6px;
    padding: 12px;
    z-index: 100;
    min-width: 220px;
  }
  .hint {
    font-size: 11px;
    color: var(--text-lo);
    line-height: 1.4;
  }
</style>
