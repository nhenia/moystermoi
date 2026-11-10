# CLUTCHER

Find cheap oysters near you in New Orleans: under 60 seconds from opening the app to walking.

1. Oyster-first, not restaurant-first.

Users should be able to find oysters without having to understand restaurant categories, menus or local geography.

2. Happy Hour as a discovery advantage.

Happy Hour should be prominent, but it should not turn Moyster into a generic drinking app. The oyster experience remains the primary identity.

3. Freshness as a feature.

Show the last verification date. Allow restaurants to correct listings. Distinguish confirmed deals from unverified information.

4. Price transparency.

Make it possible to compare:
- Price per oyster.
- Half-dozen and dozen pricing.
- Happy Hour versus regular pricing.
- Deal days and time windows.
5. A distinctive visual identity.

Moyster should not look like Yelp with a shell icon. Its experimental, editorial visual language is part of its differentiation. The interface should feel like a specialized discovery instrument rather than a restaurant database.

Plate I look: New Orleans drawn as an oyster shell in a naturalist's engraving style. Growth rings double as contour lines, the Mississippi crescent cuts across the lip, Lake Pontchartrain is hatched water at the hinge, and every oyster bar sits on it as a pearl at its real position. Bodoni logotype whose "o" is that oyster. Light (ink on pearl paper) and dark (white-line scratchboard) modes. Nothing loops.

## What it does

- **Opens straight into results.** Asks for your location right away; until you answer it shows picks from the French Quarter. Location blocked? An address box appears.
- **Every oyster place, open ones first.** "Open now · until 10 pm". Places that aren't serving yet sit under **Closed now** with "Closed now · opens 4 pm". Nothing is greyed out.
- **A price on every card:** the happy hour price while it applies today, otherwise the regular menu price, "Market price", or **See menu** with a link.
- **Happy hour up front:** a banner when specials are live, highlighted cards and oysters, and every happy hour shows start *and* end.
- **Sort by:** Closest · Happy hour · Cheapest (any price you can get today, happy hour or menu) · Map.
- **Tap any restaurant** (name, card or oyster on the map) and its card opens: status, walk, happy hour, oyster prices, hours, **Walk there**, Share, Save.
- **Easter egg:** tap the oyster "o" in the logo. It spins once and opens a place that's open within a 25-minute walk, favouring live happy hours. (No label on screen; screen readers hear "Surprise me".)
- **Dark mode:** follows the phone's setting; the Dark switch (top right) overrides it and is remembered.
- **Missing info?** Wherever hours or happy-hour times aren't posted, the card offers **Call (504) …** (tap to dial) and **Website**. Happy hours without posted times show "Happy hour · call for times".

## Easy to use for everyone

Built and tested for older eyes and hands:
- Atkinson Hyperlegible type (designed for low-vision readers), 18px body text, nothing under 16px.
- AAA contrast (7:1) for text and buttons everywhere, including the prism foil; nothing faded or tilted.
- Every button at least 44 × 44px (most are 52–60px); works fully by keyboard; respects "reduce motion".
- Plain words: "Open now · until 10 pm", "starts in 1 hr 15 min", "8 am–1 am".
- Checked automatically: `pnpm check-palettes` (contrast math) and `python3 tests/accessibility.py <url>` (axe-core audit on the page and the open card, plus text size, tap size, fading, tilt, sideways scroll at 320px and 200% text, and keyboard use).

## Colours

Light: pearl, ink and a five-colour prism foil. Dark: near-black, bone-white ink and a jewel-tone foil. Both are token blocks at the top of `src/finder/finder.css` (`.mf { … }` and `.mf[data-theme='dark'] { … }`); `pnpm check-palettes` checks both. The shell map is drawn by code in `src/finder/topo.ts` (styles in `topo.css`).

## Updating restaurants (no coding needed)

Everything lives in **`src/deals.json`**. On GitHub, open the file, click the pencil, edit, commit.

- **Prices/deals:** `price`, `unit` (`each`, `half-dozen`, `dozen`, or `variable` if not posted), `deal`, `days` (0 = Sunday … 6 = Saturday), `start`/`end` in 24-hour time (`"15:00"`). A deal that runs past midnight just ends earlier than it starts (`"15:00"` → `"01:00"`).
- **Oyster hours:** `hours` lists the 7 days **starting with Sunday**: `"11:00-22:00"`, `"closed"`, or `null` if that day isn't published. Use the hours oysters are served (MRB's bar is open till 4am, but oysters stop at 10pm). Leave `hours` as `null` if you don't know them; the app says "Hours not posted" instead of guessing.
- **Regular prices:** `menu.raw` (`each`, `half`, `dozen`), `menu.chargrilled` (`half`, `dozen`), `menu.market: true` for "market price", `menu.items` (every oyster dish and its price as printed), and `menu.url` (the "See menu" link — every spot needs one). Only use prices from the restaurant's own site.
- **`website`** is the restaurant's own site, and **`pages`** (optional) lists pages on it the daily check should always read, such as a menu that the home page doesn't link to.
- **`note`** shows on the details screen: use it for things like "Bar areas only" or a happy hour whose times aren't posted.
- **`source`** is the page you checked; **`verified`** is the date you checked it.
- **After re-checking a spot,** set its `verified` to today. `"updated"` at the top is the oldest `verified` date; after 45 days the app warns visitors the info may be stale.
- **New restaurant:** copy an entry, give it a unique `id`, leave out `lat`/`lng`. The robot maps it.
- **Notable fact:** `lore` is one striking fact, under 7 words, shown on the card (e.g. "Invented charbroiled oysters."). Never a general description; leave it out if there's nothing remarkable.
- **Never guess.** No posted price? `"price": null, "unit": "variable"` and the app says "Market price".

