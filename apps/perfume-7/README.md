# Perfume 7

A mobile reading library built from the microapp template. Browse all seven source documents, search their entries, follow related topics, save bookmarks and read offline after the first successful online load.

No login, analytics, external runtime dependencies, notes editor, supplier tracker or formula calculator. All scent profiles are concepts. Historical questions and unverified operational records retain their source status.

## Files
- `sources.json`: authoritative imported text of seven project documents, version 1, dated 2026-10-07. Edit this to update the library.
- `content.js`: generated entry index; do not edit directly.
- `config.js`: branding and bookmark storage name.
- `index.html`, `style.css`, `script.js`, `core.js`: reading interface and search.
- `scripts/prepare.cjs`: builds entries, installation metadata, offline cache and the public artifact from one asset list.

## Run
From the repository root run `node apps/perfume-7/scripts/prepare.cjs`, then `node scripts/serve.cjs`. Open `/apps/perfume-7/` on the printed address. Run `node apps/perfume-7/tests/app.test.cjs` for focused checks. The Pages workflow publishes this app at `/perfume-7/` once merged into main and deployed.

## Data
Project text is bundled and public when deployed. Bookmarks remain in this browser; no sync or backup is implied. Clearing browser data removes bookmarks. Storage errors are shown without claiming a save succeeded. Offline readiness is shown after the service worker activates. New releases display a close-and-reopen notice when ready. Linked external sources would still require internet.

This version imports the seven documents in `/Perfume 7/`; it does not claim to contain every previous conversation or a completed bibliography.

## Verification
Automated source/search/storage checks and DOM integration checks passed on 2026-10-08 UTC. Template and The Usual core checks also passed. Real-browser visual layout, service-worker offline behavior and phone installation still need checking: the browser download was unavailable in the build environment.
