// Reads a small fake restaurant site served from this machine: home page → menu page (prices hidden
// in a closed tab) → a PDF menu. Run: node --test scripts/restaurant-check/pages.test.mjs
import test from "node:test"
import assert from "node:assert/strict"
import http from "node:http"
import { launch, readSite } from "./pages.mjs"

test("follows menu links, reads hidden tabs and PDF menus, skips unrelated sites", async () => {
  const browser = await launch()
  // Make a real PDF menu with the browser itself.
  const maker = await browser.newPage()
  await maker.setContent("<h1>OYSTERS</h1><p>Bright Side half dozen 21 | dozen 38</p>")
  const pdf = await maker.pdf()
  await maker.close()

  const site = {
    "/": `<a href="/menu">Our Menu</a> <a href="https://www.instagram.com/x">Instagram</a> <a href="/careers">Jobs</a>`,
    "/menu": `<h2>Menu</h2><button>Happy Hour</button>
      <div style="display:none"><p>Tuesday-Thursday 4:00 - 6:30 pm</p><p>Raw Oysters $1.25/each</p></div>
      <a href="/files/oyster-menu.pdf">Oyster bar menu</a>`,
  }
  const server = http.createServer((req, res) => {
    if (req.url === "/files/oyster-menu.pdf") return res.writeHead(200, { "content-type": "application/pdf" }).end(pdf)
    const body = site[req.url]
    res.writeHead(body ? 200 : 404, { "content-type": "text/html" }).end(body ? `<html><title>Test</title><body>${body}</body></html>` : "not found")
  })
  await new Promise((r) => server.listen(0, "127.0.0.1", r))
  const base = `http://127.0.0.1:${server.address().port}`
  try {
    const out = await readSite(browser, { website: `${base}/` })
    const all = out.pages.map((p) => p.text).join("\n")
    assert.ok(out.pages.some((p) => p.url.endsWith("/menu")), "follows the menu link")
    assert.match(all, /Raw Oysters \$1\.25\/each/, "reads the hidden happy hour tab")
    assert.match(all, /dozen 38/, "reads the PDF menu")
    assert.ok(!out.pages.some((p) => /instagram|careers/.test(p.url)), "skips social and jobs pages")
    assert.deepEqual(out.problems, [])
  } finally {
    server.close()
    await browser.close()
  }
})
