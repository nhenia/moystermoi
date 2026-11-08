# MOYSTER

Find cheap oysters near you in New Orleans: under 60 seconds from opening the app to walking.

Night-print risograph look: fluorescent pink, yellow and cyan on ink black, oyster-eye markers, misregistered type.

## What it does

- **Opens straight into results.** Asks for your location right away; until you answer it shows picks from the French Quarter. Location blocked? An address box appears.
- **Every oyster spot, open ones first.** "Open til 10pm", "Opens 4pm" or "Hours not posted". Closed spots sit at the bottom, dimmed.
- **Happy hour up front:** pink banner when specials are live, yellow cards and oysters, and every happy hour shows start *and* end.
- **Four modes:** Near me · Happy hour · Cheapest · Map. Three picks up top with a **Walk there** button.
- **Tap any restaurant** (its name, its row, or its oyster on the map) and its card pops up: hours, happy hour, price, walk, share, save, source.
- **Shuck me** (the experimental bit): tap the closed oyster at the top. It rattles, cracks open, finds a pearl with an eye in it, and pulls a spot for you: open now, within a 25-minute walk, weighted toward live happy hours.
- **Look:** cut-paper collage. Ransom-note title, torn paper cards with tape, hand-drawn oysters in wobbly ink on misregistered riso colour, a taped-down map. Restaurant cards open like a shell lid lifting off.
- Works offline after the first visit. Respects "reduce motion" settings.

## Updating restaurants (no coding needed)

Everything lives in **`src/deals.json`**. On GitHub, open the file, click the pencil, edit, commit.

- **Prices/deals:** `price`, `unit` (`each`, `half-dozen`, `dozen`, or `variable` if not posted), `deal`, `days` (0 = Sunday … 6 = Saturday), `start`/`end` in 24-hour time (`"15:00"`). A deal that runs past midnight just ends earlier than it starts (`"15:00"` → `"01:00"`).
- **Oyster hours:** `hours` lists the 7 days **starting with Sunday**: `"11:00-22:00"`, `"closed"`, or `null` if that day isn't published. Use the hours oysters are served (MRB's bar is open till 4am, but oysters stop at 10pm). Leave `hours` as `null` if you don't know them; the app says "Hours not posted" instead of guessing.
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

Code: `src/finder/` — `logic.ts` (all the rules, tested), `art.ts` (the hand-drawn oysters, tape and torn edges), `location.ts`, `OysterMap.tsx` (Leaflet + oyster markers), `OysterFinder.tsx` (screen), `finder.css` (all styling).
Outside services, all free with no keys: CARTO map tiles, Photon address search (OpenStreetMap data), Google Maps directions, Google Fonts.

## Credits

Restaurant list (names, deals, hours, sources) originally researched by AZ; map locations added by the data robot.
