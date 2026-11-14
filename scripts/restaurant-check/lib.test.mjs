// Tests for the daily restaurant check's safety rules. Run: node --test scripts/restaurant-check/
// Page text below is copied from the restaurants' own sites (read 2026-11-10).
import test from "node:test"
import assert from "node:assert/strict"
import { verifyExtraction, applyResult, quoteOnPage, numberInQuote, isNineInNewOrleans, relevantText, oldestVerified } from "./lib.mjs"

const BLUE_CRAB = {
  url: "https://www.thebluecrabnola.com/new-orleans-the-blue-crab-restaurant-and-oyster-bar-food-menu",
  text: `HAPPY HOUR
Tuesday-Thursday 4:00 - 6:30 pm
Food
Raw Oysters
$1.25/each
Chargrilled Oysters
$1.75/each
Oyster Shooters
$6.00/each$9.00/3 Shooters
Fried Oyster Platter
$28.50`,
}
const DRAGOS = {
  url: "https://www.dragosrestaurant.com/hilton-riverside-new-orleans-menu",
  text: `Drago's Original Charbroiled Oysters
Half Dozen $17.95
Dozen $32.95
Raw Oysters On the Half Shell
Half Dozen $15.95
Dozen $24.95`,
}
const none = { oyster_items: [], raw: null, chargrilled: null, market_price: null, happy_hour: { listed: false }, hours: null, address: null, closed_for_good: null }

const base = {
  id: "blue-crab", name: "The Blue Crab", address: "7900 Lakeshore Dr, New Orleans, LA", lat: 30.02, lng: -90.07, kind: ["raw"],
  price: 0.9, unit: "each", deal: "90¢ raw oysters", days: [2, 3, 4], start: "16:00", end: "18:00", note: "", source: "https://example.com", verified: "2026-11-01",
}

test("quotes must be on the page, ignoring spacing and case", () => {
  assert.ok(quoteOnPage("Tuesday-Thursday 4:00 - 6:30 pm", BLUE_CRAB.text))
  assert.ok(quoteOnPage("raw oysters $1.25 / each", BLUE_CRAB.text))
  assert.ok(!quoteOnPage("Raw Oysters $1.00/each", BLUE_CRAB.text))
  assert.ok(numberInQuote(17.95, "Half Dozen $17.95"))
  assert.ok(numberInQuote(1.25, "$1.25/each"))
  assert.ok(!numberInQuote(1.2, "$1.25/each"))
  assert.ok(!numberInQuote(5, "$15"))
})

test("a correct reading of Drago's prices is kept", () => {
  const { result, rejected } = verifyExtraction(
    {
      ...none,
      oyster_items: [{ name: "Original Charbroiled Oysters", price: "$17.95 for 6 · $32.95 a dozen", quote: "Charbroiled Oysters Half Dozen $17.95 Dozen $32.95", url: DRAGOS.url }],
      chargrilled: { half: 17.95, dozen: 32.95, quote: "Half Dozen $17.95\nDozen $32.95", url: DRAGOS.url },
    },
    [DRAGOS],
  )
  assert.deepEqual(rejected, [])
  assert.equal(result.items.length, 1)
  assert.deepEqual(result.chargrilled, { half: 17.95, dozen: 32.95 })
})

test("made-up or misread prices are thrown out", () => {
  const { result, rejected } = verifyExtraction(
    {
      ...none,
      // price not in the quote
      oyster_items: [{ name: "Raw oysters", price: "$12 for 6", quote: "Half Dozen $15.95", url: DRAGOS.url }],
      // quote invented
      raw: { each: null, half: 12, dozen: 20, quote: "Raw oysters half dozen $12, dozen $20", url: DRAGOS.url },
    },
    [DRAGOS],
  )
  assert.equal(result.items.length, 0)
  assert.equal(result.raw, null)
  assert.equal(rejected.length, 2)
})

test("a changed happy hour is applied, with the restaurant's page as proof", () => {
  const { result } = verifyExtraction(
    {
      ...none,
      happy_hour: {
        listed: true, deal: "$1.25 raw, $1.75 chargrilled oysters", days: [2, 3, 4], start: "16:00", end: "18:30", price: 1.25, unit: "each",
        quote: "Tuesday-Thursday 4:00 - 6:30 pm Food Raw Oysters $1.25/each", url: BLUE_CRAB.url,
      },
    },
    [BLUE_CRAB],
  )
  assert.ok(result.happyHour)
  const { venue, changes, confirmed } = applyResult(base, result, "2026-11-10", BLUE_CRAB.url)
  assert.equal(venue.end, "18:30")
  assert.equal(venue.price, 1.25)
  assert.equal(venue.source, BLUE_CRAB.url)
  assert.equal(venue.verified, "2026-11-10")
  assert.ok(confirmed)
  assert.equal(changes.length, 1)
  assert.equal(changes[0].field, "happy hour")
})

test("happy hour times must match the quote", () => {
  const { result, rejected } = verifyExtraction(
    { ...none, happy_hour: { listed: true, deal: "$1.25 raw", days: [2], start: "15:00", end: "17:00", price: 1.25, unit: "each", quote: "Tuesday-Thursday 4:00 - 6:30 pm Food Raw Oysters $1.25/each", url: BLUE_CRAB.url } },
    [BLUE_CRAB],
  )
  assert.equal(result.happyHour, null)
  assert.match(rejected[0], /happy hour/)
})

test("a happy hour that isn't found is never confirmed or deleted", () => {
  const { result } = verifyExtraction(none, [DRAGOS])
  const { venue, confirmed, changes } = applyResult(base, result, "2026-11-10", DRAGOS.url)
  assert.equal(confirmed, false)
  assert.equal(venue.verified, "2026-11-01") // untouched, so the app's 21-day rule still applies
  assert.equal(venue.deal, base.deal)
  assert.deepEqual(changes, [])
})

