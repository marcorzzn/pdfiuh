import re

with open('src/main.ts', 'r') as f:
    content = f.read()

content = content.replace("bus.publish('pdf-info', { pageCount: totalPages, fileName: this.fileName });", "bus.publish('pdf-info', { pageCount: totalPages, fileName: this.fileName, worker: this.worker });")

# also route thumbnail rendering to bus
worker_handler = """  private handleWorkerMessage(data: any) {
    const { type } = data;
    console.log(`[Main] Worker Message: ${type}`);

    switch (type) {
      case 'LOADED':
        this.updateStatus('Documento Caricato. Costruzione Interfaccia...');
        this.setupMainUI(data.payload.totalPages, data.payload.outline || []);
        break;

      case 'RENDERED':
        if (data.payload.isThumbnail) {
           bus.publish('thumbnail-rendered', data.payload);
        } else {
           bus.publish('page-rendered', data.payload);
        }
        break;

      case 'TEXT_CONTENT':
        bus.publish('text-content', data.payload);
        break;

      case 'ERROR':
        this.handleCriticalError(data.message || data.payload || 'Errore sconosciuto del worker');
        break;
    }
  }
"""

content = re.sub(r'private handleWorkerMessage\(data: any\) \{.*?\n  \}', worker_handler, content, flags=re.DOTALL)

with open('src/main.ts', 'w') as f:
    f.write(content)
