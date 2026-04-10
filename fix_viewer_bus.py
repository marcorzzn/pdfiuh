import re

with open('src/ui/components/Viewer.ts', 'r') as f:
    content = f.read()

# Replace direct worker.onmessage with bus listener

content = content.replace("if (this.worker) {\n      this.worker.onmessage = (e) => {\n        const { type, payload } = e.data;\n        if (type === 'RENDERED') {\n          this.pendingRenders.delete(payload.pageNumber);\n          const page = this.currentPages.get(payload.pageNumber);\n          if (page) {\n            const ctx = page.canvas.getContext('2d');\n            if (ctx) {\n              page.canvas.width = payload.width;\n              page.canvas.height = payload.height;\n              const displayWidth = payload.width * this.zoom;\n              const displayHeight = payload.height * this.zoom;\n              \n              page.canvas.style.width = `${displayWidth}px`;\n              page.canvas.style.height = `${displayHeight}px`;\n              page.container.style.width = `${displayWidth}px`;\n              page.container.style.height = `${displayHeight}px`;\n\n              ctx.drawImage(payload.bitmap, 0, 0);\n\n              // Update Fabric canvas dimensions\n              page.fabricCanvas.setWidth(displayWidth);\n              page.fabricCanvas.setHeight(displayHeight);\n              page.fabricCanvas.setZoom(this.zoom);\n\n              this.loadAnnotations(payload.pageNumber, page.fabricCanvas);\n            }\n          }\n        }\n      };\n    }", "")

bus_listener = """    bus.subscribe('page-rendered', (payload: any) => {
        this.pendingRenders.delete(payload.pageNumber);
        const page = this.currentPages.get(payload.pageNumber);
        if (page) {
            const ctx = page.canvas.getContext('2d');
            if (ctx) {
                page.canvas.width = payload.width;
                page.canvas.height = payload.height;
                const displayWidth = payload.width * this.zoom;
                const displayHeight = payload.height * this.zoom;

                page.canvas.style.width = `${displayWidth}px`;
                page.canvas.style.height = `${displayHeight}px`;
                page.container.style.width = `${displayWidth}px`;
                page.container.style.height = `${displayHeight}px`;

                ctx.drawImage(payload.bitmap, 0, 0);

                page.fabricCanvas.setWidth(displayWidth);
                page.fabricCanvas.setHeight(displayHeight);
                page.fabricCanvas.setZoom(this.zoom);

                this.loadAnnotations(payload.pageNumber, page.fabricCanvas);
            }
        }
    });"""

content = content.replace("bus.subscribe('save-pdf', () => {\n        this.saveAnnotationsToStorage();\n        alert('Annotazioni salvate localmente!');\n    });", "bus.subscribe('save-pdf', () => {\n        this.saveAnnotationsToStorage();\n        alert('Annotazioni salvate localmente!');\n    });\n\n" + bus_listener)

with open('src/ui/components/Viewer.ts', 'w') as f:
    f.write(content)
