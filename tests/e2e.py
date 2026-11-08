import json, os, sys, base64
from playwright.sync_api import sync_playwright

OUT = os.environ.get("SHOTS", "test-screenshots")
os.makedirs(OUT, exist_ok=True)
URL = sys.argv[1] if len(sys.argv) > 1 else "http://localhost:4173/"
# 1x1 beige PNG standing in for street tiles (tile servers aren't reachable from this sandbox)
TILE = base64.b64decode("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mN89+7dfwAJbAPWPSaUhAAAAABJRU5ErkJggg==")
PHOTON = {"features": [
    {"geometry": {"coordinates": [-90.0715, 29.9511]}, "properties": {"name": "Canal Street", "city": "New Orleans", "state": "Louisiana"}},
]}
fails = []
def check(cond, msg):
    print(("PASS " if cond else "FAIL ") + msg)
    if not cond: fails.append(msg)

def setup(ctx):
    ctx.route("https://*.basemaps.cartocdn.com/**", lambda r: r.fulfill(status=200, content_type="image/png", body=TILE))
    ctx.route("**/photon.komoot.io/**", lambda r: r.fulfill(status=200, content_type="application/json", body=json.dumps(PHOTON)))
    ctx.route("**/fonts.googleapis.com/**", lambda r: r.fulfill(status=200, content_type="text/css", body=""))

