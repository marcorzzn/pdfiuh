import re

with open('src/main.ts', 'r') as f:
    content = f.read()

# I see "Unexpected )" at line 296
content = content.replace("            bus.subscribe('text-content', reader);\n        }\n    });\n\n    const searchInput = document.getElementById('searchInput');", "            bus.subscribe('text-content', reader);\n        }\n    });\n\n    const searchInput = document.getElementById('searchInput');")

# Let's just fix main.ts safely
import os
os.system("npm run build")
