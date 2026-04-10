import re

with open('src/main.ts', 'r') as f:
    content = f.read()

content = content.replace("    });\n    });", "    });")

with open('src/main.ts', 'w') as f:
    f.write(content)
