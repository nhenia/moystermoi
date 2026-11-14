"""Regression test: opening hours are shown for every restaurant, everywhere they should be.

For each of the venues in src/deals.json:
  - its row in the list says whether it's open (Open now / Closed now / Hours not listed);
  - its card has an Hours section;
  - if we have hours for it, that section shows real times (e.g. "11 am–10 pm"), and every day
    we have hours for is covered;
  - if we don't, it says so plainly instead of being blank.
Run against a local build:  python3 tests/hours.py [URL]
"""
import json, re, sys
from pathlib import Path
from playwright.sync_api import sync_playwright

URL = sys.argv[1] if len(sys.argv) > 1 else "http://localhost:4173/"
venues = json.loads((Path(__file__).parent.parent / "src" / "deals.json").read_text())["venues"]
fails = []

def check(cond, msg):
    print(("PASS " if cond else "FAIL ") + msg)
    if not cond:
        fails.append(msg)

TIME = re.compile(r"\d{1,2}(:\d{2})?\s?(am|pm)|noon|midnight|closed|24 hours", re.I)
DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]

with sync_playwright() as p:
    b = p.chromium.launch()
    for when, label in (("2026-11-10T22:10:00Z", "Tue 4:10pm"), ("2026-11-14T09:27:00Z", "Sat 3:27am")):
        page = b.new_page(viewport={"width": 390, "height": 844})
        page.clock.install(time=when)
        page.goto(URL)
        page.wait_for_selector(".mf-card")
        rows = page.locator(".mf-card")  # the top-three picks plus every list row
        n = rows.count()
        check(n == len(venues), f"[{label}] every venue has a card in the list ({n}/{len(venues)})")
        no_status = [rows.nth(i).locator(".mf-name").inner_text() for i in range(n)
                     if not re.search(r"Open now|Closed now|Hours not listed|Hours: call ahead|Opens|opens", rows.nth(i).inner_text())]
        check(not no_status, f"[{label}] every row says open/closed/unknown {no_status[:5]}")
        page.close()

    page = b.new_page(viewport={"width": 390, "height": 844})
    page.clock.install(time="2026-11-10T22:10:00Z")
    page.goto(URL)
    page.wait_for_selector(".mf-card")
    missing, blank, wrong_days = [], [], []
    for v in venues:
        card = page.locator(".mf-card", has=page.locator(".mf-name", has_text=v["name"])).first
        card.locator(".mf-card-main").click()
        page.wait_for_selector(".mf-sheet")
        sec = page.locator(".mf-sheet .mf-sheet-box", has=page.locator("h3", has_text=re.compile("^Hours$")))
        if sec.count() == 0:
            missing.append(v["name"])
        else:
            txt = sec.first.inner_text()
            has = v.get("hours") and any(h for h in v["hours"])
            if has and not TIME.search(txt):
                blank.append(f"{v['name']}: {txt!r}")
            if not has and "not posted" not in txt.lower() and "call" not in txt.lower():
                blank.append(f"{v['name']} (no data) says: {txt!r}")
            if has:
                # every day we hold hours for should be named, alone or inside a range like Mon–Thu
                named = set()
                for a, z in re.findall(r"(Mon|Tue|Wed|Thu|Fri|Sat|Sun)(?:\s?[–-]\s?(Mon|Tue|Wed|Thu|Fri|Sat|Sun))?", txt):
                    i = DAYS.index(a)
                    j = DAYS.index(z) if z else i
                    while True:
                        named.add(DAYS[i])
                        if i == j:
                            break
                        i = (i + 1) % 7
                want = {DAYS[(i - 1) % 7] for i, h in enumerate(v["hours"]) if h}  # data is Sun-first
                if "daily" not in txt.lower() and not want <= named:
                    wrong_days.append(f"{v['name']}: missing {sorted(want - named)}")
        page.keyboard.press("Escape")
        page.wait_for_timeout(120)
    check(not missing, f"every card has an Hours section {missing[:5]}")
    check(not blank, f"cards with hours show times; cards without say so {blank[:5]}")
    check(not wrong_days, f"every day we have hours for is listed {wrong_days[:5]}")
    # split days show both sittings; open-all-day reads as 24 hours
    def card_hours(name):
        page.locator(".mf-card", has=page.locator(".mf-name", has_text=name)).first.locator(".mf-card-main").click()
        page.wait_for_selector(".mf-sheet")
        t = page.locator(".mf-sheet .mf-sheet-box", has=page.locator("h3", has_text=re.compile("^Hours$"))).first.inner_text()
        page.keyboard.press("Escape"); page.wait_for_timeout(120)
        return t
    cas = card_hours("Casamento")
    check("2\u00a0pm, 5:30" in cas or "2 pm, 5:30" in cas, f"split day shows lunch and dinner ({cas!r})")
    lbt = card_hours("Le Bon Temps")
    check("24 hours" in lbt, f"open-all-day reads as 24 hours ({lbt!r})")
    b.close()

print("\nFAILURES:", len(fails) if fails else "none")
sys.exit(1 if fails else 0)
