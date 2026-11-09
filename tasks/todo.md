# Moyster — build log

Goal: a tourist finds an oyster spot in under 60 seconds.

## Done
- [x] Standalone repo, separate from AZ's Moyster (only the restaurant list was carried over, with credit)
- [x] Logic module + tests: NOLA time, happy hour now/next, price per oyster, walking minutes, ranking, data validation
- [x] Location: auto-request, labelled French Quarter default, address search fallback
- [x] Four modes + three instant picks; walking directions, share, save, detail sheet, staleness warning
- [x] Leaflet map with oyster-eye markers, clustering, map/list sync
- [x] Error recovery: error boundary, location denied/timeout, address search outage, map tile outage
- [x] Data robot (weekly geocoding + link checks) and GitHub Pages deploy
- [x] Verified: 9 logic checks, 23 browser tests (phone + desktop), screenshots reviewed

## 2026-11-08 round
- [x] Re-checked every spot against current sources; 34 spots (added MRB, Red Fish Grill, Creole Cookery, Vampire Apothecary, Royal House, Oceana, Trenasse, Boil, Casamento's, Porgy's, Monday, Neyow's, Felix's Lakefront; dropped Mosquito Supper Club, reservation-only)
- [x] Oyster hours per spot; open-now status everywhere; every mode lists every spot, closed last
- [x] Happy hour shows start and end everywhere; still highlighted (banner, yellow cards, yellow oysters)
- [x] Cut filler copy (mode hints, taglines, "until we find you", "happy hour price", etc.)
- [x] Engraved oyster map markers + legend + floating Map button; map re-frames when resized; OSM tile fallback

## 2026-11-08 round 2
- [x] Tapping a name, a list row or a map oyster opens the restaurant card (was only highlighting)
- [x] Stripped to essentials: no kicker, labels, duplicate deal lines or card clutter; meta footer only when data is stale
- [x] Collage look: ransom-note title, torn paper cards + tape, hand-drawn oysters (wobbly-ink filter, double-pass lines, misregistered riso plates), taped map
- [x] Experimental: "shuck me" oracle pulls a spot; restaurant card opens with a shell lid swinging off

## 2026-11-08 round 3
- [x] Closed places no longer faded: own "Closed now" section, full contrast, "opens 4 pm"
- [x] Price on every card: happy hour price → regular menu price → "Market price" → "See menu" link (6 spots post current regular prices; Bourbon House is market price; the rest link their menu)
- [x] Redesign after the reference: engraved oyster-eye hero, woodtype brand, brush highlights, clean cards, pill buttons
- [x] Five New Orleans palettes (Mardi Gras default), all AAA; ?palette= preview
- [x] Senior pass: Atkinson Hyperlegible, 18px base, 44px+ targets, plain wording, calm motion, fonts bundled (offline)
- [x] Triple check: palette contrast script, axe-core (0 violations, AAA rules, 5 palettes), large-text/small-screen/keyboard suite

## Open
- [ ] Rescan 2026-11-09 added 9 spots (R'evolution, Antoine's, Arnaud's, Holywater, Gallier's, Deanie's, Le Bon Temps Roulé, Mosquito Supper Club, Saffron). Check their hours by phone; Arnaud's hours come from a 2022 page
- [ ] Maria's: Big Easy Magazine (Jan 2025) lists a daily 4–6 pm $1.50 oyster happy hour; the data has none. Confirm and add
- [ ] Found but not added (couldn't confirm current oysters or hours): Grand Isle, Lilette, Frankie & Johnny's, Bud Rip's oyster pop-up, The Bell (fried oyster loaf only), Domilise's and Mahony's (oyster po-boys)
- [ ] Drago's source link didn't load for the robot — check it by hand
- [ ] Unconfirmed, worth a call: Bourbon House, Royal House, Casamento's and St. Roch Market hours; Superior, Blue Crab, Mr. Ed's and Felix's Lakefront happy-hour times; Chemin à la Mer oyster hour
- [ ] Five radically distinct visual designs (current build is design #1: night-print risograph)

## Lessons
- Check sourcing claims against the farm's own page: R'evolution's Bayou Rosa oysters are farmed by United Houma Nation members.
- Never run the data robot from a sandbox without internet: it marks every link "broken".
- Shared "pm" in time ranges misleads across midnight ("8–1 am"); spell out both halves when the range is overnight.
- A restaurant literally named "Monday" reads like a day in "Next: Monday"; use full business names.
- Base styles like `.mf button { color: inherit }` outrank single-class component styles; wrap defaults in `:where()` so components win (the Map button's label went invisible).
- When copying a CSS block by text anchor, anchor on a newline + selector: `.mf-eye .shell {` also matched `.mf-head-art .mf-eye .shell {` and duplicated half the stylesheet.
- Cheapest mode must rank by price before "open now", or a 75¢ deal starting in an hour hides under full-price spots.
- Leaflet requests only ~4 tiles in the small phone map, so "tiles failed" triggers at 3 errors.
- Validation checks must not assume any venue is unmapped (the robot maps them all).
- Don't cache map tiles in the service worker: they're opaque responses and eat storage quota.

## Round 6 — shell & nacre (from the video reference)
- [x] Retired the cream/engraving look and the five palettes
- [x] Reference video as the hero film (mp4 + webm, poster, Pause remembered, still for reduce motion)
- [x] "Tap the shell" picker: film speeds up, then opens a pick
- [x] Prism foil that follows tilt/pointer; engraved crosshatch card edges; blackletter brand
- [x] Contrast check, axe, large-text, keyboard and e2e suites re-run

## Round 7 — Plate I
- [x] Phone + website for Bourbon House, St. Roch Market, Superior, Blue Crab, Mr. Ed's, Felix's Lakefront (also Felix's, Pêche, Maria's, Casamento's); shown wherever hours/happy-hour times are missing
- [x] Filled in St. Roch Market hours (strochmarket.com) and Bourbon House Sun–Thu hours (OpenTable; Fri–Sat say "call to check")
- [x] Video removed; no looping animation anywhere (tested)
- [x] Plate I: invented topographic New Orleans on an oyster shell, venues as pearls
- [x] Logotype with the etched oyster as the "o"; it is the hidden randomizer
- [x] "Prices" / "Hours" headings; dark mode switch (remembered, follows phone)
- [x] Contrast (light + dark), axe (light + dark), 320px header, keyboard, e2e

