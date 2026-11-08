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

## Open
- [ ] Drago's source link didn't load for the robot — check it by hand
- [ ] Re-verify prices/happy hours (last human check: 2026-10-29)
- [ ] Five radically distinct visual designs (current build is design #1: night-print risograph)

## Lessons
- Leaflet requests only ~4 tiles in the small phone map, so "tiles failed" triggers at 3 errors.
- Validation checks must not assume any venue is unmapped (the robot maps them all).
- Don't cache map tiles in the service worker: they're opaque responses and eat storage quota.
