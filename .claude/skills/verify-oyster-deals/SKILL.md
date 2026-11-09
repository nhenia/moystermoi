---
name: verify-oyster-deals
description: Daily re-check of oyster prices, happy hours and hours in src/deals.json against each restaurant's own sources. Use for the scheduled daily check, or when asked to "verify", "refresh" or "re-check" the oyster deals.
---

# Verify oyster deals

The app hides any happy hour not re-confirmed in 21 days (`DEAL_STALE_AFTER_DAYS` in
`src/finder/logic.ts`), so this check is what keeps deals on screen. Accuracy beats coverage:
a wrong $1 oyster sends a tourist across the Quarter for nothing. Never guess, never fill a gap
from memory.

## 1. Pick today's batch

Read `src/deals.json`. Check **7 venues**: every id in `checks.brokenLinks` first, then the
venues with the oldest `verified` date (ties: alphabetical by id). With ~43 venues every spot
gets checked about once a week. If asked for a full re-check, do all of them.

## 2. Check each venue

Sources, most to least trusted:
1. The restaurant's own website (happy hour page, menu, hours).
2. The restaurant's own Instagram or Facebook posts from the last 60 days.
3. A current booking or listing page (OpenTable, Resy, Toast, Google listing).
4. Press, blogs, aggregators (Eater, Nola.com, Big Easy Magazine, Yelp): **leads only**.
   Never change data on these alone; they go on the call list.

Fetch the venue's `source` first, then `menu.url` and `website`. If a page won't load or doesn't
say, search the web (`"<name>" New Orleans oyster happy hour`, `"<name>" New Orleans hours`).
Also search once for signs it has closed (`"<name>" New Orleans closed`).

Compare against the entry: `deal`, `price`, `unit`, `days` (0 = Sunday), `start`, `end`,
`hours` (Sunday first, the hours **oysters** are served), `menu` prices, `hhUnposted`.
Don't touch `lore`, `id`, `name` spelling, `lat`/`lng`, `phone` or `website` unless clearly wrong.

## 3. Decide, one of three

- **Confirmed**: a tier-1–3 source shows the same deal and times (or the venue still clearly
  has no happy hour and the same hours). Set `verified` to today. If you confirmed it on a
  better page than `source`, replace `source` with that page.
- **Changed**: a tier-1 or tier-2 source dated within 60 days shows something different.
  Update only the fields that changed, set `verified` to today, and set `source` to the page
  that shows it. A deal that is gone: `price: null, unit: "variable", deal: "", days: [],
  start: null, end: null`. A venue that has closed for good: remove it entirely.
- **Can't confirm**: site down, only press mentions it, sources disagree, or the only proof is
  older than 60 days. Leave the entry **and its `verified` date** alone, so the app falls back to
  "call to confirm" on its own after 21 days. Add it to the call list with the reason.

## 4. Finish the file

- Set top-level `updated` to the **oldest** `verified` date across all venues (it means
  "everything has been checked since this date"; the app warns visitors after 45 days).
- Run `pnpm install --frozen-lockfile` if needed, then `pnpm test`. Fix the data, not the tests.

## 5. Deliver

Fetch and rebase on `origin/main` first; the link robot may have committed in the meantime.

- **Only confirmations** (dates and sources, no deal, price, time or hours changes): commit
  straight to `main` as `data: confirmed <N> spots (<date>)` and push. The site redeploys itself.
- **Any Changed item or removal**: create branch `data/check-<YYYY-MM-DD>`, commit, push, open a
  pull request titled `Oyster deal changes <date>`. `gh pr create` does not work in these sessions
  (GitHub's GraphQL API is blocked); open it through the REST API instead:
  `gh api repos/nhenia/moystermoi/pulls -f title="..." -f head="data/check-<date>" -f base=main -F body=@body.md`.
  Body, in plain words for a non-developer:
  a table of each change (Restaurant | Was | Now | Proof link), then confirmations, then the call
  list. Nhen approves by merging.
- Nothing confirmed and nothing changed: commit nothing.

Then end with a short summary (it becomes the phone notification):
`Checked 7 · confirmed 5 · 1 change waiting for your OK · 1 to call: Casamento's (site down)`.
Mention the pull request link if there is one. Never claim a venue was checked if its page was
not actually read.
