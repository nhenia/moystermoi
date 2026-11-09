# Senior-friendly + accessibility checks. Run against a preview:  python3 tests/accessibility.py http://localhost:4173/
import base64
from playwright.sync_api import sync_playwright
import sys, os
URL = sys.argv[1] if len(sys.argv) > 1 else "http://localhost:4173/"
S = os.environ.get("SHOTS", "test-screenshots"); os.makedirs(S, exist_ok=True)
AXE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "node_modules", "axe-core", "axe.min.js")
TILE=base64.b64decode("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mN89+7dfwAJbAPWPSaUhAAAAABJRU5ErkJggg==")
fails=[]
def check(ok,msg):
    print(("PASS " if ok else "FAIL ")+msg)
    if not ok: fails.append(msg)

AUDIT = """() => {
  const vis = el => { const r = el.getBoundingClientRect(); const cs = getComputedStyle(el); return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none' }
  // 1) smallest text that people actually read (ignore map attribution, which Leaflet/OSM require)
  let small = []
  const walker = document.createTreeWalker(document.querySelector('.mf'), NodeFilter.SHOW_TEXT)
  while (walker.nextNode()) {
    const t = walker.currentNode; const el = t.parentElement
    if (!t.textContent.trim() || !vis(el) || el.closest('.leaflet-control-attribution, .mf-defs, [aria-hidden=true]')) continue
    const fs = parseFloat(getComputedStyle(el).fontSize)
    if (fs < 15.5) small.push(`${fs}px "${t.textContent.trim().slice(0,30)}"`)
  }
  // 2) tap targets (WCAG AAA: 44 × 44)
  const tiny = [...document.querySelectorAll('.mf button, .mf a, .mf [role=tab]')].filter(vis)
    .filter(el => !el.closest('.leaflet-control-attribution') && !el.classList.contains('mf-sheet-backdrop'))
    .map(el => { const r = el.getBoundingClientRect(); return { r, t: (el.innerText || el.getAttribute('aria-label') || el.className).trim().slice(0, 30) } })
    .filter(({ r }) => r.height < 44 || r.width < 44).map(({ r, t }) => `${Math.round(r.width)}×${Math.round(r.height)} "${t}"`)
  // 3) faded text: any readable element whose effective opacity < 1
  const faded = [...document.querySelectorAll('.mf-list li, .mf-picks li, .mf-card *')].filter(vis).filter(el => {
    let o = 1, n = el; while (n && n !== document.body) { o *= parseFloat(getComputedStyle(n).opacity); n = n.parentElement }
    return o < 0.99 && el.innerText && el.innerText.trim() && !el.closest('.mf-thumb')
  }).map(el => el.innerText.trim().slice(0, 30))
  // 4) tilted text containers
  const tilted = [...document.querySelectorAll('.mf h1, .mf h2, .mf h3, .mf p, .mf button, .mf a, .mf span')].filter(vis).filter(el => {
    const t = getComputedStyle(el).transform; if (!t || t === 'none') return false
    const m = t.match(/matrix\\(([^)]+)\\)/); if (!m) return false
    const [a, b] = m[1].split(',').map(Number); return Math.abs(Math.atan2(b, a)) > 0.01 && el.innerText.trim()
  }).map(el => el.innerText.trim().slice(0, 30))
  // 5) sideways scroll / text cut off
  const overflowX = document.documentElement.scrollWidth - document.documentElement.clientWidth
  const clipped = [...document.querySelectorAll('.mf-name, .mf-chip, .mf-price, .mf-btn, .mf-mode, .mf-hh, .mf-open')].filter(vis)
    .filter(el => el.scrollWidth > el.clientWidth + 2).map(el => el.innerText.trim().slice(0, 30))
  return { small: [...new Set(small)].slice(0, 6), tiny: tiny.slice(0, 8), faded: [...new Set(faded)].slice(0, 5), tilted: tilted.slice(0, 5), overflowX, clipped: clipped.slice(0, 5) }
}"""

