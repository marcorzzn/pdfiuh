import re

with open('src/ui/components/Toolbar.ts', 'r') as f:
    content = f.read()

# Add search and read aloud buttons to toolbar
search_btns = """
        <!-- Tools -->
        <div class="toolbar-group">
            <button class="btn btn-icon" id="searchBtn" title="Cerca">🔍</button>
            <button class="btn btn-icon" id="readAloudBtn" title="Leggi ad alta voce">🔊</button>
        </div>
"""

content = content.replace("<!-- Annotations -->", search_btns + "\n        <!-- Annotations -->")
content = content.replace("this.shadowRoot!.getElementById('rotateRight')?.addEventListener('click', () => this.handleRotate(90));", "this.shadowRoot!.getElementById('rotateRight')?.addEventListener('click', () => this.handleRotate(90));\n    this.shadowRoot!.getElementById('searchBtn')?.addEventListener('click', () => bus.publish('toggle-search'));\n    this.shadowRoot!.getElementById('readAloudBtn')?.addEventListener('click', () => bus.publish('read-aloud'));")

with open('src/ui/components/Toolbar.ts', 'w') as f:
    f.write(content)
