# Instructions for assistants working in this repository

Read README.md, APP-BRIEF.md, config.js and the relevant app source before editing. Treat the user's current request as authoritative. Keep the app small and beginner-friendly. Implement the requested behavior, not just renamed labels. Do not add accounts, analytics, backend services or unrelated features unless requested.

## Implementation

- Plain HTML, CSS and JavaScript by default. No external dependencies are needed for this starter.
- Put editable branding and labels in config.js. Keep app copy short and purposeful.
- Retain large touch targets, clear labels, keyboard focus and responsive layouts.
- Render user text with textContent, not HTML injection.
- Never discard drafts or report success after a failed storage write.
- Preserve existing entries when changing their format. Write and test a migration before changing the schema or storage key.
- Paths must work under a GitHub Pages repository subdirectory. Do not hard-code root-relative asset paths.
- Run node scripts/prepare.cjs after app changes. When adding assets, also update the cache list, preparation hash inputs and workflow artifact list.
- Run node tests/app.test.cjs. Do the relevant browser checks in docs/TESTING.md. Report actual verification and any untested parts honestly.
- Do not upload user entries, credentials, local browser data, or unrelated workspace files.

## Required finished-app explanation

The user prefers the concise, beginner-friendly NO CONTEXT handoff style. Follow it for every finished micro-app:

1. Say what was built and whether it is live or only saved locally.
2. Link the working app when available, plus the downloadable files and beginner guide when produced.
3. Explain how to open and use it in everyday language.
4. Explain the major files briefly.
5. Give exact free GitHub Pages deployment steps appropriate to this repository (this starter uses GitHub Actions).
6. State what was tested and what still needs checking on a real phone.
7. Explain where data lives and any relevant data-loss limitation.

Use docs/FINISHED-APP.md as a writing guide. Be concise; put longer explanations in the README. Never claim publication, installation or testing without verification. Finish authorized work before asking for further steps.
