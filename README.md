# MOYSTER

Find cheap oysters near you in New Orleans: under 60 seconds from opening the app to walking.

Shell & nacre look: a looping film of an engraved oyster shell under rippling silver water, pearl-grey paper, prism-foil highlights that shift as you tilt your phone, blackletter brand, engraved crosshatch edges.

## What it does

- **Opens straight into results.** Asks for your location right away; until you answer it shows picks from the French Quarter. Location blocked? An address box appears.
- **Every oyster place, open ones first.** "Open now · until 10 pm". Places that aren't serving yet sit under **Closed now** with "Closed now · opens 4 pm". Nothing is greyed out.
- **A price on every card:** the happy hour price while it applies today, otherwise the regular menu price, "Market price", or **See menu** with a link.
- **Happy hour up front:** a banner when specials are live, highlighted cards and oysters, and every happy hour shows start *and* end.
- **Sort by:** Closest · Happy hour · Cheapest (any price you can get today, happy hour or menu) · Map.
- **Tap any restaurant** (name, card or oyster on the map) and its card opens: status, walk, happy hour, oyster prices, hours, **Walk there**, Share, Save.
- **Can't decide? Tap the shell.** The film at the top speeds up, then picks somewhere open within a 25-minute walk, favouring live happy hours.
- **The film** loops quietly at the top (under 0.5 MB). **Pause** stops it and the phone remembers; "reduce motion" shows a still picture instead.

## Easy to use for everyone

Built and tested for older eyes and hands:
- Atkinson Hyperlegible type (designed for low-vision readers), 18px body text, nothing under 16px.
- AAA contrast (7:1) for text and buttons everywhere, including the prism foil; nothing faded or tilted.
- Every button at least 44 × 44px (most are 52–60px); works fully by keyboard; respects "reduce motion".
- Plain words: "Open now · until 10 pm", "starts in 1 hr 15 min", "8 am–1 am".
- Checked automatically: `pnpm check-palettes` (contrast math) and `python3 tests/accessibility.py <url>` (axe-core audit on the page and the open card, plus text size, tap size, fading, tilt, sideways scroll at 320px and 200% text, and keyboard use).

## Colours

Pearl, ink and a five-colour prism foil (sky, lilac, pink, butter, mint). All in the first `.mf { … }` block of `src/finder/finder.css`. The film lives in `public/media/` (shell.mp4, shell.webm, shell-poster.jpg) — swap those files to change it.

## Updating restaurants (no coding needed)

Everything lives in **`src/deals.json`**. On GitHub, open the file, click the pencil, edit, commit.

- **Prices/deals:** `price`, `unit` (`each`, `half-dozen`, `dozen`, or `variable` if not posted), `deal`, `days` (0 = Sunday … 6 = Saturday), `start`/`end` in 24-hour time (`"15:00"`). A deal that runs past midnight just ends earlier than it starts (`"15:00"` → `"01:00"`).
- **Oyster hours:** `hours` lists the 7 days **starting with Sunday**: `"11:00-22:00"`, `"closed"`, or `null` if that day isn't published. Use the hours oysters are served (MRB's bar is open till 4am, but oysters stop at 10pm). Leave `hours` as `null` if you don't know them; the app says "Hours not posted" instead of guessing.
- **Regular prices:** `menu.raw` (`each`, `half`, `dozen`), `menu.chargrilled` (`half`, `dozen`), `menu.market: true` for "market price", and `menu.url` (the "See menu" link — every spot needs one). Only use prices from the restaurant's own site or a current listing.
- **`note`** shows on the details screen: use it for things like "Bar areas only" or a happy hour whose times aren't posted.
- **`source`** is the page you checked; **`verified`** is the date you checked it.
- **After re-checking prices,** set `"updated"` at the top to today's date. After 45 days the app warns visitors the info may be stale.
- **New restaurant:** copy an entry, give it a unique `id`, leave out `lat`/`lng`. The robot maps it.
- **Never guess.** No posted price? `"price": null, "unit": "variable"` and the app says "Market price".

### The data robot

`.github/workflows/refresh-data.yml` runs every Monday and whenever `deals.json` changes. It:
1. finds map locations for addresses missing them (US Census geocoder, OpenStreetMap fallback),
2. checks every source link still loads (broken ones are listed in the run summary and in `checks.brokenLinks`),
3. commits the result and redeploys the site.

It never touches prices, deals or times. Those stay human-verified.

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
```

Code: `src/finder/` — `logic.ts` (all the rules, tested), `art.ts` (the engraved oysters), `location.ts`, `OysterMap.tsx` (Leaflet + oyster markers), `OysterFinder.tsx` (screen), `finder.css` (all styling).
Outside services, all free with no keys: CARTO map tiles, Photon address search (OpenStreetMap data), Google Maps directions. Fonts are bundled.

## Credits

Restaurant list (names, deals, hours, sources) originally researched by AZ; map locations added by the data robot.
