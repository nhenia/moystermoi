# MOYSTER

Find cheap oysters near you in New Orleans: under 60 seconds from opening the app to walking.

Night-print risograph look: fluorescent pink, yellow and cyan on ink black, oyster-eye markers, misregistered type.

## What it does

- **Opens straight into results.** Asks for your location right away. Until you answer, it shows picks from the French Quarter (and says so). Location blocked? An address box appears (any address works).
- **Every oyster spot is listed, open ones first.** Each says "Open til 10pm", "Opens 4pm" or "Hours not posted". Closed spots sit at the bottom, dimmed.
- **Happy hour stays front and centre:** a pink banner when specials are live, yellow highlights on cards and map, and every happy hour shows its start *and* end ("Happy hour now · ends 6pm", "Happy hour 4–6pm · in 1h").
- **Four modes:** Near me · Happy hour (live now → later today → everything else) · Cheapest (per oyster; deals you can get today first) · Map.
- **Three instant picks** with walking time, open status, price, happy hour and a **Walk there** button (Google Maps walking directions).
- **Illustrated map:** engraved oyster markers (yellow = happy hour now, cream = open, grey = closed), a legend, and a floating Map button on phones. Tap an oyster to highlight its card, or a card to highlight its oyster.
- Share (phone share sheet), save (stays on your phone, no account), details sheet with the source link.
- Happy-hour status refreshes every minute in New Orleans time, wherever the visitor's phone is set.
- Works on a weak signal: the app and restaurant list are cached on the phone after the first visit.

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

Code: `src/finder/` — `logic.ts` (all the rules, tested), `location.ts`, `OysterMap.tsx` (Leaflet + custom markers), `OysterFinder.tsx` (screen), `finder.css` (all styling).
Outside services, all free with no keys: CARTO map tiles, Photon address search (OpenStreetMap data), Google Maps directions, Google Fonts.

## Credits

Restaurant list (names, deals, hours, sources) originally researched by AZ; map locations added by the data robot.
