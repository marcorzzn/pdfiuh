import re

with open('src/main.ts', 'r') as f:
    content = f.read()

# Make read aloud actually read the current page by subscribing to page-changed
read_aloud_fix = """
    let currentPageForRead = 1;
    bus.subscribe('page-changed', (page: number) => {
        currentPageForRead = page;
    });

    bus.subscribe('read-aloud', () => {
        if (this.worker) {
            this.worker.postMessage({ type: 'GET_TEXT', payload: { pageNumber: currentPageForRead } });

            const reader = (payload: any) => {
                if (payload.pageNumber === currentPageForRead) {
                    if (window.speechSynthesis.speaking) {
                        window.speechSynthesis.cancel();
                        return;
                    }
                    const utterance = new SpeechSynthesisUtterance(payload.text);
                    utterance.lang = 'it-IT';
                    window.speechSynthesis.speak(utterance);
                }
            };
            bus.subscribe('text-content', reader);
        }
    });
"""

content = re.sub(r"    bus\.subscribe\('read-aloud', \(\) => \{.*?\}\);\n", read_aloud_fix, content, flags=re.DOTALL)

with open('src/main.ts', 'w') as f:
    f.write(content)
