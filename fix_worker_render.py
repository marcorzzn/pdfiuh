import re

with open('src/workers/pdf-renderer.worker.ts', 'r') as f:
    content = f.read()

content = content.replace("const { pageNumber, scale } = payload;", "const { pageNumber, scale, isThumbnail } = payload;")
content = content.replace("payload: {\n            pageNumber,\n            bitmap,\n            width: Math.ceil(viewport.width),\n            height: Math.ceil(viewport.height)\n          }", "payload: {\n            pageNumber,\n            bitmap,\n            width: Math.ceil(viewport.width),\n            height: Math.ceil(viewport.height),\n            isThumbnail\n          }")

with open('src/workers/pdf-renderer.worker.ts', 'w') as f:
    f.write(content)
