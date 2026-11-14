# Daily restaurant check: 2026-11-14

Read each restaurant's own website (no AI). 46 restaurants: 42 sites read, 4 couldn't be read.

**Prices:** every price and happy-hour time we show is still printed word for word at 17 places. The site now says "Verified 2026-11-14".

**Hours:** opening and closing times all found on the page at 37 places.

## Prices or happy-hour times no longer on the restaurant's page

Check these and update src/deals.json:

- **Mr. Ed's Oyster Bar**: raw half dozen, raw dozen, chargrilled half dozen, chargrilled dozen
- **Red Fish Grill**: raw dozen
- **Desire Oyster Bar**: happy hour price
- **New Orleans Creole Cookery**: raw half dozen, chargrilled dozen
- **Basin Seafood & Spirits**: happy hour price, raw half dozen, raw dozen, chargrilled half dozen, chargrilled dozen
- **The Salted Pearl (St. Roch Market)**: happy hour price, happy hour times
- **Monday Restaurant & Bar**: happy hour price
- **Porgy's Seafood Market**: happy hour price
- **Boil Seafood House**: happy hour price, raw dozen, chargrilled half dozen, chargrilled dozen

## Pages that changed since the last check

- **Drago's**: [page](https://www.dragosrestaurant.com/)
- **Holywater**: [page](https://crew.fun/holywater-nola)

## Couldn't read (data left as it was)

- **Otis**: https://otisseafood.com/: page.goto: net::ERR_EMPTY_RESPONSE at https://otisseafood.com/
- **Acme Oyster House**: https://www.acmeoyster.com/: page.goto: net::ERR_EMPTY_RESPONSE at https://www.acmeoyster.com/
- **Casamento's**: https://casamentosrestaurant.com/: page.goto: net::ERR_EMPTY_RESPONSE at https://casamentosrestaurant.com/; https://casamentosrestaurant.com/menu/: page.goto: net::ERR_EMPTY_RESPONSE at https://casamentosrestaurant.com/menu/
- **Coterie Restaurant & Oyster Bar**: https://coterienola.com/: page.goto: net::ERR_CERT_COMMON_NAME_INVALID at https://coterienola.com/

<details><summary>Hours we show that weren't found on the page (often just written differently)</summary>

- New Orleans Creole Cookery: 21:00
- Basin Seafood & Spirits: 22:00
- The Salted Pearl (St. Roch Market): 11:00, 21:00, 22:00
- Monday Restaurant & Bar: 21:00

</details>

