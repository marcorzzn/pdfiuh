<script lang="ts">
  import { activeTool, addAnnotation, annotations } from '../stores/annotations.store';
  import type { Annotation } from '../core/annotation-store';
  import { currentPage } from '../stores/viewer.store';

  const props = $props<{ docId: string }>();

  let svgEl: SVGSVGElement;
  let isDrawing = $state(false);
  let currentPath = $state<{ x: number; y: number }[]>([]);
  let noteText = $state('');
  let notePoint = $state<{ x: number; y: number } | null>(null);
  let highlightStart = $state<{ x: number; y: number } | null>(null);
  let selectStart = $state<{ x: number; y: number } | null>(null);
  let selectRect = $state<{ x: number; y: number; width: number; height: number } | null>(null);

  function getCoords(e: MouseEvent): { x: number; y: number } | null {
    if (!svgEl) return null;
    const rect = svgEl.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  function onPointerDown(e: MouseEvent) {
    const coords = getCoords(e);
    if (!coords) return;

    const tool = $activeTool;

    if (tool === 'highlight' || tool === 'underline' || tool === 'strikeout') {
      selectStart = coords;
      return;
    }

    if (tool === 'ink') {
      isDrawing = true;
      currentPath = [coords];
      return;
    }

    if (tool === 'note') {
      notePoint = coords;
      return;
    }
  }

  function onPointerMove(e: MouseEvent) {
    if (selectStart && $activeTool !== 'select') {
      const coords = getCoords(e);
      if (coords) {
        const x = Math.min(selectStart.x, coords.x);
        const y = Math.min(selectStart.y, coords.y);
        const width = Math.abs(coords.x - selectStart.x);
        const height = Math.abs(coords.y - selectStart.y);
        selectRect = { x, y, width, height };
      }
      return;
    }
    if (isDrawing && $activeTool === 'ink') {
      const coords = getCoords(e);
      if (coords) {
        currentPath = [...currentPath, coords];
      }
    }
  }

  function onPointerUp(e: MouseEvent) {
    if (selectStart && selectRect && selectRect.width > 5 && selectRect.height > 5) {
      const tool = $activeTool;
      if (tool === 'highlight' || tool === 'underline' || tool === 'strikeout') {
        const colors: Record<string, string> = { highlight: '#e5c07b', underline: '#4f8ef7', strikeout: '#e06c75' };
        addAnnotation({
          docId: props.docId,
          pageNumber: $currentPage,
          type: tool,
          data: { rect: selectRect, color: colors[tool] }
        });
      }
      selectStart = null;
      selectRect = null;
      return;
    }

    if (isDrawing && currentPath.length > 1) {
      addAnnotation({
        docId: props.docId,
        pageNumber: $currentPage,
        type: 'ink',
        data: { paths: [{ points: currentPath }] }
      });
    }
    isDrawing = false;
    currentPath = [];
    selectStart = null;
    selectRect = null;
  }

  function saveNote() {
    if (!notePoint) return;
    addAnnotation({
      docId: props.docId,
      pageNumber: $currentPage,
      type: 'note',
      data: { rect: { ...notePoint, width: 0, height: 0 }, text: noteText }
    });
    noteText = '';
    notePoint = null;
  }

  function pathToD(pts: { x: number; y: number }[]): string {
    return pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
  }

  function getAnnColor(ann: Annotation): string {
    return ann.data.color ?? '#e5c07b';
  }
</script>

<svg
  bind:this={svgEl}
  class="annotation-layer"
  xmlns="http://www.w3.org/2000/svg"
  on:mousedown={onPointerDown}
  on:mousemove={onPointerMove}
  on:mouseup={onPointerUp}
  on:mouseleave={onPointerUp}
>
  {#each $annotations as ann (ann.id)}
    {#if ann.pageNumber === $currentPage}
      {#if ann.type === 'highlight' && ann.data.rect}
        <rect
          class="ann-highlight"
          x={ann.data.rect.x}
          y={ann.data.rect.y}
          width={ann.data.rect.width}
          height={ann.data.rect.height}
          fill={getAnnColor(ann)}
          opacity="0.3"
        />
      {:else if ann.type === 'underline' && ann.data.rect}
        <line
          x1={ann.data.rect.x}
          y1={ann.data.rect.y + ann.data.rect.height}
          x2={ann.data.rect.x + ann.data.rect.width}
          y2={ann.data.rect.y + ann.data.rect.height}
          stroke={getAnnColor(ann)}
          stroke-width="2"
        />
      {:else if ann.type === 'strikeout' && ann.data.rect}
        <line
          x1={ann.data.rect.x}
          y1={ann.data.rect.y + ann.data.rect.height / 2}
          x2={ann.data.rect.x + ann.data.rect.width}
          y2={ann.data.rect.y + ann.data.rect.height / 2}
          stroke={getAnnColor(ann)}
          stroke-width="2"
        />
      {:else if ann.type === 'note' && ann.data.rect}
        <text
          x={ann.data.rect.x}
          y={ann.data.rect.y + 16}
          fill="#4f8ef7"
          font-size="12"
          class="ann-note"
        >💬 {ann.data.text}</text>
      {:else if ann.type === 'ink' && ann.data.paths}
        {#each ann.data.paths as path}
          <path d={pathToD(path.points)} fill="none" stroke={getAnnColor(ann)} stroke-width="2" stroke-linecap="round"/>
        {/each}
      {/if}
    {/if}
  {/each}

  <!-- Active drawing preview -->
  {#if isDrawing && currentPath.length > 0}
    <path d={pathToD(currentPath)} fill="none" stroke="#e5c07b" stroke-width="2" stroke-linecap="round" />
  {/if}

  <!-- Active selection preview -->
  {#if selectRect && $activeTool !== 'select'}
    <rect x={selectRect.x} y={selectRect.y} width={selectRect.width} height={selectRect.height} fill="rgba(79,142,247,0.15)" stroke="#4f8ef7" stroke-dasharray="4" />
  {/if}

  <!-- Note input -->
  {#if notePoint}
    <foreignObject x={notePoint.x} y={notePoint.y} width="220" height="100">
      <div class="note-input-box">
        <textarea bind:value={noteText} placeholder="Scrivi nota..." autofocus />
        <div class="note-actions">
          <button class="btn" on:click={saveNote}>Salva</button>
          <button class="btn" on:click={() => { notePoint = null; noteText = ''; }}>Annulla</button>
        </div>
      </div>
    </foreignObject>
  {/if}
</svg>

<style>
  .annotation-layer {
    position: absolute;
    top: 0;
    left: 0;
    pointer-events: auto;
    z-index: 5;
  }
  .note-input-box {
    padding: 4px;
  }
  .note-input-box textarea {
    width: 210px;
    height: 60px;
    background: var(--surface);
    border: 1px solid var(--accent);
    border-radius: 4px;
    color: var(--text);
    padding: 6px;
    font-size: 12px;
    resize: none;
  }
  .note-actions {
    display: flex;
    gap: 6px;
    margin-top: 4px;
  }
</style>
