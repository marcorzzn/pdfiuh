<script lang="ts">
  import { activeTool, addAnnotation, annotations } from '../stores/annotations.store';
  import type { Annotation } from '../core/annotation-store';
  import { currentPage, zoom } from '../stores/viewer.store';

  const props = $props<{ docId: string; canvasWidth: number; canvasHeight: number }>();

  let svgEl: SVGSVGElement;
  let isDrawing = $state(false);
  let currentPath = $state<{ x: number; y: number }[]>([]);
  let noteText = $state('');
  let notePoint = $state<{ x: number; y: number } | null>(null);
  let selectStart = $state<{ x: number; y: number } | null>(null);
  let selectRect = $state<{ x: number; y: number; width: number; height: number } | null>(null);

  // FIX BUG #5b: le coordinate devono essere in spazio PDF (normalizzate per zoom)
  // Le coordinate SVG (pixel schermo) vengono divise per lo zoom corrente
  // così le annotazioni restano allineate al contenuto PDF al variare dello zoom.
  function getCoords(e: MouseEvent): { x: number; y: number } | null {
    if (!svgEl) return null;
    const rect = svgEl.getBoundingClientRect();
    const currentZoom = $zoom;
    return {
      x: (e.clientX - rect.left) / currentZoom,
      y: (e.clientY - rect.top) / currentZoom
    };
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
      if (coords) currentPath = [...currentPath, coords];
    }
  }

  function onPointerUp() {
    if (selectStart && selectRect && selectRect.width > 5 && selectRect.height > 5) {
      const tool = $activeTool;
      if (tool === 'highlight' || tool === 'underline' || tool === 'strikeout') {
        const colors: Record<string, string> = {
          highlight: '#e5c07b',
          underline: '#4f8ef7',
          strikeout: '#e06c75'
        };
        addAnnotation({
          docId: props.docId,
          pageNumber: $currentPage,
          type: tool,
          data: { rect: selectRect, color: colors[tool] }
        });
      }
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

  // Coordinate SVG: moltiplica per zoom per tornare allo spazio schermo
</script>

<!-- FIX BUG #5a: width e height espliciti uguali al canvas PDF renderizzato.
     viewBox + transform scaling gestisce il mapping coordinate PDF → schermo.
     Le annotazioni vengono salvate in coordinate PDF (normalizzate) e scalate
     al render tramite il transform sull'SVG. -->
<svg
  bind:this={svgEl}
  class="annotation-layer"
  xmlns="http://www.w3.org/2000/svg"
  width={props.canvasWidth}
  height={props.canvasHeight}
  viewBox={`0 0 ${props.canvasWidth / $zoom} ${props.canvasHeight / $zoom}`}
  onmousedown={onPointerDown}
  onmousemove={onPointerMove}
  onmouseup={onPointerUp}
  onmouseleave={onPointerUp}
>
  {#each $annotations as ann (ann.id)}
    {#if ann.pageNumber === $currentPage}
      {#if ann.type === 'highlight' && ann.data.rect}
        <rect
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
        >💬 {ann.data.text}</text>
      {:else if ann.type === 'ink' && ann.data.paths}
        {#each ann.data.paths as path}
          <path
            d={pathToD(path.points)}
            fill="none"
            stroke={getAnnColor(ann)}
            stroke-width="2"
            stroke-linecap="round"
          />
        {/each}
      {/if}
    {/if}
  {/each}

  {#if isDrawing && currentPath.length > 0}
    <path d={pathToD(currentPath)} fill="none" stroke="#e5c07b" stroke-width="2" stroke-linecap="round" />
  {/if}

  {#if selectRect}
    <rect
      x={selectRect.x}
      y={selectRect.y}
      width={selectRect.width}
      height={selectRect.height}
      fill="rgba(79,142,247,0.15)"
      stroke="#4f8ef7"
      stroke-dasharray="4"
    />
  {/if}

  {#if notePoint}
    <foreignObject x={notePoint.x} y={notePoint.y} width={220 / $zoom} height={100 / $zoom}>
      <div class="note-input-box">
        <textarea bind:value={noteText} placeholder="Scrivi nota..."></textarea>
        <div class="note-actions">
          <button class="btn" onclick={saveNote}>Salva</button>
          <button class="btn" onclick={() => { notePoint = null; noteText = ''; }}>Annulla</button>
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
    /* FIX: pointer-events solo quando c'è uno strumento attivo,
       altrimenti blocca lo scroll del viewer.
       Gestire in JS controllando activeTool prima di bloccare l'evento. */
    pointer-events: auto;
    z-index: 5;
  }
  .note-input-box {
    padding: 4px;
    background: var(--surface);
    border: 1px solid var(--accent);
    border-radius: 4px;
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
