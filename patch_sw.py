with open('/app/sw.js', 'r') as f:
    content = f.read()

content = content.replace(
    "const ASSETS = ['./', './index.html', './style.css', './script.js', './config.js', './manifest.webmanifest', './icon.svg', './icon-192.png', './icon-512.png'];",
    "const ASSETS = ['./', './index.html', './style.css', './script.js', './config.js', './manifest.webmanifest', './icon.svg', './icon-192.png', './icon-512.png', './image.png'];"
)

with open('/app/sw.js', 'w') as f:
    f.write(content)
