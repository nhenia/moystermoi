with open('/app/scripts/prepare.cjs', 'r') as f:
    content = f.read()

content = content.replace(
    "const files=['index.html','config.js','script.js','style.css','manifest.webmanifest','icon.svg','icon-192.png','icon-512.png'];",
    "const files=['index.html','config.js','script.js','style.css','manifest.webmanifest','icon.svg','icon-192.png','icon-512.png','image.png'];"
)

with open('/app/scripts/prepare.cjs', 'w') as f:
    f.write(content)