test("a new address replaces the old one and clears the map pin for re-mapping", () => {
  const page = { url: "https://x.com/contact", text: "Visit us at 812 Bienville Street, New Orleans, LA 70112" }
  const { result } = verifyExtraction({ ...none, address: { value: "812 Bienville St", quote: "812 Bienville Street, New Orleans", url: page.url } }, [page])
  const { venue, changes } = applyResult(base, result, "2026-11-10", page.url)
  assert.equal(venue.address, "812 Bienville St, New Orleans, LA")
  assert.equal(venue.lat, undefined)
  assert.equal(changes[0].field, "address")
  // Same street written differently: no change
  const same = applyResult({ ...base, address: "812 Bienville St, New Orleans, LA" }, { ...result, address: "812 Bienville Street" }, "2026-11-10", page.url)
  assert.deepEqual(same.changes, [])
})

test("closing notices are reported, never applied", () => {
  const page = { url: "https://casamentosrestaurant.com/", text: "We will reopen on Thursday October 1st which is looking like our final season." }
  const { result } = verifyExtraction({ ...none, closed_for_good: { value: true, quote: "looking like our final season", url: page.url } }, [page])
  const out = applyResult(base, result, "2026-11-10", page.url)
  assert.match(out.needsHuman, /final season/)
  assert.equal(out.venue.name, base.name)
})

test("hours must be 7 valid days backed by the quote", () => {
  const page = { url: "https://x.com", text: "Hours Tuesday - Saturday 11:00 AM - 9:00 PM Sunday 10:00 AM - 9:00 PM" }
  const good = verifyExtraction({ ...none, hours: { days: ["10:00-21:00", "closed", "11:00-21:00", "11:00-21:00", "11:00-21:00", "11:00-21:00", "11:00-21:00"], quote: "Tuesday - Saturday 11:00 AM - 9:00 PM Sunday 10:00 AM - 9:00 PM", url: page.url } }, [page])
  assert.equal(good.result.hours.length, 7)
  const bad = verifyExtraction({ ...none, hours: { days: ["10:00-23:00", "closed", "closed", "closed", "closed", "closed", "closed"], quote: "Sunday 10:00 AM - 9:00 PM", url: page.url } }, [page])
  assert.equal(bad.result.hours, null)
})

test("split days (lunch, then dinner) are accepted only when every time is on the page", () => {
  const page = { url: "https://x.com", text: "Thursday, Friday and Saturday 11 a.m. to 2 p.m. for lunch and 5:30 p.m. to 9 p.m. for dinner Sunday 4:30 p.m. till 8:30 p.m." }
  const split = "11:00-14:00,17:30-21:00"
  const good = verifyExtraction({ ...none, hours: { days: ["16:30-20:30", "closed", "closed", "closed", split, split, split], quote: page.text, url: page.url } }, [page])
  assert.deepEqual(good.result.hours, ["16:30-20:30", "closed", "closed", "closed", split, split, split])
  const invented = "11:00-14:00,17:30-22:00" // 10 pm isn't on the page
  const bad = verifyExtraction({ ...none, hours: { days: ["16:30-20:30", "closed", "closed", "closed", invented, split, split], quote: page.text, url: page.url } }, [page])
  assert.equal(bad.result.hours, null)
})

test("runs at 9am New Orleans time in both summer and winter", () => {
  // Winter (CST, UTC-6): 15:00 UTC is 9am
  assert.ok(isNineInNewOrleans("0 15 * * *", new Date("2026-12-01T15:05:00Z")))
  assert.ok(!isNineInNewOrleans("0 14 * * *", new Date("2026-12-01T14:05:00Z")))
  // Summer (CDT, UTC-5): 14:00 UTC is 9am
  assert.ok(isNineInNewOrleans("0 14 * * *", new Date("2026-07-01T14:05:00Z")))
  assert.ok(!isNineInNewOrleans("0 15 * * *", new Date("2026-07-01T15:05:00Z")))
})

test("page text is trimmed to the parts that can hold prices and hours", () => {
  const t = relevantText("Our story\nWe love the sea\n".repeat(50) + "Raw Oysters\n$1.25/each\n", 5000)
  assert.match(t, /\$1\.25/)
  assert.ok(t.length < 200)
  assert.equal(oldestVerified([{ verified: "2026-11-10" }, { verified: "2026-11-02" }]), "2026-11-02")
})

import { stillPosted, verificationStamp } from "./lib.mjs"

test("still-posted check confirms only when every shown price and time is on the restaurant's page", () => {
  const venue = { price: 1, start: "16:00", end: "18:30", menu: { raw: { dozen: 24 } } }
  const page = [{ url: "x", text: "Happy hour Tuesday-Thursday 4:00 - 6:30 pm. $1 oysters. Raw oysters dozen $24" }]
  assert.deepEqual(stillPosted(venue, page), { checked: 3, missing: [], confirmed: true })
  const changed = stillPosted({ ...venue, menu: { raw: { dozen: 22 } } }, page)
  assert.equal(changed.confirmed, false)
  assert.deepEqual(changed.missing, ["raw dozen"])
  assert.equal(stillPosted({ menu: {} }, page).confirmed, false, "nothing to check is never 'confirmed'")
})

test("the site's verified date only moves when most restaurant sites were actually read", () => {
  assert.deepEqual(verificationStamp("2026-11-16", 46, 40, 9), { date: "2026-11-16", sitesRead: 40, pricesConfirmed: 9, total: 46 })
  assert.equal(verificationStamp("2026-11-16", 46, 10, 9), null)
})
