# Customize your micro-app

## The easiest changes: config.js

On GitHub, open `config.js`, click the pencil, change the values inside quotes, then **Commit changes**. Keep the commas and braces. The publishing workflow checks your file and applies the changes automatically.

| Setting | What it controls |
| --- | --- |
| `name` | Large heading, browser title and installation name |
| `shortName` | Short phone label; aim for 12 characters or fewer |
| `description` | A short description in app metadata |
| `inputLabel` | Words above the writing field |
| `saveLabel` | Main button text |
| `archiveLabel` | Heading above saved entries |
| `emptyMessage` | What appears before anything is saved |
| `storageId` | Internal name for saved entries; set once before use |
| `colors.background` | Page background |
| `colors.ink` | Main text and borders |
| `colors.accent` | Main button and phone theme color |
| `colors.muted` | Dates and secondary text |

Colors use six-digit values such as `#ffffff` (white) and `#171717` (almost black). Preserve enough contrast to read labels. Try the default yellow `#f5ff45`, pale blue `#a9dcff`, or mint `#a7f3d0` for the button. Keep dark button text with these light colors.

If your wording contains an apostrophe, use double quotes around the whole value: `inputLabel: "What's on your mind?",`.

Locally, run `node scripts/prepare.cjs` after editing settings. This synchronizes the title, phone name, description, theme colors and offline version. Without this step, the visible app changes but installation metadata may be stale. GitHub Actions runs it for you.

## Layout and appearance: style.css

Change padding for space, font-size for text, and the main width for the desktop layout. Keep main text at least 16px and controls easy to tap. The default heading wraps on small screens. Test your longest app name on a phone-width screen.

## Icon

The starter uses a generic note icon. Replace `icon.svg` for the browser and the two PNGs for phones. The PNGs must remain square at 192×192 and 512×512. Keep the important drawing near the center so phone masks do not cut it off. Colors in config.js do not recolor the icon automatically. Ask your assistant to create matching icons if desired.

## Behavior: script.js and index.html

The starter stores an ID, text and original creation time per entry. `script.js` reads storage, draws the archive and handles buttons. `index.html` defines the fields. Additional fields, photos, limits or calculations need changes to both the interface and behavior; they are not settings switches.

Never rename `storageId` to force an app update. It changes where the app looks for entries. Instead, preparation changes the offline version without touching saved data. Different repository paths automatically receive separate storage keys.

## A request you can copy

> Use this micro-app template and read APP-BRIEF.md and AGENTS.md. Create [name] to help me [purpose]. The main action is [action]. Save [fields]. Use [appearance]. Include only [features]. Keep it mobile-first and easy to publish with GitHub Pages. Preserve existing data if this is an update. Test it and explain the finished app in the included beginner-friendly handoff format.

## Returning to an older version

GitHub keeps previous committed versions. Ask your assistant to restore the last working version if an edit breaks the app. Restoring code does not restore deleted browser entries.
