import re

with open('src/workers/pdf-renderer.worker.ts', 'r') as f:
    content = f.read()

# Add GET_TEXT type
get_text_logic = """
  if (type === 'GET_TEXT') {
    const { pageNumber } = payload;
    if (!pdfDoc) return;
    try {
      const page = await pdfDoc.getPage(pageNumber);
      const textContent = await page.getTextContent();
      const text = textContent.items.map((item: any) => item.str).join(' ');
      self.postMessage({
        type: 'TEXT_CONTENT',
        payload: {
          pageNumber,
          text
        }
      });
    } catch (e) {
      console.error(e);
    }
    return;
  }
"""

content = content.replace("if (type === 'SET_MAX_POOL') {", get_text_logic + "\n  if (type === 'SET_MAX_POOL') {")

with open('src/workers/pdf-renderer.worker.ts', 'w') as f:
    f.write(content)
