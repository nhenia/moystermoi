// Run with: pnpm test   (uses Node's built-in test runner; no extra dependencies)
import { test } from "node:test"
import assert from "node:assert/strict"
import data from "../deals.json" with { type: "json" }
import {
  type Venue,
  type Ranked,
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
  estimateHours,
  notOpenNow,
  pickThree as pick3,
  rank as rankAll,
  formatOpen,
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
  // Real (posted) prices, cheapest first; ~estimates follow them.
  const priced = mon.filter((r) => r.price.kind !== "estimate" && r.price.perOyster != null && mon.indexOf(r) < mon.findIndex((x) => x.price.perOyster == null || x.price.kind === "estimate"))
  for (let i = 1; i < priced.length; i++) assert.ok(priced[i - 1].price.perOyster! <= priced[i].price.perOyster!)
  // Tuesday: Basin's special is days away, so it shows its regular menu price instead
  const tue = enrich(venues, DEFAULT_ORIGIN, at(2, 15, 30)).find((r) => r.venue.id === "basin")!
  assert.equal(tue.price.kind, "menu")
  assert.equal(tue.price.text, "$18 a dozen")
})

test("price tags: happy hour, menu, ~estimate", () => {
  const clock = at(2, 16, 10)
  const all = enrich(venues, DEFAULT_ORIGIN, clock)
  const by = (id: string) => all.find((r) => r.venue.id === id)!.price
  assert.deepEqual([by("desire").kind, by("desire").text], ["happy", "$1.50 each"])
  // Acme lists raw at market price, so it gets the town's typical dozen, marked ~
  assert.equal(by("acme").kind, "estimate")
  assert.match(by("acme").text, /^~\$\d+ a dozen$/)
  assert.deepEqual([by("pigeon-whale").kind, by("pigeon-whale").text], ["happy", "$2 each"])
  const wedMorning = enrich(venues, DEFAULT_ORIGIN, at(3, 9)).find((r) => r.venue.id === "bourbon-house")!.price
  assert.equal(wedMorning.kind, "happy") // Bourbon House happy hour is later today (2–5 pm)
  const sat = enrich(venues, DEFAULT_ORIGIN, at(6, 20)) // Saturday 8 pm, after happy hours
  assert.match(sat.find((r) => r.venue.id === "bourbon-house")!.price.text, /^~\$\d+ a dozen$/)
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
      for (const h of v.hours) assert.ok(h == null || h === "closed" || /^\d{2}:\d{2}-\d{2}:\d{2}(,\d{2}:\d{2}-\d{2}:\d{2})*$/.test(h), `${v.id} bad hours ${h}`)
      assert.ok(!("hoursEstimated" in v), `${v.id}: estimates are worked out in the app, never stored`)
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

test("stale happy hours turn into 'call to confirm' instead of showing as live", async () => {
  const { freshen, DEAL_STALE_AFTER_DAYS } = await import("./logic.ts")
  const now = new Date("2026-12-15T18:00:00-06:00")
  const deal = { ...base, deal: "$1 raw oysters", price: 1, unit: "each" }

  // Checked recently: untouched
  const fresh = { ...deal, verified: "2026-12-01" }
  assert.equal(freshen(fresh, now), fresh)

  // Older than the limit: no live happy hour, no happy hour price, but the deal is still mentioned
  const old = freshen({ ...deal, verified: "2026-11-01" }, now)
  assert.equal(happyHour(old, nolaClock(now)).state, "none")
  assert.equal(old.price, null)
  assert.equal(old.unit, "variable")
  assert.equal(old.hhStale, "Nov 1")
  assert.match(old.hhUnposted ?? "", /\$1 raw oysters/)
  assert.match(old.hhUnposted ?? "", /3–6\spm/)

  // Never checked counts as stale
  assert.equal(freshen({ ...deal, verified: undefined }, now).price, null)

  // Venues without a happy hour are left alone however old
  const noDeal = { ...base, days: [], start: null, end: null, verified: "2020-01-01" }
  assert.equal(freshen(noDeal, now), noDeal)

  assert.ok(DEAL_STALE_AFTER_DAYS >= 14 && DEAL_STALE_AFTER_DAYS <= 30)
})

test("every venue has a verified date", () => {
  for (const v of venues) assert.match(v.verified ?? "", /^\d{4}-\d{2}-\d{2}$/, v.id)
})

test("split days: open at lunch, closed between, open at dinner, next window named", () => {
  const split = { ...base, hours: ["closed", "closed", "closed", "closed", "11:00-14:00,17:30-21:00", "11:00-14:00,17:30-21:00", "closed"] }
  assert.deepEqual(openStatus(split, at(4, 12)), { state: "open", until: "14:00", closesIn: 120 })
  assert.deepEqual(openStatus(split, at(4, 15)), { state: "opens", at: "17:30", dayOffset: 0, day: 4 })
  assert.deepEqual(openStatus(split, at(4, 18)), { state: "open", until: "21:00", closesIn: 180 })
  assert.deepEqual(openStatus(split, at(4, 22)), { state: "opens", at: "11:00", dayOffset: 1, day: 5 })
})

test("open 24 hours reads as 24 hours, at any time", () => {
  const always = { ...base, hours: Array(7).fill("00:00-24:00") }
  for (const h of [0, 3, 12, 23]) {
    const o = openStatus(always, at(6, h))
    assert.equal(o.state, "open")
    assert.match(formatOpen(o), /24 hours/)
  }
})

test("unknown days copy the nearest earlier open day; closed days are never filled or copied", () => {
  const v = estimateHours({ ...base, hours: ["11:00-22:00", "11:00-21:00", "closed", "11:00-21:00", "11:00-21:00", null, null] })
  assert.deepEqual(v.hours, ["11:00-22:00", "11:00-21:00", "closed", "11:00-21:00", "11:00-21:00", "11:00-21:00", "11:00-21:00"])
  assert.deepEqual(v.hoursEstimated, [5, 6])
  // Sunday unknown, nothing open before it in the week wraps back to Saturday's hours
  const w = estimateHours({ ...base, hours: [null, "closed", "17:00-21:00", "17:00-21:00", "17:00-21:00", "17:00-22:00", "17:00-22:00"] })
  assert.equal(w.hours![0], "17:00-22:00")
  assert.equal(w.hours![1], "closed")
  assert.deepEqual(w.hoursEstimated, [0])
})

test("estimated days are labelled as estimates", () => {
  const v = estimateHours({ ...base, hours: ["11:00-21:00", "11:00-21:00", "11:00-21:00", "11:00-21:00", "11:00-21:00", null, null] })
  assert.match(formatOpen(openStatus(v, at(5, 12))), /\(est\.\)/)
  assert.doesNotMatch(formatOpen(openStatus(v, at(2, 12))), /est/)
})

test("nothing to copy from: hours stay unknown", () => {
  const none = estimateHours({ ...base, hours: [null, "closed", null, "closed", null, null, "closed"] })
  assert.equal(openStatus(none, at(0, 12)).state, "unknown")
  assert.equal(estimateHours({ ...base, hours: null }).hours, null)
})

test("every venue has hours for all seven days (real data)", () => {
  const venues = (data as { venues: Venue[] }).venues
  const gaps = venues.filter((v) => !v.hours || v.hours.length !== 7 || v.hours.includes(null)).map((v) => v.name)
  assert.deepEqual(gaps, [])
  const bad = venues.flatMap((v) => (v.hours ?? []).filter((h) => h && h !== "closed" && !/^\d{2}:\d{2}-\d{2}:\d{2}(,\d{2}:\d{2}-\d{2}:\d{2})*$/.test(h)).map((h) => `${v.name}: ${h}`))
  assert.deepEqual(bad, [])
})

test("hours-unknown places sit with closed ones: never in the top three, ranked below open and closed", () => {
  const mk = (id: string, open: Ranked["open"], miles: number) =>
    ({ venue: { ...base, id, name: id }, open, hh: { state: "none" }, miles, walk: null, price: { perOyster: null } }) as unknown as Ranked
  const unknownNear = mk("unknown-near", { state: "unknown" }, 0.1)
  const closedMid = mk("closed-mid", { state: "opens", at: "17:00", dayOffset: 0, day: 1 }, 0.5)
  const openFar = mk("open-far", { state: "open", until: "22:00", closesIn: 300 }, 2)
  const order = rankAll([unknownNear, closedMid, openFar], "near").map((r) => r.venue.id)
  assert.deepEqual(order, ["open-far", "closed-mid", "unknown-near"])
  assert.deepEqual(pick3(rankAll([unknownNear, closedMid, openFar], "near")).map((r) => r.venue.id), ["open-far"])
  assert.equal(notOpenNow(unknownNear), true)
  assert.equal(notOpenNow(closedMid), true)
  assert.equal(notOpenNow(openFar), false)
})

// ---- price estimates (~) and the freshness guarantee ----
import { priceModel, priceTag, freshness } from "./logic.ts"

test("every place without a posted per-oyster price gets a ~estimate or a real dish price, never a bare 'See menu'", () => {
  const venues = data.venues as Venue[]
  const model = priceModel(venues)
  assert.ok(model.rawDozen! > 15 && model.rawDozen! < 35, `typical raw dozen ${model.rawDozen}`)
  for (const v of venues) {
    const tag = priceTag(v, { state: "none" } as never, model)
    assert.notEqual(tag.kind, "none", `${v.name} still says See menu`)
    if (tag.kind === "estimate") assert.match(tag.text, /^~\$\d+ /, v.name)
    if (tag.kind === "menu") assert.doesNotMatch(tag.text, /~/, `${v.name}: real prices never get ~`)
  }
})

test("a raw bar with no posted price is estimated at the town's typical dozen, marked ~ and est.", () => {
  const venues = data.venues as Venue[]
  const model = priceModel(venues)
  const seaworthy = venues.find((v) => v.id === "seaworthy")!
  const tag = priceTag(seaworthy, { state: "none" } as never, model)
  assert.equal(tag.kind, "estimate")
  assert.equal(tag.text, `~$${Math.round(model.rawDozen!)} a dozen`)
})

test("in Cheapest, real posted prices rank ahead of ~estimates", () => {
  const ranked = rankAll(enrich(data.venues as Venue[], DEFAULT_ORIGIN, nolaClock(new Date("2026-11-11T19:00:00Z"))), "cheap")
  const kinds = ranked.map((r) => r.price.kind).filter((k) => k === "menu" || k === "happy" || k === "estimate")
  const firstEstimate = kinds.indexOf("estimate")
  const lastReal = Math.max(kinds.lastIndexOf("menu"), kinds.lastIndexOf("happy"))
  // Only places open today are ordered strictly; check the real-before-estimate rule among them.
  const openToday = ranked.filter((r) => !(r.open.state === "opens" && r.open.dayOffset > 0)).filter((r) => r.price.perOyster != null)
  const seen = openToday.map((r) => (r.price.kind === "estimate" ? 1 : 0))
  assert.deepEqual(seen, [...seen].sort(), "an estimate came before a real price")
  assert.ok(firstEstimate >= 0 && lastReal >= 0)
})

test("freshness: verified Thursday is fresh through Monday; a missed Monday check shows as late", () => {
  const thu = { date: "2026-11-12" }
  const f = freshness(thu, new Date("2026-11-16T15:00:00Z")) // Monday 9am NOLA, before the run
  assert.equal(f.state, "fresh")
  assert.equal(f.state === "fresh" && f.label, "Thu, Nov 12")
  const late = freshness(thu, new Date("2026-11-17T18:00:00Z")) // Tuesday: Monday's check never landed
  assert.equal(late.state, "late")
  assert.equal(freshness(undefined, new Date()).state, "never")
})
