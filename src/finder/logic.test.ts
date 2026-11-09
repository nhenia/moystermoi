// Run with: pnpm test   (uses Node's built-in test runner; no extra dependencies)
import { test } from "node:test"
import assert from "node:assert/strict"
import data from "../deals.json" with { type: "json" }
import {
  type Venue,
  DEFAULT_ORIGIN,
  daysSince,
  enrich,
  formatHappyHour as formatHappyHourRaw,
  formatOpen as formatOpenRaw,
  formatPrice,
  formatRange as formatRangeRaw,
  formatTime as formatTimeRaw,
  formatWalk,
  happyHour,
  milesBetween,
  nolaClock,
  openStatus,
  perOyster,
  pickThree,
  rank,
  walkMinutes,
} from "./logic.ts"

const venues = data.venues as Venue[]
const base: Venue = {
  id: "x", name: "X", area: "", address: "", kind: ["raw"], price: 1, unit: "each",
  deal: "", days: [1, 2, 3, 4, 5], start: "15:00", end: "18:00", note: "", source: "",
  hours: ["11:00-22:00", "11:00-22:00", "11:00-22:00", "11:00-22:00", "11:00-22:00", "11:00-23:00", "closed"],
}
const at = (day: number, h: number, m = 0) => ({ day, minutes: h * 60 + m })

test("nolaClock reads New Orleans time, not the phone's", () => {
  // 2026-11-06 is a Friday. 21:30 UTC = 3:30pm CST.
  assert.deepEqual(nolaClock(new Date("2026-11-06T21:30:00Z")), { day: 5, minutes: 15 * 60 + 30 })
  // Midnight UTC Saturday is still Friday 6pm in New Orleans.
  assert.deepEqual(nolaClock(new Date("2026-11-07T00:00:00Z")), { day: 5, minutes: 18 * 60 })
})

test("happy hour: now (with end time) / later today / upcoming / none", () => {
  assert.deepEqual(happyHour(base, at(1, 16)), { state: "now", endsIn: 120, start: "15:00", end: "18:00" })
  assert.equal(happyHour(base, at(1, 14)).state, "later")
  const after = happyHour(base, at(5, 18)) // ends exactly at 6pm: no longer "now"
  assert.equal(after.state, "upcoming")
  assert.equal(after.state === "upcoming" && after.day, 1) // Friday evening -> Monday
  assert.equal(happyHour({ ...base, days: [] }, at(1, 0)).state, "none")
})

test("happy hour that runs past midnight", () => {
  const tue = { ...base, days: [2], start: "15:00", end: "01:00" }
  assert.equal(happyHour(tue, at(2, 23, 30)).state, "now")
  const spill = happyHour(tue, at(3, 0, 30)) // Wednesday 12:30am, still Tuesday's deal
  assert.equal(spill.state, "now")
  assert.equal(spill.state === "now" && spill.endsIn, 30)
  assert.equal(happyHour(tue, at(3, 1, 0)).state, "upcoming")
})

test("open now: open / opens later / closed day skipped / past midnight / unknown", () => {
  assert.deepEqual(openStatus(base, at(1, 12)), { state: "open", until: "22:00", closesIn: 600 })
  assert.deepEqual(openStatus(base, at(1, 9)), { state: "opens", at: "11:00", dayOffset: 0, day: 1 })
  // Friday after close -> Saturday is closed -> opens Sunday
  assert.deepEqual(openStatus(base, at(5, 23, 30)), { state: "opens", at: "11:00", dayOffset: 2, day: 0 })
  const late = { ...base, hours: Array(7).fill("11:00-02:00") }
  assert.equal(openStatus(late, at(3, 1, 30)).state, "open") // 1:30am on yesterday's hours
  assert.equal(openStatus(late, at(3, 2, 30)).state, "opens")
  assert.equal(openStatus({ ...base, hours: null }, at(1, 12)).state, "unknown")
  const gap = { ...base, hours: [null, "closed", "closed", "closed", "closed", "closed", "closed"] }
  assert.equal(openStatus(gap, at(1, 12)).state, "unknown") // can't promise when it opens
  const midnight = { ...base, hours: Array(7).fill("16:00-24:00") }
  assert.equal(openStatus(midnight, at(5, 23, 50)).state, "open")
})

test("price per oyster never guesses unknown units", () => {
  assert.equal(perOyster(base), 1)
  assert.equal(perOyster({ ...base, price: 10, unit: "half-dozen" })!.toFixed(4), (10 / 6).toFixed(4))
  assert.equal(perOyster({ ...base, price: 18, unit: "dozen" }), 1.5)
  assert.equal(perOyster({ ...base, price: null, unit: "variable" }), null)
  assert.equal(perOyster({ ...base, price: 5, unit: "plate" }), null)
  assert.equal(formatPrice({ ...base, price: 0.75 }), "75¢ ea")
  assert.equal(formatPrice({ ...base, price: 1.5 }), "$1.50 ea")
  assert.equal(formatPrice({ ...base, price: 10, unit: "half-dozen" }), "$10 / 6")
  assert.equal(formatPrice({ ...base, price: null }), null)
})

