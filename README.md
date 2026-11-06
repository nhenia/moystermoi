# 🌸 Micro-app template — start here! ✨

A super cute, reusable starting point for tiny, phone-friendly apps! 📱 The included **TINY NOTES** app already saves, dates, edits, and deletes text, remembers your little entries in this browser, and even works offline after you've visited it once! 🪄

No login, backend, analytics, external libraries, or paid services here. 🙅‍♀️ This is a simple text-entry starter. (If you want photo apps, reminders, or shared accounts, they'll need a bit more love and work! 💕)

## 🎨 Make your own app!

1. At the very top of this GitHub repository, click on **Use this template → Create a new repository**. 🎀
2. Give your lovely new copy its own special name, like `mentioned` or `my-little-notebook`. Choose **Public** for free GitHub Pages hosting! ☁️
3. Open up [APP-BRIEF.md](APP-BRIEF.md), click that little pencil icon ✏️, and fill in what your app is going to do. **Commit changes** simply means you're saving a version of your wonderful work! 💖
4. Ask your AI assistant to read that brief and [AGENTS.md](AGENTS.md). Or, if you're feeling creative, change the words and colors yourself in [config.js](config.js) 🌈.
5. Publish your shiny new copy using the fun steps below! Keep this original template safe as your reusable starting point. 🪴

*(Psst! Changes to the template don't automatically change the apps you already made from it. Each copy lives its own independent, happy life! 🌱)*

## 🚀 Put your app online for free!

1. In your new repository, skip over to **Settings → Pages**. ⚙️
2. Under **Build and deployment**, gently choose **GitHub Actions** as the source. 💫
3. Open the **Actions** tab. If GitHub politely asks you to enable workflows for this copy, go ahead and enable them! ✅
4. Click **Publish micro-app → Run workflow → Run workflow**. (A workflow is just a helpful automatic checklist! 📝)
5. Wait patiently for the run to turn a happy green! 💚 **Settings → Pages** will then show your app's new address, normally `https://YOUR-NAME.github.io/YOUR-REPOSITORY/`. 🎉

Every little change you save to `main` after this will automatically check and republish your app! The workflow updates the installation name and offline cache from your settings. It only publishes the app files—not these guides or tests. (GitHub might display your source files publicly in your repository, so please never put passwords or private information there! 🤫)

## 🕵️‍♀️ Try it without publishing!

You can download it by clicking **Code → Download ZIP**, unzip the cute little folder, and double-click `index.html`. This is just a quick peek! Browser restrictions might prevent reliable saving or offline installation when opened this way as a local file. 🙈

For a *full* local preview, you can ask your assistant to run `node scripts/prepare.cjs`, then `node scripts/serve.cjs`, and open the address it happily prints out for you! 🌟 This requires Node.js, but no package installation. When you're done, just stop the preview with Ctrl+C. 🛑

## 📁 What each little file does

| File | Plain-language purpose | When to change it |
| --- | --- | --- |
| `config.js` | App name, words, beautiful colors and storage name 🎨 | Start here! 🏁 |
| `index.html` | The screen's cozy structure 🏠 | Add or rearrange fields |
| `style.css` | Spacing, lovely typography, borders and phone layout ✨ | Change appearance |
| `script.js` | Saving, editing, deletion and timestamps ⏱️ | Change behavior |
| `manifest.webmanifest` | Name, icon and opening address for installation 📱 | Generated settings; icon paths can be changed |
| `sw.js` | Keeps app files available offline for you! 📴 | New files require updating its asset list |
| `icon.svg`, `icon-192.png`, `icon-512.png` | Adorable browser and home-screen icons 🖼️ | Replace with your own cute icons! |
| `scripts/prepare.cjs` | Copies settings into metadata and refreshes the offline version 🔄 | Usually leave alone 😌 |
| `scripts/serve.cjs` | Runs a fun local preview 🎈 | Usually leave alone 😌 |
| `tests/app.test.cjs` | Checks storage and editing behavior 🧪 | Extend when behavior changes |
| `.github/workflows/pages.yml` | Tests and magically publishes to GitHub Pages 🪄 | Usually leave alone 😌 |
| `.nojekyll` | Supports plain-file hosting 🗂️ | Leave alone 😌 |
| `.gitignore` | Keeps temporary files and secrets safe and out of commits 🛡️ | Add private local files if needed |
| `APP-BRIEF.md` | Your fill-in description of your next big app idea! 💡 | Fill in for every new app |
| `AGENTS.md` | Helpful instructions for assistants, including the finished-app explanation 🤖 | Change your working preferences |
| `docs/` | Guides for customization, testing, troubleshooting and handoff 📚 | Read as needed |

## 🎀 Customize it!

Start with [the handy customization guide](docs/CUSTOMIZE.md). It explains which changes are super simple, provides lovely color examples, and even gives you a ready-to-copy request for your assistant! 💌

For each finished micro-app, please use [the handoff format](docs/FINISHED-APP.md): what was built, where to open it, how to run it, what the files do, how to publish it, what was tested, and where the data lives. No unexplained jargon, just friendly words! 🌸

## 📱 Install on your phone!

Visit your published address online first! 🌐
- On iPhone, use Safari's Share menu and tap **Add to Home Screen**. 🍏
- On Android, use Chrome's menu and tap **Install app** or **Add to Home screen**. 🤖
*(Wording and availability might vary a bit by browser!)*
Installation needs HTTPS, which GitHub Pages kindly provides. A quick visit online allows the app to cache its files so you can use it offline later! ☁️

## 🧠 Understand your data!

Your entries stay right here in the current browser on this device. 🏡 They are *not* uploaded to GitHub, and there is no sync or backup. Clearing browser data, using private browsing, or losing your device can erase your precious entries. 😢 A different browser, web address, or installed app might have separate storage. Unsaved drafts will sadly disappear when you close the page! 💨

Apps on separate paths use separate storage keys. These keys prevent accidental mixing; they are not a security boundary between apps on the same domain. Keep `storageId` and your published path stable once you start collecting real entries! 🗝️

## 🛠️ Check and troubleshoot!

Please peek at [TESTING.md](docs/TESTING.md) before calling a new app finished, and check [TROUBLESHOOTING.md](docs/TROUBLESHOOTING.md) when something just isn't working quite right. 🩹

Official GitHub help: [Use a template](https://docs.github.com/en/repositories/creating-and-managing-repositories/creating-a-repository-from-a-template) · [Publish with Actions](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages). 🆘

## ☕ Included app: The Usual

[The Usual](apps/the-usual/README.md) is a separate, lovely customer index with search, photos, favorites, undo, and downloadable backups! 📸 Its files live happily in `apps/the-usual/`; the original notes template is completely unchanged. The publishing workflow checks both apps and includes The Usual at `/the-usual/`. 🥤

## 📚 Perfume 7 library

[Perfume 7](apps/perfume-7/README.md) is a separate, smart mobile reference library with searchable project sources, related reading, bookmarks, and offline access! 📖 The Pages workflow includes it at `/perfume-7/`. 🌸
