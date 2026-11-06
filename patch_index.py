import re

with open('/app/index.html', 'r') as f:
    content = f.read()

# Insert the image before the form
replacement = '<header><h1 id="app-name">TINY NOTES</h1></header>\n    <div class="onboarding-placeholder" style="text-align: center; margin-bottom: 24px;">\n      <img src="./image.png" alt="Onboarding Placeholder" style="max-width: 100%; height: auto; border-radius: 8px;">\n    </div>'
content = content.replace('<header><h1 id="app-name">TINY NOTES</h1></header>', replacement)

with open('/app/index.html', 'w') as f:
    f.write(content)