test("distance and walking time are plausible", () => {
  // Bourbon House -> Desire Oyster Bar is about a block and a half.
  const miles = milesBetween({ lat: 29.95361, lng: -90.06953 }, { lat: 29.95527, lng: -90.0682 })
  assert.ok(miles > 0.1 && miles < 0.2, `got ${miles}`)
  assert.equal(walkMinutes(0.2), 5)
  assert.equal(walkMinutes(0), 1)
  assert.equal(formatWalk({ walk: 80, miles: 3.2 }), "3.2 mi · ride")
  assert.equal(formatWalk({ walk: null, miles: null }), null)
})

test("every mode lists every venue; open ones before closed ones", () => {
  const clock = at(2, 15, 30) // Tuesday 3:30pm
  const all = enrich(venues, DEFAULT_ORIGIN, clock)
  for (const mode of ["near", "happy", "cheap", "map"] as const) {
    const list = rank(all, mode)
    assert.equal(list.length, venues.length, `${mode} hides venues`)
  }
  const near = rank(all, "near")
  const firstClosed = near.findIndex((r) => r.open.state === "opens" && r.hh.state !== "now")
  if (firstClosed !== -1)
    assert.ok(near.slice(firstClosed).every((r) => r.open.state === "opens"), "closed spots sink to the bottom")
})

test("happy mode: live specials, then later today, then everything else", () => {
  const list = rank(enrich(venues, DEFAULT_ORIGIN, at(2, 15, 30)), "happy")
  const tier = (s: string) => (s === "now" ? 0 : s === "later" ? 1 : 2)
  for (let i = 1; i < list.length; i++) assert.ok(tier(list[i - 1].hh.state) <= tier(list[i].hh.state))
  assert.equal(list[0].hh.state, "now")
  assert.ok(list.some((r) => r.hh.state === "none"), "places without a happy hour are still listed")
})

test("cheap: every price you can get today, happy hour or menu, cheapest first", () => {
  // Monday 10am: Basin's 75¢ Monday special (from 11:30) is today's cheapest oyster
  const mon = rank(enrich(venues, DEFAULT_ORIGIN, at(1, 10)), "cheap")
  assert.equal(mon[0].venue.id, "basin")
  const priced = mon.filter((r) => r.price.perOyster != null && mon.indexOf(r) < mon.findIndex((x) => x.price.perOyster == null))
  for (let i = 1; i < priced.length; i++) assert.ok(priced[i - 1].price.perOyster! <= priced[i].price.perOyster!)
  // Tuesday: Basin's special is days away, so it shows its regular menu price instead
  const tue = enrich(venues, DEFAULT_ORIGIN, at(2, 15, 30)).find((r) => r.venue.id === "basin")!
  assert.equal(tue.price.kind, "menu")
  assert.equal(tue.price.text, "$18 a dozen")
})

test("price tags: happy hour, menu, market price, see menu", () => {
  const clock = at(2, 16, 10)
  const all = enrich(venues, DEFAULT_ORIGIN, clock)
  const by = (id: string) => all.find((r) => r.venue.id === id)!.price
  assert.deepEqual([by("desire").kind, by("desire").text], ["happy", "$1.50 each"])
  assert.deepEqual([by("acme").kind, by("acme").text], ["none", "See menu"])
  assert.deepEqual([by("pigeon-whale").kind, by("pigeon-whale").text], ["happy", "$2 each"])
  const wedMorning = enrich(venues, DEFAULT_ORIGIN, at(3, 9)).find((r) => r.venue.id === "bourbon-house")!.price
  assert.equal(wedMorning.kind, "happy") // Bourbon House happy hour is later today (2–5 pm)
  const sat = enrich(venues, DEFAULT_ORIGIN, at(6, 20)) // Saturday 8 pm, after happy hours
  assert.equal(sat.find((r) => r.venue.id === "bourbon-house")!.price.text, "Market price")
  assert.equal(sat.find((r) => r.venue.id === "desire")!.price.text, "$22 a dozen")
  assert.equal(sat.find((r) => r.venue.id === "luke")!.price.text, "from $2.75 each")
  for (const v of venues) assert.ok(v.menu?.url?.startsWith("http"), `${v.id} needs a menu link`)
})

test("three picks skip closed places", () => {
  const picks = pickThree(rank(enrich(venues, DEFAULT_ORIGIN, at(2, 15, 30)), "near"))
  assert.equal(picks.length, 3)
  assert.ok(picks.every((r) => r.open.state !== "opens" || r.hh.state === "later"))
})