### Keeping deals fresh (automatic)

Happy hours change quietly, so nothing is trusted forever:

- **Every restaurant has a `verified` date.** If its happy hour hasn't been re-confirmed in **21 days**, the app stops showing it as a live deal (no price, no highlight) and shows "Happy hour · call to confirm" with the phone number instead. Change the limit with `DEAL_STALE_AFTER_DAYS` in `src/finder/logic.ts`.
- **Every morning at about 6:40 am**, a Claude scheduled task re-checks 7 restaurants (oldest checks first, so each spot is checked about once a week) against the restaurant's own site, menu, booking page or recent posts. Its checklist is `.claude/skills/verify-oyster-deals/SKILL.md`.
  - Same as before → it updates the `verified` date and publishes on its own.
  - Something changed → it opens a pull request on GitHub with a Was / Now / Proof table. **Nothing changes in the app until you merge it.**
  - Can't tell (site down, only a blog mentions it) → it leaves the entry alone and puts it on a "worth a call" list in the morning notification.
- `"updated"` at the top of `deals.json` is set to the oldest check, so it means "everything checked since this date".

### Daily restaurant check (automatic, 9am)

`.github/workflows/daily-restaurant-check.yml` runs **every day at 9am New Orleans time** (summer and winter). For each restaurant it:

1. opens the restaurant's **own website** (`website`, plus any `pages` listed) in a headless browser, follows its menu, happy hour and oyster links, and reads menu PDFs;
2. if those pages haven't changed since the last good read, re-confirms the data for free and moves on;
3. otherwise has an AI model read the pages for oyster dishes and prices, the oyster happy hour, hours and address, **each with the exact words it read them from**;
4. keeps a value **only if those exact words are on the restaurant's page**: anything it can't prove is thrown out and listed;
5. saves the changes to `deals.json`, re-maps any new address, runs the data checks, and republishes the site.

**What it never does:** use review sites or blogs, solve bot checks, delete a restaurant, or delete a happy hour just because a page doesn't mention it. A "we're closing" notice goes on the report for you to decide.

**The report:** each run's page on GitHub (Actions → Daily restaurant check) and the file `data/last-check.md` list what changed (Was / Now / Proof link), what couldn't be read and why (site down, bot check, menu only a photo), and what was confirmed.

**Which AI reads the pages:** free GitHub Models by default (no setup). For better reading of long menus, add an Anthropic API key as a repository secret named `ANTHROPIC_API_KEY` (Settings → Secrets and variables → Actions) and it switches to Claude automatically.

**Run it now / for one restaurant:** Actions → Daily restaurant check → Run workflow. Optionally type restaurant ids (e.g. `dragos blue-crab`) or tick "Report only".

### The data robot

`.github/workflows/refresh-data.yml` runs every morning (about 6:17 am, before the deal check) and whenever `deals.json` changes. It:
1. finds map locations for addresses missing them (US Census geocoder, OpenStreetMap fallback),
2. checks every source link still loads (broken ones are listed in the run summary and in `checks.brokenLinks`),
3. commits the result and redeploys the site.

It never touches prices, deals or times. Those are updated by the daily restaurant check above, or by hand.

## Going live

Live at **https://nhenia.github.io/moystermoi/**. Every change saved to `main` is tested and republished automatically (`.github/workflows/deploy-pages.yml`).

If the site ever stops updating: repo **Settings → Pages → Source** should say **GitHub Actions**.

## For developers

```bash
pnpm install
pnpm dev                 # local server
pnpm test                # logic + data validation (Node's built-in test runner)
pnpm typecheck
pnpm build && pnpm preview --port 4173
python3 tests/e2e.py     # browser tests at phone + desktop sizes (needs Python Playwright)
pnpm refresh-data        # run the data robot locally (needs internet)
pnpm check-restaurants -- --dry-run dragos   # read one restaurant's site and print the report (needs internet + ANTHROPIC_API_KEY)
pnpm test:robot          # the daily check's safety rules and page reader
```

Code: `src/finder/` — `logic.ts` (all the rules, tested), `art.ts` (the engraved oysters), `topo.ts` (Plate I and the logo oyster), `location.ts`, `OysterMap.tsx` (Leaflet + oyster markers), `OysterFinder.tsx` (screen), `finder.css` (all styling).
Outside services, all free with no keys: OpenStreetMap map tiles, Photon address search (OpenStreetMap data), Google Maps directions. Fonts are bundled.

## Credits

Restaurant list (names, deals, hours, sources) originally researched by AZ; map locations added by the data robot.
