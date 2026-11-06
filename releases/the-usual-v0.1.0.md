# The Usual 0.1.0
A phone-friendly customer index built from the microapp template.

## Included
- Name, up to two visual cues, drink and up to two additional notes.
- Live 45-word total counter and validation.
- Search across all text fields, ignoring case and accents.
- Duplicate-name warning, favorites, editing and undo deletion.
- One resized JPEG per customer, at most 320 pixels and 30,000 bytes.
- Photo replace/remove and JSON backup/import including photos.
- Browser-only IndexedDB storage; no accounts or uploads.

## Verification
Template tests, validation/search tests and simulated DOM + IndexedDB integration tests passed locally and in GitHub Actions. Photo decoding and encoding were mocked.

## Remaining checks
Real phone camera/gallery processing, mobile layout, installation and offline opening remain unverified. Clearing browser site data can erase customers; export a backup. Undo expires on reload or the next deletion.

App: https://nhenia.github.io/microapp-template/the-usual/
Guide: https://github.com/nhenia/microapp-template/blob/main/apps/the-usual/README.md
