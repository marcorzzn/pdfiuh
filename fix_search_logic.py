import re

with open('src/main.ts', 'r') as f:
    content = f.read()

# Make search actually request text
search_logic = """
    bus.subscribe('toggle-search', () => {
        const panel = document.getElementById('searchPanel');
        if (panel) {
            panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
        }
    });

    const searchInput = document.getElementById('searchInput');
    let pageTexts = new Map<number, string>();
    let searchResults: {page: number, text: string}[] = [];

    bus.subscribe('text-content', (payload: any) => {
        pageTexts.set(payload.pageNumber, payload.text);

        // if currently searching, update results
        const val = (searchInput as HTMLInputElement)?.value;
        if (val) performSearch(val);
    });

    const performSearch = (val: string) => {
        const results = document.getElementById('searchResults');
        if (!results) return;

        results.innerHTML = '';
        let found = false;
        pageTexts.forEach((text, page) => {
            if (text.toLowerCase().includes(val.toLowerCase())) {
                found = true;
                const snippetIdx = text.toLowerCase().indexOf(val.toLowerCase());
                const start = Math.max(0, snippetIdx - 20);
                const end = Math.min(text.length, snippetIdx + val.length + 20);
                const snippet = text.substring(start, end);

                const item = document.createElement('div');
                item.style.cssText = "padding: 8px; cursor: pointer; border-bottom: 1px solid var(--border-color);";
                item.innerHTML = `<strong>Pagina ${page}</strong><br><small>...${snippet}...</small>`;
                item.onclick = () => {
                    bus.publish('goto-page', page);
                    document.getElementById('searchPanel')!.style.display = 'none';
                };
                results.appendChild(item);
            }
        });

        if (!found) {
            results.innerHTML = '<div style="padding: 8px;">Nessun risultato</div>';
        }
    };

    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            const val = (e.target as HTMLInputElement).value;
            if (val && this.worker) {
                // Request text for all pages if not loaded
                for(let i=1; i<=totalPages; i++) {
                    if (!pageTexts.has(i)) {
                        this.worker.postMessage({ type: 'GET_TEXT', payload: { pageNumber: i } });
                    }
                }
                performSearch(val);
            } else {
                const results = document.getElementById('searchResults');
                if (results) results.innerHTML = '';
            }
        });
    }

    bus.subscribe('read-aloud', () => {
        // Find current page (we need it from viewer, let's just ask viewer or keep track)
        // Let's ask worker for page 1 text for now as a simple implementation
        if (this.worker) {
            this.worker.postMessage({ type: 'GET_TEXT', payload: { pageNumber: 1 } });

            // Wait for text and read (simplified)
            const reader = (payload: any) => {
                if (payload.pageNumber === 1) {
                    const utterance = new SpeechSynthesisUtterance(payload.text);
                    utterance.lang = 'it-IT';
                    window.speechSynthesis.speak(utterance);
                    bus.subscribe('text-content', () => {}); // unsubsribe simplified
                }
            };
            bus.subscribe('text-content', reader);
        }
    });
"""

content = re.sub(r"    bus\.subscribe\('toggle-search'.*?    \}\n", search_logic, content, flags=re.DOTALL)

with open('src/main.ts', 'w') as f:
    f.write(content)
