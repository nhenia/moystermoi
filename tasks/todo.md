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

## Open
- [ ] Drago's source link didn't load for the robot — check it by hand
- [ ] Unconfirmed, worth a call: Bourbon House, Royal House, Casamento's and St. Roch Market hours; Superior, Blue Crab, Mr. Ed's and Felix's Lakefront happy-hour times; Chemin à la Mer oyster hour
- [ ] Five radically distinct visual designs (current build is design #1: night-print risograph)

## Lessons
- Base styles like `.mf button { color: inherit }` outrank single-class component styles; wrap defaults in `:where()` so components win (the Map button's label went invisible).
- When copying a CSS block by text anchor, anchor on a newline + selector: `.mf-eye .shell {` also matched `.mf-head-art .mf-eye .shell {` and duplicated half the stylesheet.
- Cheapest mode must rank by price before "open now", or a 75¢ deal starting in an hour hides under full-price spots.
- Leaflet requests only ~4 tiles in the small phone map, so "tiles failed" triggers at 3 errors.
- Validation checks must not assume any venue is unmapped (the robot maps them all).
- Don't cache map tiles in the service worker: they're opaque responses and eat storage quota.
