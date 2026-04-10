import re

with open('src/main.ts', 'r') as f:
    content = f.read()

search_panel = """
    <!-- Search Panel -->
    <div class="search-panel" id="searchPanel" style="display: none; position: absolute; top: 60px; right: 20px; background: var(--toolbar-bg); border: 1px solid var(--border-color); border-radius: 4px; padding: 16px; box-shadow: var(--shadow); z-index: 100; min-width: 300px;">
        <h3>Cerca nel documento</h3>
        <input type="text" class="search-input" id="searchInput" placeholder="Inserisci testo da cercare..." style="width: 100%; padding: 8px; border: 1px solid var(--border-color); border-radius: 4px; margin-bottom: 8px;">
        <div class="search-results" id="searchResults" style="max-height: 200px; overflow-y: auto;"></div>
    </div>
"""

content = content.replace("<pdfiuh-toolbar></pdfiuh-toolbar>", "<pdfiuh-toolbar></pdfiuh-toolbar>\n" + search_panel)

search_logic = """
    bus.subscribe('toggle-search', () => {
        const panel = document.getElementById('searchPanel');
        if (panel) {
            panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
        }
    });

    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            const val = (e.target as HTMLInputElement).value;
            // Fake search results for now
            const results = document.getElementById('searchResults');
            if (results) {
                if (val) {
                    results.innerHTML = `<div style="padding: 8px; cursor: pointer;">Risultato per "${val}" in pagina 1</div>`;
                } else {
                    results.innerHTML = '';
                }
            }
        });
    }
"""

content = content.replace("this.hideBootScreen();", search_logic + "\n    this.hideBootScreen();")

with open('src/main.ts', 'w') as f:
    f.write(content)
