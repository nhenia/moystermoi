# The Usual

A small customer index: name, two visual cues, drink and two additional notes. Maximum 45 words across all text fields. Name is required; the rest is optional.

## Use it

Open the app, tap **Add customer**, fill in a short record, then **Save customer**. Search by name, visual cue, drink or notes. Every search word must match somewhere in the record; capitalization and accents do not matter. Exact names rank first. Favorites come first within the same match rank; an empty search puts favorites first, then names alphabetically.

Tap **Edit** to update a customer. Duplicate names trigger a warning and confirmation, but are allowed. Deleting offers **Undo delete** until another deletion or a reload. Deleting the customer you are editing keeps the draft as a new unsaved customer.

Choose a photo from the phone or take one. The app stores only a resized JPEG, at most 320 pixels on the longest side and 30,000 bytes. Replace by choosing another photo; remove with **Remove photo**, then save. Phone image formats depend on the browser; use JPEG or PNG if an image cannot open. The original is not saved or uploaded.

## Data and backup

Customer records and photos stay in this browser's IndexedDB. There are no accounts, analytics, uploads or sync. Clearing site data or losing the device can erase everything. Unsaved drafts disappear on closing; the browser may offer a warning, but phones do not always show it.

**Export backup** downloads a JSON file containing customers and photos. **Import backup** validates the entire file before writing. Matching record IDs are replaced after confirmation; other customers stay. Imports keep your open draft. Restoring the same backup twice does not duplicate IDs. Customer names can repeat. Keep backup files somewhere you can retrieve on a replacement phone.

## Run locally

From this folder, run `node scripts/prepare.cjs`, then `node scripts/serve.cjs`. Open `http://127.0.0.1:4174`. Stop with Ctrl+C. Double-clicking index.html is not a reliable storage or offline preview.

## Files

- `index.html`: labeled form, search, cards and backup controls.
- `style.css`: phone layout, large controls and focus indicators.
- `config.js`: app identity and colors.
- `core.js`: word limits, record validation and search rules.
- `script.js`: browser storage, photos, editing, undo and backup.
- `manifest.webmanifest`, icons and `sw.js`: installation and offline files.
- `scripts/prepare.cjs`: metadata and offline version.
- `tests/app.test.cjs`: focused validation/search tests.

## Publish with GitHub Pages

This app is included as a separate folder in the microapp-template repository. After the implementation branch is merged into main, the existing **Publish micro-app** workflow tests both apps and publishes this one at `https://nhenia.github.io/microapp-template/the-usual/`. The original template stays at its existing address. In Settings → Pages choose **GitHub Actions**; run **Publish micro-app** from Actions if needed and wait for success.

## Verification

Run `node scripts/prepare.cjs` and `node tests/app.test.cjs`. Optional integration checks: install `jsdom@30.1.2` and `fake-indexeddb@6.2.5` in a separate test runtime, then set `USUAL_TEST_MODULES` to its node_modules path and run `node tests/browser-simulation.cjs`. These dependencies are for tests only; the app needs no packages. Phone camera/gallery behavior, layout, installation and real-browser offline opening require actual device/browser checks. Automated DOM/storage checks cannot prove those features.

Completed on 2026-10-06: validation/search tests and simulated DOM + IndexedDB save, edit, delete, undo, duplicate warnings, draft retention, failed writes, export/import and photo plumbing. Image decoding/encoding was mocked; real camera/gallery compression, mobile layout, installation and offline opening remain unverified. Chromium installation failed in the test environment.
