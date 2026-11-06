# Micro-app template — start here

A reusable starting point for small, phone-friendly apps. The included **TINY NOTES** app already saves, dates, edits and deletes text, remembers entries in this browser, and works offline after an online visit.

No login, backend, analytics, external libraries, or paid service. This is a text-entry starter: photo apps, reminders and shared accounts need additional work.

## Make your own app

1. At the top of this GitHub repository, choose **Use this template → Create a new repository**.
2. Give your copy its own name, such as `mentioned` or `my-little-notebook`. Choose **Public** for free GitHub Pages hosting.
3. Open [APP-BRIEF.md](APP-BRIEF.md), click the pencil, and fill in what your app should do. **Commit changes** means save a version of your changes.
4. Ask your assistant to read that brief and [AGENTS.md](AGENTS.md). Or change the words and colors yourself in [config.js](config.js).
5. Publish your copy using the steps below. Keep this original template as your reusable starting point.

Changes to the template do not automatically change apps you already made from it. Each copy is independent.

## Put your app online free

1. In your new repository, open **Settings → Pages**.
2. Under **Build and deployment**, choose **GitHub Actions** as the source.
3. Open the **Actions** tab. If GitHub asks you to enable workflows for this copy, enable them.
4. Choose **Publish micro-app → Run workflow → Run workflow**. A workflow is simply an automatic checklist.
5. Wait for the run to turn green. **Settings → Pages** will show your app's address, normally `https://YOUR-NAME.github.io/YOUR-REPOSITORY/`.

Every later change saved to `main` automatically checks and republishes the app. The workflow updates the installation name and offline cache from your settings. It publishes only the app files, not these guides or tests. GitHub may display source files publicly in your repository; never put passwords or private information there.

## Try it without publishing

Download using **Code → Download ZIP**, unzip it, and double-click `index.html`. This is a quick preview; browser restrictions can prevent reliable saving or offline installation when opened as a file.

For a full local preview, ask your assistant to run `node scripts/prepare.cjs`, then `node scripts/serve.cjs`, and open the address it prints. This requires Node.js, but no package installation. Stop the preview with Ctrl+C.

## What each file does

| File | Plain-language purpose | When to change it |
| --- | --- | --- |
| `config.js` | App name, words, colors and storage name | Start here |
| `index.html` | The screen's structure | Add or rearrange fields |
| `style.css` | Spacing, type, borders and phone layout | Change appearance |
| `script.js` | Saving, editing, deletion and timestamps | Change behavior |
| `manifest.webmanifest` | Name, icon and opening address for installation | Generated settings; icon paths can be changed |
| `sw.js` | Keeps app files available offline | New files require updating its asset list |
| `icon.svg`, `icon-192.png`, `icon-512.png` | Browser and home-screen icons | Replace with your own icons |
| `scripts/prepare.cjs` | Copies settings into metadata and refreshes the offline version | Usually leave alone |
| `scripts/serve.cjs` | Runs a local preview | Usually leave alone |
| `tests/app.test.cjs` | Checks storage and editing behavior | Extend when behavior changes |
| `.github/workflows/pages.yml` | Tests and publishes to GitHub Pages | Usually leave alone |
| `.nojekyll` | Supports plain-file hosting | Leave alone |
| `.gitignore` | Keeps temporary files and secrets out of commits | Add private local files if needed |
| `APP-BRIEF.md` | Your fill-in description of the next app | Fill in for every new app |
| `AGENTS.md` | Instructions for assistants, including the finished-app explanation | Change your working preferences |
| `docs/` | Customization, testing, troubleshooting and handoff guides | Read as needed |

## Customize it

Start with [the customization guide](docs/CUSTOMIZE.md). It explains which changes are simple, provides color examples and a ready-to-copy request for your assistant.

For each finished micro-app, use [the handoff format](docs/FINISHED-APP.md): what was built, where to open it, how to run it, what the files do, how to publish it, what was tested and where data lives. No unexplained jargon.

## Install on your phone

Visit your published address online first. On iPhone, use Safari's Share menu → **Add to Home Screen**. On Android, use Chrome's menu → **Install app** or **Add to Home screen**. Wording and availability vary by browser. Installation needs HTTPS; GitHub Pages provides it. A visit online allows the app to cache its files for later offline use.

## Understand your data

Entries stay in the current browser on this device. They are not uploaded to GitHub. There is no sync or backup. Clearing browser data, private browsing or losing the device can erase entries. A different browser, web address or installed app may have separate storage. Unsaved drafts disappear when you close the page.

Apps on separate paths use separate storage keys. These keys prevent accidental mixing; they are not a security boundary between apps on the same domain. Keep `storageId` and your published path stable once you start collecting real entries.

## Check and troubleshoot

Use [TESTING.md](docs/TESTING.md) before calling a new app finished and [TROUBLESHOOTING.md](docs/TROUBLESHOOTING.md) when something does not work.

Official GitHub help: [Use a template](https://docs.github.com/en/repositories/creating-and-managing-repositories/creating-a-repository-from-a-template) · [Publish with Actions](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages).

## Included app: The Usual

[The Usual](apps/the-usual/README.md) is a separate customer index with search, photos, favorites, undo and downloadable backups. Its files live in `apps/the-usual/`; the original notes template is unchanged. The publishing workflow checks both apps and includes The Usual at `/the-usual/`.

## Perfume 7 library

[Perfume 7](apps/perfume-7/README.md) is a separate mobile reference library with searchable project sources, related reading, bookmarks and offline access. The Pages workflow includes it at `/perfume-7/`.