with sync_playwright() as p:
    b = p.chromium.launch()

    # --- Mobile, location allowed, Tuesday 4:10pm New Orleans (happy hour live) ---
    ctx = b.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=2, is_mobile=True, has_touch=True,
                        geolocation={"latitude": 29.9547, "longitude": -90.0697}, permissions=["geolocation"])
    setup(ctx)
    page = ctx.new_page()
    errors = []
    page.on("pageerror", lambda e: errors.append(str(e)))
    page.on("console", lambda m: m.type == "error" and "ERR_TUNNEL" not in m.text and errors.append(m.text))
    page.clock.install(time="2026-11-10T22:10:00Z")  # Tue 4:10pm CST
    page.goto(URL)
    page.wait_for_selector(".mf-pick")
    page.wait_for_function("document.querySelector('.mf-origin strong').textContent.includes('You are here')")
    check(page.locator(".mf-pick").count() == 3, "three instant picks")
    first = page.locator(".mf-pick").first.inner_text()
    check("min walk" in first, f"pick shows walking time ({first.splitlines()[2:4]})")
    check(page.locator(".mf-hh.is-live").count() == 1, "happy hour ribbon is live at 4:10pm Tue")
    check(page.locator(".mf-pick .mf-btn-primary").first.get_attribute("href").startswith("https://www.google.com/maps/dir/"), "walk link is walking directions")
    check("travelmode=walking" in page.locator(".mf-pick .mf-btn-primary").first.get_attribute("href"), "directions are walking mode")
    check(page.locator(".mf-pin").count() >= 3, f"oyster markers on map ({page.locator('.mf-pin').count()})")
    check(page.locator(".mf-pin .mf-art .a-meat").count() >= 3, "markers are hand-drawn oysters")
    check(page.locator(".mf-pin.is-live").count() >= 1, "happy-hour oysters are highlighted on the map")
    check(page.locator(".mf-map-legend").is_visible(), "map legend is shown")
    check("Open now" in first, "pick says whether it's open and until when")
    price_texts = page.locator(".mf-price").all_inner_texts()
    check(len(price_texts) == 34 and all(t.strip() for t in price_texts), "every spot shows a price, market price or 'See menu'")
    check(any("See menu" in t for t in price_texts) and any("$" in t for t in price_texts), "prices and 'See menu' both appear")
    check("MRB BAR" in page.locator(".mf").inner_text().upper(), "MRB is listed")
    total = page.locator(".mf-pick").count() + page.locator(".mf-row").count()
    check(total == 34, f"near mode lists every spot ({total})")
    check("OYSTERS" in page.locator("h1#mf-title").inner_text().upper(), "page heading says Oysters near me")
    check(page.locator(".mf-hero-video").is_visible(), "the shell film is on screen")
    check(page.evaluate("document.querySelector('.mf-hero-video').readyState") >= 2, "the film loads")
    page.wait_for_timeout(900)
    page.screenshot(path=f"{OUT}/m1-near.png", full_page=False)
    page.screenshot(path=f"{OUT}/m1-near-full.png", full_page=True)

    def sheet_name():
        page.wait_for_selector(".mf-sheet h2", timeout=4000)
        return page.locator(".mf-sheet h2").inner_text().strip().upper()

    # tapping a restaurant name opens its card
    name1 = page.locator(".mf-pick .mf-name").first.inner_text().replace("★", "").strip().upper()
    page.locator(".mf-pick .mf-name").first.click()
    check(sheet_name() == name1, f"tapping a pick's name opens its card ({name1})")
    check(page.locator(".mf-pin.is-selected").get_attribute("title").upper() == name1, "…and highlights its oyster on the map")
    check(page.locator(".mf-fab").count() == 0, "map button steps aside while a card is open")
    page.wait_for_timeout(900)
    page.screenshot(path=f"{OUT}/m5-detail.png")
    page.locator(".mf-sheet-close").click()
    page.wait_for_timeout(200)
    check(page.locator(".mf-sheet").count() == 0, "× closes the card")

    # tapping a list row opens its card
    row = page.locator(".mf-row").nth(4)
    row_name = row.locator(".mf-name").inner_text().replace("★", "").strip().upper()
    row_name = row_name.split(". ", 1)[-1]
    row.locator(".mf-name").click()
    check(sheet_name() == row_name, f"tapping a list name opens its card ({row_name})")
    page.keyboard.press("Escape")
    page.wait_for_timeout(200)
    check(page.locator(".mf-sheet").count() == 0, "Escape closes the card")

    # tapping an oyster on the map opens its card
    page.evaluate("document.querySelector('.mf-map').scrollIntoView()")
    page.wait_for_timeout(400)
    visible = page.evaluate("""() => {
      const box = document.querySelector('.mf-map').getBoundingClientRect()
      const pins = [...document.querySelectorAll('.mf-pin:not(.mf-cluster)')]
      return pins.findIndex(p => { const r = p.getBoundingClientRect(); const x = r.x + r.width / 2, y = r.y + r.height / 2
        return x > box.left + 20 && x < box.right - 20 && y > box.top + 20 && y < box.bottom - 50 && y > 0 && y < innerHeight - 20 })
    }""")
    check(visible >= 0, "an oyster is visible on the map")
    pin = page.locator(".mf-pin:not(.mf-cluster)").nth(max(visible, 0))
    title = pin.get_attribute("title").upper()
    pin.click(force=True)
    check(sheet_name() == title, f"tapping an oyster on the map opens its card ({title})")
    page.locator(".mf-sheet-backdrop").click(position={"x": 20, "y": 20}, force=True)
    page.wait_for_timeout(200)
    check(page.locator(".mf-sheet").count() == 0, "tapping outside closes the card")

    # experimental: shuck me
    page.evaluate("window.scrollTo(0, 0)")
    page.locator(".mf-oracle").click()
    page.wait_for_timeout(450)
    check(page.locator(".mf-hero.is-shucking").count() == 1, "the shell opens")
    page.screenshot(path=f"{OUT}/m6-shuck.png")
    drawn = sheet_name()
    names = [n.upper() for n in page.locator(".mf-name").all_inner_texts()]
    check(any(drawn in n for n in names), f"shucking pulls a real spot ({drawn})")
    open_line = page.locator(".mf-sheet .mf-open").inner_text()
    check("Open now" in open_line, f"the pull is open now ({open_line})")
    check(page.locator(".mf-sheet-box h3", has_text="Oyster prices").count() == 1, "card has an oyster prices section")
    page.keyboard.press("Escape")

    # happy hour mode
    page.locator(".mf-mode-happy").click()
    chips = page.locator(".mf-pick .mf-chip").all_inner_texts()
    check(all("NOW" in c.upper() and "ENDS" in c.upper() for c in chips), f"happy mode leads with live specials and their end time {chips}")
    total = page.locator(".mf-pick").count() + page.locator(".mf-row").count()
    check(total == 34, f"happy mode still lists every spot ({total})")
    no_hh = page.locator(".mf-row:not(:has(.mf-chip))").count()
    check(no_hh > 0, f"places without a happy hour are listed too ({no_hh})")
    later = [c for c in page.locator(".mf-row .mf-chip").all_inner_texts() if "IN " in c.upper() or "TOMORROW" in c.upper()]
    check(all("–" in c for c in later), f"upcoming happy hours show start and end {later[:2]}")
    page.screenshot(path=f"{OUT}/m2-happy.png")

    # cheapest mode
    page.locator(".mf-mode-cheap").click()
    prices = page.locator(".mf-pick .mf-price").all_inner_texts()
    check(all("$" in x or "¢" in x for x in prices), f"cheapest leads with real prices {prices}")
    page.screenshot(path=f"{OUT}/m3-cheap.png")

    # map button (floating, phones) opens the map
    page.locator(".mf-mode-near").click()
    page.evaluate("window.scrollTo(0, 0)")
    check(page.locator(".mf-fab").is_visible(), "floating map button is visible")
    page.locator(".mf-fab").click()
    page.wait_for_timeout(900)
    top = page.locator(".mf-map").bounding_box()["y"]
    check(top < 200, f"map button scrolls the map into view (top at {int(top)}px)")
    h = page.locator(".mf-map").bounding_box()["height"]
    check(h > 400, f"map mode expands map ({int(h)}px)")
    page.screenshot(path=f"{OUT}/m4-map.png")

    # save from the card persists
    page.locator(".mf-mode-near").click()
    page.locator(".mf-pick .mf-name").first.click()
    page.wait_for_selector(".mf-sheet")
    page.get_by_role("button", name="☆ Save").click()
    page.keyboard.press("Escape")
    page.reload()
    page.wait_for_selector(".mf-pick")
    check("★" in page.locator(".mf-pick .mf-name").first.inner_text(), "saved spot survives reload")
    check(page.locator("h1#mf-title").count() == 1, "finder is the page's main heading")
    check(not errors, f"no console errors {errors[:3]}")
    ctx.close()

    # --- Mobile, location denied -> address fallback ---
    ctx = b.new_context(viewport={"width": 375, "height": 740}, is_mobile=True, has_touch=True, permissions=[])
    setup(ctx)
    page = ctx.new_page()
    page.clock.install(time="2026-11-10T15:00:00Z")  # Tue 9am: no happy hour yet
    page.goto(URL)
    page.wait_for_selector(".mf-row")
    closed = page.locator("#mf-closed + .mf-list .mf-row").count()
    check(closed > 0, f"places not open yet sit under a 'Closed now' heading at 9am ({closed})")
    op = page.locator("#mf-closed + .mf-list .mf-row").first.evaluate("e => getComputedStyle(e).opacity")
    check(op == "1", f"closed places are not faded ({op})")
    txt = page.locator("#mf-closed + .mf-list .mf-row").first.inner_text()
    check("Closed now" in txt and "opens" in txt, f"closed places say when they open ({txt.splitlines()[-2:]})")
    page.wait_for_selector(".mf-search input", timeout=15000)
    check(page.locator(".mf-alert").is_visible(), "denied location explains itself")
    check(page.locator(".mf-pick").count() == 3, "picks still shown from French Quarter while denied")
    check("Next:" in page.locator(".mf-hh").inner_text(), "banner shows the next happy hour in the morning")
    page.screenshot(path=f"{OUT}/m6-denied.png")
    page.fill(".mf-search input", "canal st")
    page.wait_for_selector(".mf-search-results button")
    page.locator(".mf-search-results button").first.click()
    check("Canal Street" in page.locator(".mf-origin strong").inner_text(), "address pick becomes the search center")
    ctx.close()

    # --- Address search outage ---
    ctx = b.new_context(viewport={"width": 375, "height": 740}, permissions=[])
    setup(ctx)
    ctx.unroute("**/photon.komoot.io/**")
    ctx.route("**/photon.komoot.io/**", lambda r: r.abort())
    ctx.unroute("https://*.basemaps.cartocdn.com/**")
    ctx.route("https://*.basemaps.cartocdn.com/**", lambda r: r.abort())
    page = ctx.new_page()
    page.goto(URL)
    page.wait_for_selector(".mf-search input", timeout=15000)
    page.wait_for_timeout(300)
    page.fill(".mf-search input", "bourbon")
    page.wait_for_selector(".mf-search-state")
    page.wait_for_timeout(600)
    check("down" in page.locator(".mf-search-state").inner_text(), "address search failure is explained")
    page.wait_for_selector(".mf-map-note", timeout=8000)
    check(page.locator(".mf-map-note").count() == 1 and page.locator(".mf-pin").count() >= 3, "tile outage explained, markers still shown")
    ctx.close()

    # --- Desktop ---
    ctx = b.new_context(viewport={"width": 1440, "height": 900}, geolocation={"latitude": 29.9547, "longitude": -90.0697}, permissions=["geolocation"])
    setup(ctx)
    page = ctx.new_page()
    page.clock.install(time="2026-11-10T22:10:00Z")
    page.goto(URL)
    page.wait_for_selector(".mf-pick")
    page.wait_for_timeout(900)
    check(page.locator(".leaflet-tile-loaded").count() > 0 and page.locator(".mf-map-note").count() == 0, "street tiles load, no warning")
    page.screenshot(path=f"{OUT}/d1.png")
    page.screenshot(path=f"{OUT}/d1-full.png", full_page=True)
    page.mouse.wheel(600, 0); page.evaluate("window.scrollTo(600, window.scrollY)"); page.wait_for_timeout(200)
    sx = page.evaluate("window.scrollX")
    check(sx == 0, f"page can't be scrolled sideways on desktop (scrollX={sx})")
    ctx.close()
    b.close()

print("\nFAILURES:", fails if fails else "none")
sys.exit(1 if fails else 0)
