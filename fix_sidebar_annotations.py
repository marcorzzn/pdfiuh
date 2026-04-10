import re

with open('src/ui/components/Sidebar.ts', 'r') as f:
    content = f.read()

# Make sidebar update annotations list

new_code = """    bus.subscribe('annotations-updated', () => {
        // Just a stub for now, in a real app we'd load annotations from storage
        const list = this.shadowRoot!.getElementById('annotationsList');
        if (list) {
            list.innerHTML = '<div class="annotation-item">Annotazione aggiornata</div>';
        }
    });"""

content = content.replace("bus.subscribe('toggle-sidebar', () => this.toggle());", "bus.subscribe('toggle-sidebar', () => this.toggle());\n    " + new_code)

with open('src/ui/components/Sidebar.ts', 'w') as f:
    f.write(content)
