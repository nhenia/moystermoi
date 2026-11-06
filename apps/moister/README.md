# MOYSTER: The Wetted Palette

A standalone, mobile-first oyster discovery microapp with happy-hour filters for visitors to New Orleans' New Orleans city. Lamplight-inspired, deliberately smaller.

## Try it
Open `apps/moister/index.html` through a static HTTP server (the file fetches `./data/deals.json`). Example from repository root: `python -m http.server 8000`, then visit `http://localhost:8000/apps/moister/`.

## Features
- Oyster venues and deals sorted by effective price **per oyster**, with unknown prices sorted last.
- Filters for Today, Happy hour now, neighborhood, and oyster style.
- Schedule comparisons use **America/Chicago**, including daylight-saving changes.
- Direct walking directions and original restaurant deal source.
- Accessible responsive single-page HTML with no build system and no login.

## Data maintenance
Edit `apps/moister/data/deals.json`. Each `venues` entry has: `id,name,area,address,kind,price,unit,deal,days,start,end,note,source`. Days are JavaScript day indices 0=Sunday to 6=Saturday; schedule is local 24-hour time. Use `price:null` for unpriced percentage discounts. Do not claim a venue's actual opening status from the scheduled happy hour alone. Restaurant menus are the sources of truth; the seed snapshot is from October 29, 2026.

A future GitHub Actions verification job may propose changes to this JSON based on official sources, but should not auto-publish uncertain price or hour changes. Neither the seed data nor the HTML claims to provide continuously verified live availability.

## Source venues
Bourbon House, Luke, Seaworthy, Desire Oyster Bar, Otis, plus more citywide oyster destinations. Entries without confirmed happy-hour deals retain a restaurant listing without invented times or prices. Consult the URLs in `deals.json` before travel.

## Deployment
Deploy the `apps/moister/` directory to any static host, or copy it to a standalone repository for its own GitHub Pages site. This branch adds the app without altering Lamplight or the template home screen.

## Coverage
New Orleans proper including Quarter, CBD, Warehouse District, Garden District, Uptown, Freret, Riverbend, St Roch, Lakefront, Mid-City and Bywater as venues are verified. Explicitly exclude Kenner, Metairie and outlying suburbs. All oyster spots display even without happy hours; the Deals today and Happy hour now filters require scheduled specials.
