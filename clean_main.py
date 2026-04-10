import re

with open('src/main.ts', 'r') as f:
    content = f.read()

# I need to clean up the duplicate search logic and dangling code
cleaned = re.sub(r"            // Wait for text and read \(simplified\).*?this\.hideBootScreen\(\);", "    this.hideBootScreen();", content, flags=re.DOTALL)

with open('src/main.ts', 'w') as f:
    f.write(cleaned)
