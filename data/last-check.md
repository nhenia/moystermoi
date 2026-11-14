# Daily restaurant check: 2026-11-14

Read each restaurant's own website with GitHub Models (openai/gpt-4.1-mini). 46 checked: 0 changed, 0 confirmed, 6 couldn't be read, 40 waiting on the AI reader.

**Freshness check (no AI):** read 40 of 46 restaurant sites; prices and happy-hour times still printed word for word at 18. Site now says "Verified 2026-11-14".

<details><summary>Shown prices or times no longer found on the restaurant's page (check these)</summary>

- Mr. Ed's Oyster Bar: raw half dozen, raw dozen, chargrilled half dozen, chargrilled dozen
- New Orleans Creole Cookery: raw half dozen, chargrilled dozen
- Red Fish Grill: raw dozen
- Basin Seafood & Spirits: happy hour price, raw half dozen, raw dozen, chargrilled half dozen, chargrilled dozen
- Monday Restaurant & Bar: happy hour price
- Boil Seafood House: happy hour price, raw dozen, chargrilled half dozen, chargrilled dozen

</details>

## ⚠️ The AI reader isn't working, so prices weren't updated

No `ANTHROPIC_API_KEY` secret is set, and GitHub's free AI models aren't available on this account. Add the key: repository Settings → Secrets and variables → Actions → New repository secret → name `ANTHROPIC_API_KEY`.

Restaurant sites read fine and were left untouched: Antoine's · Arnaud's · Basin Seafood & Spirits · Boil Seafood House · Bourbon House · Chemin à la Mer · Clancy's · Cooter Brown's · Deanie's Seafood · Desire Oyster Bar · Drago's · Felix's Lakefront · Felix's Restaurant & Oyster Bar · Fives · Galatoire's · Gallier's Seafood & Oyster Bar · Holywater · Le Bon Temps Roulé · Luke · MRB Bar & Kitchen · Maria's Oyster & Wine Bar · Monday Restaurant & Bar · Mosquito Supper Club · Mr. Ed's Oyster Bar · New Orleans Creole Cookery · Neyow's Creole Cafe · Oceana Grill · Pascal's Manale · Pigeon & Whale · Pêche · Red Fish Grill · Restaurant R'evolution · Royal House · Saffron NOLA · Seaworthy · Sidecar Patio & Oyster Bar · Superior Seafood & Oyster Bar · The Blue Crab · Trenasse · Vampire Apothecary

## Couldn't read (data left as it was)

- **Otis**: https://otisseafood.com/: page.goto: net::ERR_EMPTY_RESPONSE at https://otisseafood.com/
- **Acme Oyster House**: https://www.acmeoyster.com/: page.goto: net::ERR_EMPTY_RESPONSE at https://www.acmeoyster.com/
- **Casamento's**: https://casamentosrestaurant.com/: page.goto: net::ERR_EMPTY_RESPONSE at https://casamentosrestaurant.com/; https://casamentosrestaurant.com/menu/: page.goto: net::ERR_EMPTY_RESPONSE at https://casamentosrestaurant.com/menu/
- **The Salted Pearl (St. Roch Market)**: no readable text on its site
- **Porgy's Seafood Market**: https://porgysseafood.com/: the site showed a bot check (not bypassed)
- **Coterie Restaurant & Oyster Bar**: https://coterienola.com/: page.goto: net::ERR_CERT_COMMON_NAME_INVALID at https://coterienola.com/

