<script lang="ts">
  import { loadPDFAsArrayBuffer, computeDocId } from '../core/pdf-loader';

  let { onload }: { onload: (docId: string, buffer: ArrayBuffer, fileName: string) => void } = $props();

  let dragging = $state(false);

  async function handleFile(file: File) {
    if (file.type !== 'application/pdf') return;
    const buffer = await loadPDFAsArrayBuffer(file);
    const docId = await computeDocId(buffer);
    onload(docId, buffer, file.name);
  }

  function onDragOver(e: DragEvent) {
    e.preventDefault();
    dragging = true;
  }

  function onDragLeave() {
    dragging = false;
  }

  async function onDrop(e: DragEvent) {
    e.preventDefault();
    dragging = false;
    const files = Array.from(e.dataTransfer?.files || []);
    if (files.length > 0) await handleFile(files[0]);
  }

  function onFileInput(e: Event) {
    const files = (e.target as HTMLInputElement).files;
    if (files && files.length > 0) handleFile(files[0]);
  }
</script>

<div
  class="dropzone"
  class:dragging
  ondragover={onDragOver}
  ondragleave={onDragLeave}
  ondrop={onDrop}
>
  <div class="content">
    <h1>pdfiuh</h1>
    <p>Trascina un file PDF qui oppure</p>
    <label class="btn" for="file-input">Scegli file</label>
    <input id="file-input" type="file" accept="application/pdf" onchange={onFileInput} />
  </div>
</div>

<style>
  .dropzone {
    display: flex;
    align-items: center;
    justify-content: center;
    flex: 1;
    border: 2px dashed var(--border);
    margin: 20%;
    padding: 40px;
    border-radius: 12px;
    transition: border-color 0.2s, background 0.2s;
  }
  .dropzone.dragging {
    border-color: var(--accent);
    background: rgba(79, 142, 247, 0.05);
  }
  .content {
    text-align: center;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 16px;
  }
  h1 {
    font-size: 28px;
    color: var(--text-hi);
    letter-spacing: 0.05em;
  }
  #file-input { display: none; }
</style>
