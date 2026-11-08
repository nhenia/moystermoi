// Run with: pnpm test   (uses Node's built-in test runner; no extra dependencies)
import { test } from "node:test"
import assert from "node:assert/strict"
import data from "../deals.json" with { type: "json" }
import {
  type Venue,
  DEFAULT_ORIGIN,
  daysSince,
  enrich,
  formatHappyHour,
  formatOpen,
  formatPrice,
  formatRange,
  formatTime,
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

test("cheap: a price you can get now beats a cheaper one later in the week", () => {
  // Monday 10am: Basin's 75¢ Monday special starts at 11:30
  const mon = rank(enrich(venues, DEFAULT_ORIGIN, at(1, 10)), "cheap")
  const basin = mon.findIndex((r) => r.venue.id === "basin")
  assert.ok(mon.slice(0, basin).every((r) => r.hh.state === "now" || r.hh.state === "later"))
  // Tuesday: Basin's deal is days away, so it ranks below today's deals
  const tue = rank(enrich(venues, DEFAULT_ORIGIN, at(2, 15, 30)), "cheap")
  const lastToday = tue.findLastIndex((r) => r.perOyster != null && (r.hh.state === "now" || r.hh.state === "later"))
  assert.ok(tue.findIndex((r) => r.venue.id === "basin") > lastToday)
})

test("three picks skip closed places", () => {
  const picks = pickThree(rank(enrich(venues, DEFAULT_ORIGIN, at(2, 15, 30)), "near"))
  assert.equal(picks.length, 3)
  assert.ok(picks.every((r) => r.open.state !== "opens" || r.hh.state === "later"))
})

test("labels read naturally and always show the happy hour end", () => {
  assert.equal(formatHappyHour({ state: "now", endsIn: 30, start: "15:00", end: "18:00" }), "Happy hour now · ends 6pm")
  assert.equal(formatHappyHour({ state: "later", startsIn: 75, start: "16:00", end: "18:00" }), "Happy hour 4–6pm · in 1h 15m")
  assert.equal(formatHappyHour({ state: "upcoming", dayOffset: 1, day: 3, start: "15:30", end: "18:00" }), "Happy hour tomorrow 3:30–6pm")
  assert.equal(formatHappyHour({ state: "upcoming", dayOffset: 3, day: 2, start: "15:00", end: "01:00" }), "Happy hour Tue 3pm–1am")
  assert.equal(formatHappyHour({ state: "none" }), "")
  assert.equal(formatRange("11:30", "21:00"), "11:30am–9pm")
  assert.equal(formatTime("24:00"), "12am")
  assert.equal(formatOpen({ state: "open", until: "22:00", closesIn: 300 }), "Open til 10pm")
  assert.equal(formatOpen({ state: "open", until: "22:00", closesIn: 20 }), "Closes 10pm · 20m left")
  assert.equal(formatOpen({ state: "opens", at: "16:00", dayOffset: 0, day: 2 }), "Opens 4pm")
  assert.equal(formatOpen({ state: "opens", at: "11:00", dayOffset: 2, day: 0 }), "Opens Sun 11am")
  assert.equal(formatOpen({ state: "unknown" }), "Hours not posted")
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