with sync_playwright() as p:
    b=p.chromium.launch()
    for label, vw, scale in [("phone 390px, normal text", 390, 1), ("small phone 320px, normal text", 320, 1), ("phone 390px, 200% text", 390, 2), ("small phone 320px, 150% text", 320, 1.5)]:
        c=b.new_context(viewport={"width":vw,"height":740},geolocation={"latitude":29.9547,"longitude":-90.0697},permissions=["geolocation"],reduced_motion="reduce")
        c.route("**/*tile.openstreetmap.*/**", lambda r: r.fulfill(status=200, content_type="image/png", body=TILE))
        pg=c.new_page(); pg.clock.install(time="2026-11-10T15:00:00Z")  # Tue 9am: some places closed
        pg.goto(URL); pg.wait_for_selector(".mf-pick"); pg.wait_for_timeout(500)
        if scale != 1: pg.add_style_tag(content=f"html{{font-size:{16*scale}px}}"); pg.wait_for_timeout(300)
        for state in ["page", "card"]:
            if state == "card":
                pg.locator(".mf-pick .mf-name").first.click(); pg.wait_for_selector(".mf-sheet h2"); pg.wait_for_timeout(300)
            r = pg.evaluate(AUDIT)
            tag=f"[{label} / {state}]"
            if scale == 1: check(not r["small"], f"{tag} no text under 16px {r['small']}")
            check(not r["tiny"], f"{tag} every button at least 44×44 {r['tiny']}")
            check(not r["faded"], f"{tag} nothing faded {r['faded']}")
            check(not r["tilted"], f"{tag} no tilted text {r['tilted']}")
            check(r["overflowX"] <= 0, f"{tag} no sideways scrolling ({r['overflowX']}px)")
            check(not r["clipped"], f"{tag} no text cut off {r['clipped']}")
        pg.screenshot(path=f"{S}/senior-{vw}-{scale}.png")
        c.close()

    # dark mode: follows the phone's setting, has a switch, and remembers the choice
    c=b.new_context(viewport={"width":390,"height":844},color_scheme="dark"); pg=c.new_page()
    pg.goto(URL); pg.wait_for_selector(".mf-pick")
    check(pg.get_attribute(".mf","data-theme")=="dark", "dark phones open in dark mode")
    sw=pg.get_by_role("button", name="Dark")
    check(sw.get_attribute("aria-pressed")=="true", "the Dark switch shows it is on")
    sw.click(); pg.wait_for_timeout(100)
    check(pg.get_attribute(".mf","data-theme")=="light", "the switch turns dark mode off")
    pg.reload(); pg.wait_for_selector(".mf-pick")
    check(pg.get_attribute(".mf","data-theme")=="light", "the choice is remembered")
    c.close()

    # nothing in the header hangs off a small phone (the page clips overflow, so check directly)
    c=b.new_context(viewport={"width":320,"height":640}); pg=c.new_page(); pg.goto(URL); pg.wait_for_selector(".mf-pick")
    off=pg.evaluate("[...document.querySelectorAll('.mf-head *')].filter(e=>{const r=e.getBoundingClientRect();return r.width&&(r.right>innerWidth+1||r.left<-1)}).length")
    check(off==0, f"header fits a 320px phone ({off} pieces off-screen)")
    c.close()

    # missing hours or happy-hour times: a phone number and website instead
    c=b.new_context(viewport={"width":390,"height":844},geolocation={"latitude":29.9547,"longitude":-90.0697},permissions=["geolocation"]); pg=c.new_page()
    pg.goto(URL); pg.wait_for_selector(".mf-pick")
    for name, phone in [("Bourbon House","522-0111"),("Superior","293-3474"),("Blue Crab","284-2898"),("Mr. Ed","309-4848"),("Felix's Lakefront","304-4125")]:
        pg.locator(".mf-card-main", has_text=name).first.click(); pg.wait_for_selector(".mf-sheet h2")
        call=pg.locator(".mf-sheet a[href^='tel:']").first
        ok=call.count()==1 and phone in call.inner_text() and pg.locator(".mf-sheet a", has_text="Website").count()>=1
        check(ok, f"{name}: tap-to-call {phone} and website offered")
        pg.keyboard.press("Escape"); pg.wait_for_timeout(150)
    pg.locator(".mf-card-main", has_text="Salted Pearl").first.click(); pg.wait_for_selector(".mf-sheet h2")
    check(pg.locator(".mf-sheet .mf-hours b").count()>=2, "St. Roch Market (Salted Pearl) now shows its hours")
    pg.keyboard.press("Escape")
    c.close()

    # keyboard only: reach a restaurant, open its card, close it
    c=b.new_context(viewport={"width":390,"height":844},geolocation={"latitude":29.9547,"longitude":-90.0697},permissions=["geolocation"]); pg=c.new_page(); pg.clock.install(time="2026-11-10T22:10:00Z")
    pg.goto(URL); pg.wait_for_function("document.querySelector('.mf-origin strong').textContent.includes('You are here')")
    pg.goto(URL); pg.wait_for_selector(".mf-pick")
    seen=[]
    for i in range(30):
        pg.keyboard.press("Tab")
        seen.append(pg.evaluate("document.activeElement.className + '|' + (document.activeElement.innerText||'').slice(0,20)"))
        if "mf-card-main" in seen[-1]: break
    check(any("mf-logo-o" in s for s in seen), "keyboard reaches the logo oyster (Surprise me)")
    check(any("mf-theme" in s for s in seen), "keyboard reaches the Dark switch")
    check(any("mf-mode" in s for s in seen), "keyboard reaches the sort buttons")
    check("mf-card-main" in seen[-1], f"keyboard reaches the first restaurant ({len(seen)} tabs)")
    pg.keyboard.press("Enter"); pg.wait_for_selector(".mf-sheet h2")
    check(pg.evaluate("document.activeElement.className").startswith("mf-sheet-close"), "focus moves into the card when it opens")
    pg.keyboard.press("Escape"); pg.wait_for_timeout(200)
    check(pg.locator(".mf-sheet").count()==0, "Escape closes the card")
    c.close()

    # axe-core audit (WCAG 2.1 A/AA/AAA + best practice) in light and dark, page and open card
    for pal in ["light","dark"]:
        c=b.new_context(viewport={"width":390,"height":844},geolocation={"latitude":29.9547,"longitude":-90.0697},permissions=["geolocation"],reduced_motion="reduce",color_scheme=pal)
        c.route("**/*tile.openstreetmap.*/**", lambda r: r.fulfill(status=200, content_type="image/png", body=TILE))
        pg=c.new_page(); pg.clock.install(time="2026-11-10T22:10:00Z")
        pg.goto(URL); pg.wait_for_selector(".mf-pick"); pg.wait_for_timeout(600)
        pg.add_script_tag(path=AXE)
        for state in ["page","card"]:
            if state=="card":
                pg.locator(".mf-pick .mf-name").first.click(); pg.wait_for_selector(".mf-sheet h2"); pg.wait_for_timeout(500)
            res=pg.evaluate("""async () => (await axe.run(document, {runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21a','wcag21aa','wcag2aaa','best-practice']}})).violations.map(v=>v.id+' ('+v.nodes.length+')')""")
            check(not res, f"[axe / {pal} / {state}] no accessibility violations {res}")
        c.close()
    b.close()
print("\nFAILURES:", len(fails))
sys.exit(1 if fails else 0)
