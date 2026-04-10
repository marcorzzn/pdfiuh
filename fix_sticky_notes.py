import re

with open('src/ui/components/Viewer.ts', 'r') as f:
    content = f.read()

# Replace sticky note logic
sticky_logic = """          } else if (this.activeTool === 'note') {
               const pointer = fCanvas.getPointer(o.e);

               const note = document.createElement('div');
               note.className = 'sticky-note';
               note.style.position = 'absolute';
               note.style.left = `${pointer.x}px`;
               note.style.top = `${pointer.y}px`;
               note.style.width = '200px';
               note.style.background = '#fff59d';
               note.style.padding = '12px';
               note.style.borderRadius = '4px';
               note.style.boxShadow = '0 2px 8px rgba(0,0,0,0.2)';
               note.style.zIndex = '50';
               note.innerHTML = `
                   <div class="close-note" style="position: absolute; top: 4px; right: 8px; cursor: pointer; font-size: 18px; color: #666;">×</div>
                   <textarea placeholder="Inserisci la tua nota..." style="width: 100%; border: none; background: transparent; resize: none; font-family: inherit; outline: none;"></textarea>
               `;

               const closeBtn = note.querySelector('.close-note');
               if (closeBtn) {
                   closeBtn.addEventListener('click', () => {
                       note.remove();
                       this.saveAnnotationsToStorage();
                   });
               }

               const textarea = note.querySelector('textarea');
               if (textarea) {
                   textarea.addEventListener('input', () => {
                       this.saveAnnotationsToStorage();
                   });
               }

               const page = this.currentPages.get(pageNum);
               if (page) {
                   page.container.appendChild(note);
               }

               this.saveAnnotationsToStorage();"""

content = content.replace("""          } else if (this.activeTool === 'note') {
               const pointer = fCanvas.getPointer(o.e);
               const rect = new fabric.Rect({
                   left: pointer.x,
                   top: pointer.y,
                   width: 30,
                   height: 30,
                   fill: '#fff59d',
                   selectable: true
               });
               fCanvas.add(rect);
               this.saveAnnotationsToStorage();""", sticky_logic)


# Add sticky note loading to loadAnnotations
load_annotations = """  private async loadAnnotations(pageNum: number, fCanvas: fabric.Canvas) {
    const annotations = await storage.loadAnnotations(this.docId);
    const pageAnnots = annotations.filter(a => a.page === pageNum);

    if (pageAnnots.length > 0) {
        try {
            const json = pageAnnots[0].text;
            if (json) {
                const parsed = JSON.parse(json);
                if (parsed.fabric) {
                    fCanvas.loadFromJSON(parsed.fabric, () => {
                        fCanvas.renderAll();
                    });
                }
                if (parsed.stickyNotes) {
                    const page = this.currentPages.get(pageNum);
                    if (page) {
                        parsed.stickyNotes.forEach((noteData: any) => {
                           const note = document.createElement('div');
                           note.className = 'sticky-note';
                           note.style.position = 'absolute';
                           note.style.left = noteData.left;
                           note.style.top = noteData.top;
                           note.style.width = '200px';
                           note.style.background = '#fff59d';
                           note.style.padding = '12px';
                           note.style.borderRadius = '4px';
                           note.style.boxShadow = '0 2px 8px rgba(0,0,0,0.2)';
                           note.style.zIndex = '50';
                           note.innerHTML = `
                               <div class="close-note" style="position: absolute; top: 4px; right: 8px; cursor: pointer; font-size: 18px; color: #666;">×</div>
                               <textarea placeholder="Inserisci la tua nota..." style="width: 100%; border: none; background: transparent; resize: none; font-family: inherit; outline: none;">${noteData.content}</textarea>
                           `;

                           const closeBtn = note.querySelector('.close-note');
                           if (closeBtn) {
                               closeBtn.addEventListener('click', () => {
                                   note.remove();
                                   this.saveAnnotationsToStorage();
                               });
                           }

                           const textarea = note.querySelector('textarea');
                           if (textarea) {
                               textarea.addEventListener('input', () => {
                                   this.saveAnnotationsToStorage();
                               });
                           }

                           page.container.appendChild(note);
                        });
                    }
                }
            }
        } catch (e) {
            console.error('Error loading annotations', e);
        }
    }
  }"""

content = re.sub(r"  private async loadAnnotations\(pageNum: number, fCanvas: fabric\.Canvas\) \{.*?\n  \}", load_annotations, content, flags=re.DOTALL)


# Update save to storage to include sticky notes
save_storage = """  private async saveAnnotationsToStorage() {
      this.currentPages.forEach(async (page, pageNum) => {
          const stickyNotesData: any[] = [];
          const notes = page.container.querySelectorAll('.sticky-note');
          notes.forEach(note => {
              const el = note as HTMLElement;
              const textarea = note.querySelector('textarea');
              stickyNotesData.push({
                  left: el.style.left,
                  top: el.style.top,
                  content: textarea ? textarea.value : ''
              });
          });

          const data = {
              fabric: page.fabricCanvas.toJSON(),
              stickyNotes: stickyNotesData
          };

          const json = JSON.stringify(data);
          const ann: Omit<Annotation, 'docId'> = {
              id: `page_${pageNum}`,
              page: pageNum,
              type: 'text',
              color: '',
              text: json
          };
          await storage.saveAnnotation(this.docId, ann as Annotation);
          bus.publish('annotations-updated');
      });
  }"""

content = re.sub(r"  private async saveAnnotationsToStorage\(\) \{.*?\n  \}", save_storage, content, flags=re.DOTALL)

# Add clear sticky notes
content = content.replace("page.fabricCanvas.clear();", "page.fabricCanvas.clear();\n            page.container.querySelectorAll('.sticky-note').forEach(n => n.remove());")

with open('src/ui/components/Viewer.ts', 'w') as f:
    f.write(content)