test("labels read naturally and always show the happy hour end", () => {
  const sp = (s: string) => s.replace(/\u00a0/g, " ") // times use a non-breaking space
  const formatHappyHour = (h: Parameters<typeof formatHappyHourRaw>[0]) => sp(formatHappyHourRaw(h))
  const formatRange = (a: string, b: string) => sp(formatRangeRaw(a, b))
  const formatTime = (a: string) => sp(formatTimeRaw(a))
  const formatOpen = (o: Parameters<typeof formatOpenRaw>[0]) => sp(formatOpenRaw(o))
  assert.equal(formatHappyHour({ state: "now", endsIn: 30, start: "15:00", end: "18:00" }), "Happy hour now · ends 6 pm")
  assert.equal(formatHappyHour({ state: "later", startsIn: 75, start: "16:00", end: "18:00" }), "Happy hour 4–6 pm · starts in 1 hr 15 min")
  assert.equal(formatHappyHour({ state: "upcoming", dayOffset: 1, day: 3, start: "15:30", end: "18:00" }), "Happy hour tomorrow 3:30–6 pm")
  assert.equal(formatHappyHour({ state: "upcoming", dayOffset: 3, day: 2, start: "15:00", end: "01:00" }), "Happy hour Tue 3 pm–1 am")
  assert.equal(formatHappyHour({ state: "none" }), "")
  assert.equal(formatRange("11:30", "21:00"), "11:30 am–9 pm")
  assert.equal(formatRange("08:00", "01:00"), "8 am–1 am") // across midnight: both halves spelled out
  assert.equal(formatRange("16:00", "24:00"), "4 pm–12 am")
  assert.equal(formatTime("24:00"), "12 am")
  assert.equal(formatOpen({ state: "open", until: "22:00", closesIn: 300 }), "Open now · until 10 pm")
  assert.equal(formatOpen({ state: "open", until: "22:00", closesIn: 20 }), "Open now · closes at 10 pm (20 min)")
  assert.equal(formatOpen({ state: "opens", at: "16:00", dayOffset: 0, day: 2 }), "Closed now · opens 4 pm")
  assert.equal(formatOpen({ state: "opens", at: "11:00", dayOffset: 2, day: 0 }), "Closed now · opens Sun 11 am")
  assert.equal(formatOpen({ state: "unknown" }), "Hours not listed")
})

test("data file is well formed (no invented fields, valid times and coordinates)", () => {
  const ids = new Set<string>()
  const time = /^\d{2}:\d{2}$/
  for (const v of venues) {
    assert.ok(!ids.has(v.id), `duplicate id ${v.id}`)
    ids.add(v.id)
    assert.ok(v.name && v.address && v.source.startsWith("http"), v.id)
    if (v.start || v.end) assert.ok(time.test(v.start!) && time.test(v.end!) && v.days.length > 0, `${v.id} happy hour`)
    if (v.price != null) assert.ok(v.start && v.deal, `${v.id} has a price but no happy hour window`)
    if (v.hours != null) {
      assert.equal(v.hours.length, 7, `${v.id} hours must list 7 days`)
      for (const h of v.hours) assert.ok(h == null || h === "closed" || /^\d{2}:\d{2}-\d{2}:\d{2}$/.test(h), `${v.id} bad hours ${h}`)
    }
    if (v.lore != null) assert.ok(v.lore.split(/\s+/).length < 7, `${v.id} notable fact must be under 7 words`)
    if (v.lat != null) assert.ok(v.lat > 29.8 && v.lat < 30.2 && v.lng! < -89.8 && v.lng! > -90.3, `${v.id} coordinates outside New Orleans`)
  }
  assert.ok(ids.has("mrb"), "MRB is listed")
  assert.equal(daysSince("2026-10-29", new Date("2026-11-06T12:00:00-06:00")), 8)
})

test("day ranges read naturally", async () => {
  const { formatDays } = await import("./logic.ts")
  assert.equal(formatDays([0, 1, 2, 3, 4, 5, 6]), "Daily")
  assert.equal(formatDays([1, 2, 3, 4, 5]), "Mon–Fri")
  assert.equal(formatDays([2]), "Tue")
  assert.equal(formatDays([5, 6, 0]), "Fri–Sun")
  assert.equal(formatDays([1, 3]), "Mon, Wed")
})

test("shuck me: draws an open, walkable spot and favours live happy hours", async () => {
  const { drawOyster } = await import("./logic.ts")
  const all = enrich(venues, DEFAULT_ORIGIN, at(2, 16, 10)) // Tuesday 4:10pm
  let hh = 0
  for (let i = 0; i < 400; i++) {
    const r = drawOyster(all, () => (i + 0.5) / 400)!
    assert.ok(r.open.state === "open" || r.hh.state === "now", `${r.venue.id} isn't serving`)
    assert.ok(r.walk != null && r.walk <= 25, `${r.venue.id} is too far`)
    if (r.hh.state === "now") hh++
  }
  assert.ok(hh / 400 > 0.6, `happy hours should dominate the draw (${hh}/400)`)
  // 4am Wednesday: nothing is serving, so nothing is drawn rather than sending you to a closed door
  const late = enrich(venues, DEFAULT_ORIGIN, at(3, 4))
  const pick = drawOyster(late)
  assert.ok(pick == null || pick.open.state === "open")
})
