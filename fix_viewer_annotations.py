import re

with open('src/ui/components/Viewer.ts', 'r') as f:
    content = f.read()

# Add an event to update annotations list when annotations change
content = content.replace("await storage.saveAnnotation(this.docId, ann as Annotation);", "await storage.saveAnnotation(this.docId, ann as Annotation);\n          bus.publish('annotations-updated');")

with open('src/ui/components/Viewer.ts', 'w') as f:
    f.write(content)
