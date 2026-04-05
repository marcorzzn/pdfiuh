<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { annotations, removeAnnotation } from '../stores/annotations.store';
  import { currentPage } from '../stores/viewer.store';

  const props = $props<{ docId: string; open: boolean }>();
  const dispatch = createEventDispatcher<{ close: void }>();

  let activeTab = $state<'annotations' | 'outline'>('annotations');

  const typeLabels: Record<string, string> = {
    highlight: 'Evidenziazione',
    note: 'Nota',
    ink: 'Inchiostro',
    underline: 'Sottolineatura',
    strikeout: 'Barrato'
  };

  function goToPage(page: number) {
    currentPage.set(page);
  }
</script>

<div class="sidebar" class:open={props.open}>
  <div class="sidebar-header">
    <div class="tabs">
      <button class="tab" class:active={activeTab === 'annotations'} on:click={() => activeTab = 'annotations'}>📝</button>
      <button class="tab" class:active={activeTab === 'outline'} on:click={() => activeTab = 'outline'}>📑</button>
    </div>
    <button class="btn close-btn" on:click={() => dispatch('close')}>&#10005;</button>
  </div>

  <div class="sidebar-content">
    {#if activeTab === 'annotations'}
      {#if $annotations.length === 0}
        <p class="placeholder">Nessuna annotazione</p>
      {:else}
        <ul class="annotation-list">
          {#each $annotations as ann (ann.id)}
            <li class="annotation-item">
              <span class="ann-type">Pag {ann.pageNumber} — {typeLabels[ann.type]}</span>
              <span class="ann-text">{ann.data.text || ann.type}</span>
              <button class="btn icon" on:click={() => goToPage(ann.pageNumber)} title="Vai">&#8594;</button>
              <button class="btn icon" on:click={() => removeAnnotation(ann.id!)} title="Elimina">&times;</button>
            </li>
          {/each}
        </ul>
      {/if}
    {:else if activeTab === 'outline'}
      <p class="placeholder">Indice PDF (non ancora implementato)</p>
    {/if}
  </div>
</div>

<style>
  .sidebar {
    width: 0;
    overflow: hidden;
    background: var(--surface);
    border-right: 1px solid var(--border);
    transition: width 0.2s ease;
    display: flex;
    flex-direction: column;
    min-height: 0;
  }
  .sidebar.open {
    width: 260px;
  }
  .sidebar-header {
    display: flex;
    align-items: center;
    padding: 8px;
    border-bottom: 1px solid var(--border);
  }
  .tabs {
    display: flex;
    gap: 4px;
    flex: 1;
  }
  .tab {
    padding: 5px 10px;
    border: none;
    background: transparent;
    color: var(--text);
    cursor: pointer;
    border-radius: 4px;
    font-size: 16px;
  }
  .tab.active {
    background: var(--surface2);
  }
  .close-btn {
    padding: 4px 8px;
  }
  .sidebar-content {
    flex: 1;
    overflow-y: auto;
    padding: 4px;
  }
  .placeholder {
    color: var(--text-lo);
    text-align: center;
    padding: 24px 16px;
    font-size: 13px;
  }
  .annotation-list {
    list-style: none;
  }
  .annotation-item {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 6px 8px;
    border-bottom: 1px solid var(--border);
    font-size: 12px;
  }
  .ann-type {
    font-size: 11px;
    color: var(--text-lo);
    white-space: nowrap;
    min-width: 70px;
  }
  .ann-text {
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    color: var(--text);
  }
</style>
