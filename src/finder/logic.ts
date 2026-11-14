// Pure, testable logic for the oyster finder. No React, no browser APIs.
// Everything time-related is computed in New Orleans time, wherever the phone is.

export type Venue = {
  id: string
  name: string
  area: string
  address: string
  lat?: number | null
  lng?: number | null
  kind: string[]
  price: number | null
  unit: string
  deal: string
  days: number[]
  start: string | null
  end: string | null
  note: string
  source: string
  /**
   * When oysters are served, Sunday first (index 0) to Saturday (6).
   * Each day is "HH:MM-HH:MM" (an end at or before the start runs past midnight), several of
   * those joined by commas for split days ("11:00-14:00,17:30-21:00"), "00:00-24:00" for open
   * all day, "closed", or null when the hours aren't published. Omit the field if no hours are known.
   */
  hours?: (string | null)[] | null
  /** Where the hours came from (the restaurant's own page whenever it posts them). */
  hoursSource?: string
  /** Set by estimateHours(): days whose hours were copied from another day. Never in deals.json. */
  hoursEstimated?: number[]
  /** Date this venue was last checked against its source (YYYY-MM-DD). */
  verified?: string
  /** Regular (non-happy-hour) oyster prices, when the restaurant posts them. */
  menu?: Menu
  /** Shown (tap to call) whenever hours or happy-hour times are missing. */
  phone?: string
  /** The restaurant's own website: the daily check reads only this site. */
  website?: string
  /** Pages on the restaurant's own site to always read (menus, happy hour), besides the ones it finds. */
  pages?: string[]
  /** A happy hour the restaurant has, but whose times aren't posted. */
  hhUnposted?: string
  /** Set by freshen(): the happy hour hasn't been re-confirmed since this date ("Nov 1"). Never in deals.json. */
  hhStale?: string
  /** One striking fact (under 7 words), never a general description. Leave out if there is none. */
  lore?: string
}

/** "(504) 522-0111" → "tel:+15045220111" */
export const telLink = (phone: string) => `tel:+1${phone.replace(/\D/g, "")}`

export type Menu = {
  raw?: { each?: number; half?: number; dozen?: number }
  chargrilled?: { half?: number; dozen?: number }
  /** The menu says "market price". */
  market?: boolean
  /** Every oyster dish on the menu, with its price as printed ("$18 for 6", "Market price"). */
  items?: { name: string; price: string }[]
  /** When the menu was checked, and whether it was the restaurant's own menu or another site. */
  checked?: string
  checkedFrom?: "restaurant" | "other site"
  /** Where to see the menu. */
  url: string
}

/** The one price to show right now: the happy hour deal while it applies today, else the regular menu. */
export type PriceTag =
  | { kind: "happy"; text: string; perOyster: number | null }
  | { kind: "menu"; text: string; perOyster: number }
  | { kind: "market"; text: string; perOyster: null }
  | { kind: "dish"; text: string; perOyster: null }
  | { kind: "estimate"; text: string; perOyster: number | null; basis: string }
  | { kind: "none"; text: string; perOyster: null }

export type Coordinates = { lat: number; lng: number }
export type Mode = "near" | "happy" | "cheap" | "map"

export type NolaClock = { day: number; minutes: number }

export type HappyHour =
  | { state: "now"; endsIn: number; start: string; end: string }
  | { state: "later"; startsIn: number; start: string; end: string }
  | { state: "upcoming"; dayOffset: number; day: number; start: string; end: string }
  | { state: "none" }

export type OpenStatus =
  | { state: "open"; until: string; closesIn: number; allDay?: boolean; estimated?: boolean }
  | { state: "opens"; at: string; dayOffset: number; day: number; estimated?: boolean }
  | { state: "unknown" }

export type Ranked = {
  venue: Venue
  miles: number | null
  walk: number | null
  hh: HappyHour
  open: OpenStatus
  /** Happy hour price per oyster (null if none posted). */
  perOyster: number | null
  price: PriceTag
}

export const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]

/** The French Quarter (Jackson Square). Used, and labelled as such, until we know where you are. */
export const DEFAULT_ORIGIN: Coordinates & { label: string } = {
  lat: 29.95746,
  lng: -90.06301,
  label: "French Quarter",
}

export function nolaClock(date: Date = new Date()): NolaClock {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Chicago",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date)
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? ""
  return {
    day: DAY_NAMES.indexOf(get("weekday")),
    minutes: Number(get("hour")) * 60 + Number(get("minute")),
  }
}

export const toMinutes = (time: string) => {
  const [h, m] = time.split(":").map(Number)
  return h * 60 + (m || 0)
}

/** A time window in minutes after midnight. Windows that end at/before they start run past midnight. */
export function span(start: string, end: string): [number, number] {
  const s = toMinutes(start)
  let e = toMinutes(end)
  if (e <= s) e += 1440
  return [s, e]
}

const yesterday = (day: number) => (day + 6) % 7

export function happyHour(venue: Venue, clock: NolaClock): HappyHour {
  if (!venue.start || !venue.end || venue.days.length === 0) return { state: "none" }
  const [start, end] = span(venue.start, venue.end)
  const window = { start: venue.start, end: venue.end }
  if (venue.days.includes(clock.day) && clock.minutes >= start && clock.minutes < end)
    return { state: "now", endsIn: end - clock.minutes, ...window }
  // Yesterday's happy hour still running after midnight
  if (end > 1440 && venue.days.includes(yesterday(clock.day)) && clock.minutes < end - 1440)
    return { state: "now", endsIn: end - 1440 - clock.minutes, ...window }
  if (venue.days.includes(clock.day) && clock.minutes < start)
    return { state: "later", startsIn: start - clock.minutes, ...window }
  for (let offset = 1; offset <= 7; offset++) {
    const day = (clock.day + offset) % 7
    if (venue.days.includes(day)) return { state: "upcoming", dayOffset: offset, day, ...window }
  }
  return { state: "none" }
}

/** The windows in one day's entry: "11:00-14:00,17:30-21:00" -> [["11:00","14:00"],["17:30","21:00"]]. */
export const windows = (entry: string): [string, string][] =>
  entry.split(",").map((w) => w.trim().split("-") as [string, string])

const ALL_DAY = "00:00-24:00"

/**
 * Fill in days whose hours aren't published (null) by copying the nearest earlier day that's open,
 * or failing that the nearest later one. Days marked "closed" stay closed and are never copied.
 * Copied days are listed in hoursEstimated so the app can say they're estimates.
 */
export function estimateHours(venue: Venue): Venue {
  const hours = venue.hours
  if (!hours || hours.length !== 7 || !hours.includes(null)) return venue
  const isOpen = (h: string | null | undefined): h is string => h != null && h !== "closed"
  if (!hours.some(isOpen)) return venue
  const filled = [...hours]
  const estimated: number[] = []
  for (let d = 0; d < 7; d++) {
    if (hours[d] != null) continue
    let pick: string | undefined
    for (let back = 1; back < 7 && !pick; back++) if (isOpen(hours[(d - back + 7) % 7])) pick = hours[(d - back + 7) % 7]!
    for (let fwd = 1; fwd < 7 && !pick; fwd++) if (isOpen(hours[(d + fwd) % 7])) pick = hours[(d + fwd) % 7]!
    if (pick) {
      filled[d] = pick
      estimated.push(d)
    }
  }
  return { ...venue, hours: filled, hoursEstimated: estimated }
}

/** Is the venue serving oysters right now, and if not, when next? Unknown hours stay unknown. */
export function openStatus(venue: Venue, clock: NolaClock): OpenStatus {
  const hours = venue.hours
  if (!hours || hours.length !== 7) return { state: "unknown" }
  const est = (day: number) => (venue.hoursEstimated?.includes(day) ? { estimated: true } : {})
  const today = hours[clock.day]
  if (today && today !== "closed") {
    if (today === ALL_DAY) return { state: "open", until: "24:00", closesIn: 1440 - clock.minutes, allDay: true, ...est(clock.day) }
    for (const [a, b] of windows(today)) {
      const [s, e] = span(a, b)
      if (clock.minutes >= s && clock.minutes < e) return { state: "open", until: b, closesIn: e - clock.minutes, ...est(clock.day) }
    }
  }
  const prev = hours[yesterday(clock.day)]
  if (prev && prev !== "closed" && prev !== ALL_DAY) {
    for (const [a, b] of windows(prev)) {
      const [, e] = span(a, b)
      if (e > 1440 && clock.minutes < e - 1440)
        return { state: "open", until: b, closesIn: e - 1440 - clock.minutes, ...est(yesterday(clock.day)) }
    }
  }
  for (let offset = 0; offset <= 7; offset++) {
    const day = (clock.day + offset) % 7
    const entry = hours[day]
    if (entry == null) return { state: "unknown" }
    if (entry === "closed") continue
    for (const [a, b] of windows(entry)) {
      const [s] = span(a, b)
      if (offset === 0 && s <= clock.minutes) continue
      return { state: "opens", at: a, dayOffset: offset, day, ...est(day) }
    }
  }
  return { state: "unknown" }
}

/** Normalise a posted price to dollars per oyster. Never guesses: unknown units return null. */
export function perOyster(venue: Venue): number | null {
  if (venue.price == null || !Number.isFinite(venue.price)) return null
  switch (venue.unit) {
    case "each":
      return venue.price
    case "half-dozen":
      return venue.price / 6
    case "dozen":
      return venue.price / 12
    default:
      return null
  }
}

export function milesBetween(a: Coordinates, b: Coordinates) {
  const rad = (v: number) => (v * Math.PI) / 180
  const dLat = rad(b.lat - a.lat)
  const dLng = rad(b.lng - a.lng)
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2
  return 3958.8 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h))
}

/**
 * Walking minutes from straight-line miles. Streets aren't straight, so we add 25% for the
 * grid, then walk at 3 mph (20 min/mile). Rounded up, minimum 1.
 */
export const walkMinutes = (miles: number) => Math.max(1, Math.ceil(miles * 1.25 * 20))

export const hasCoords = (v: Venue): v is Venue & { lat: number; lng: number } =>
  typeof v.lat === "number" && typeof v.lng === "number" && Number.isFinite(v.lat) && Number.isFinite(v.lng)

export function enrich(venues: Venue[], origin: Coordinates, clock: NolaClock): Ranked[] {
  const model = priceModel(venues)
  return venues.map((venue) => {
    const miles = hasCoords(venue) ? milesBetween(origin, venue) : null
    const hh = happyHour(venue, clock)
    return {
      venue,
      miles,
      walk: miles == null ? null : walkMinutes(miles),
      hh,
      open: openStatus(venue, clock),
      perOyster: perOyster(venue),
      price: priceTag(venue, hh, model),
    }
  })
}

const byMiles = (a: Ranked, b: Ranked) =>
  (a.miles ?? Infinity) - (b.miles ?? Infinity) || a.venue.name.localeCompare(b.venue.name)

/** Open now first, then closed (with a known opening time), then unknown hours. Every mode lists every venue. */
const openRank = (r: Ranked) => (r.open.state === "open" || r.hh.state === "now" ? 0 : r.open.state === "opens" ? 1 : 2)

/** Not confirmed open right now: closed, or hours unknown. A live happy hour counts as open. */
export const notOpenNow = (r: Ranked) => r.open.state !== "open" && r.hh.state !== "now"

export const appliesToday = (hh: HappyHour) => hh.state === "now" || hh.state === "later"

/** Happy hour mode: live specials, then ones starting later today, then everything else that's open. */
const happyRank = (r: Ranked) => {
  if (r.hh.state === "now") return 0
  if (r.hh.state === "later") return 1
  return 2 + openRank(r)
}

/** Cheapest mode: any price you can actually get today (happy hour or menu), cheapest first; then the rest. */
const cheapRank = (r: Ranked) =>
  r.price.perOyster == null || (r.open.state === "opens" && r.open.dayOffset > 0 && r.hh.state !== "later")
    ? 2
    : r.price.kind === "estimate"
      ? 1
      : 0

export function rank(list: Ranked[], mode: Mode): Ranked[] {
  const items = [...list]
  switch (mode) {
    case "happy":
      return items.sort(
        (a, b) =>
          happyRank(a) - happyRank(b) ||
          (a.hh.state === "later" && b.hh.state === "later" ? a.hh.startsIn - b.hh.startsIn : 0) ||
          byMiles(a, b),
      )
    case "cheap":
      return items.sort(
        (a, b) =>
          cheapRank(a) - cheapRank(b) ||
          (cheapRank(a) < 2 ? a.price.perOyster! - b.price.perOyster! : openRank(a) - openRank(b)) ||
          byMiles(a, b),
      )
    default:
      return items.sort((a, b) => openRank(a) - openRank(b) || byMiles(a, b))
  }
}

/** The three picks: the top of the ranking, skipping places that are closed or whose hours are unknown
 *  (unless their happy hour starts later today). */
export function pickThree(ranked: Ranked[]): Ranked[] {
  return ranked.filter((r) => !notOpenNow(r) || r.hh.state === "later").slice(0, 3)
}

// ---------- Formatting ----------

/** "10 pm", "11:30 am", "12 am" — with a space, easier to read. */
export function formatTime(time: string) {
  const [raw, m] = time.split(":").map(Number)
  const h = raw % 24
  // A non-breaking space keeps "5 pm" on one line.
  return `${h % 12 || 12}${m ? `:${String(m).padStart(2, "0")}` : ""}\u00a0${h >= 12 ? "pm" : "am"}`
}

/** "3–6 pm", "11:30 am–9 pm", "3 pm–1 am" */
export function formatRange(start: string, end: string) {
  const a = formatTime(start)
  const b = formatTime(end)
  const meridiem = (t: string) => t.slice(-2)
  // Share "pm" only when it can't mislead: never across midnight ("8 am–1 am", not "8–1 am").
  const overnight = toMinutes(end) <= toMinutes(start)
  return !overnight && meridiem(a) === meridiem(b) ? `${a.slice(0, -3)}–${b}` : `${a}–${b}`
}

export function formatDuration(minutes: number) {
  if (minutes < 60) return `${minutes} min`
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return m ? `${h} hr ${m} min` : `${h} hr`
}

export function formatMoney(value: number) {
  if (value < 1) return `${Math.round(value * 100)}¢`
  return `$${Number.isInteger(value) ? value : value.toFixed(2)}`
}

/** Headline price, e.g. "$1.50 ea", "$10 / 6". Null when no verified price exists. */
export function formatPrice(venue: Venue): string | null {
  if (venue.price == null) return null
  const money = formatMoney(venue.price)
  switch (venue.unit) {
    case "each":
      return `${money} ea`
    case "half-dozen":
      return `${money} / 6`
    case "dozen":
      return `${money} / 12`
    default:
      return money
  }
}

export function formatHappyHour(hh: HappyHour): string {
  switch (hh.state) {
    case "now":
      return `Happy hour now · ends ${formatTime(hh.end)}`
    case "later":
      return `Happy hour ${formatRange(hh.start, hh.end)} · starts in ${formatDuration(hh.startsIn)}`
    case "upcoming":
      return `Happy hour ${hh.dayOffset === 1 ? "tomorrow" : DAY_NAMES[hh.day]} ${formatRange(hh.start, hh.end)}`
    default:
      return ""
  }
}

export function formatOpen(open: OpenStatus): string {
  switch (open.state) {
    case "open": {
      const est = open.estimated ? " (est.)" : ""
      if (open.allDay) return `Open now · 24 hours${est}`
      return open.closesIn <= 45
        ? `Open now · closes at ${formatTime(open.until)} (${open.closesIn} min)${est}`
        : `Open now · until ${formatTime(open.until)}${est}`
    }
    case "opens":
      return `Closed now · opens ${open.dayOffset === 0 ? "" : open.dayOffset === 1 ? "tomorrow " : `${DAY_NAMES[open.day]} `}${formatTime(open.at)}${open.estimated ? " (est.)" : ""}`
    default:
      return "Hours not listed"
  }
}

export function formatWalk(r: Pick<Ranked, "walk" | "miles">): string | null {
  if (r.walk == null || r.miles == null) return null
  if (r.walk <= 45) return `${r.walk} min walk`
  return `${r.miles.toFixed(1)} mi · ride`
}

/** Days between a YYYY-MM-DD date and now. */
export function daysSince(isoDate: string, now: Date = new Date()) {
  const then = new Date(`${isoDate}T12:00:00-06:00`).getTime()
  if (!Number.isFinite(then)) return Infinity
  return Math.floor((now.getTime() - then) / 86_400_000)
}

export const STALE_AFTER_DAYS = 45

/** A happy hour not re-confirmed within this many days stops showing as a live deal. */
export const DEAL_STALE_AFTER_DAYS = 21

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]

/**
 * Old happy-hour info is worse than none: a tourist walks there for a $1 oyster that ended in October.
 * If a venue's timed happy hour hasn't been checked in DEAL_STALE_AFTER_DAYS, return a copy that
 * shows it as "call to confirm" (via hhUnposted) instead of a live deal with a price.
 */
export function freshen(venue: Venue, now: Date = new Date()): Venue {
  if (!venue.start || !venue.end || venue.days.length === 0) return venue
  const age = venue.verified ? daysSince(venue.verified, now) : Infinity
  if (age <= DEAL_STALE_AFTER_DAYS) return venue
  const [, m, d] = (venue.verified ?? "").split("-").map(Number)
  const when = venue.verified && m ? `${MONTHS[m - 1]} ${d}` : "a while"
  const summary = [venue.deal, `${formatDays(venue.days)} ${formatRange(venue.start, venue.end)}`]
    .filter(Boolean)
    .join(" · ")
  return {
    ...venue,
    price: null,
    unit: "variable",
    deal: "",
    days: [],
    start: null,
    end: null,
    hhUnposted: summary,
    hhStale: when,
  }
}

export function walkingDirections(venue: Venue) {
  // Name + address lands on the actual business listing in Google Maps (better than raw coordinates).
  const destination = `${venue.name}, ${venue.address}`
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destination)}&travelmode=walking`
}

/** "Daily", "Mon–Fri", "Tue", "Fri–Sun", "Mon, Wed" */
export function formatDays(days: number[]) {
  const set = [...new Set(days)].sort((a, b) => a - b)
  if (set.length === 7) return "Daily"
  if (set.length === 0) return ""
  // Find a single consecutive run, allowing it to wrap past Saturday (e.g. Fri–Sun).
  for (let start = 0; start < 7; start++) {
    const run = Array.from({ length: set.length }, (_, i) => (start + i) % 7)
    if (run.every((d) => set.includes(d)) && set.includes(start) && !set.includes((start + 6) % 7))
      return run.length === 1 ? DAY_NAMES[start] : `${DAY_NAMES[start]}–${DAY_NAMES[run[run.length - 1]]}`
  }
  return set.map((d) => DAY_NAMES[d]).join(", ")
}

/**
 * The oracle's draw ("shuck me"): somewhere serving now and within a 25-minute walk,
 * weighted toward live happy hours. Falls back to the nearest open spot.
 */
export function drawOyster(list: Ranked[], rnd: () => number = Math.random): Ranked | null {
  const pool = list.filter((r) => (r.open.state === "open" || r.hh.state === "now") && r.walk != null && r.walk <= 25)
  if (pool.length === 0) return rank(list, "near").find((r) => r.open.state === "open") ?? null
  const weight = (r: Ranked) => (r.hh.state === "now" ? 4 : r.hh.state === "later" ? 1.5 : 1)
  let roll = rnd() * pool.reduce((sum, r) => sum + weight(r), 0)
  for (const r of pool) {
    roll -= weight(r)
    if (roll <= 0) return r
  }
  return pool[pool.length - 1]
}

const money = (n: number) => (Number.isInteger(n) ? `$${n}` : `$${n.toFixed(2)}`)

/** Regular menu price per oyster: dozen, then half dozen, then by the oyster. */
export function menuPerOyster(menu?: Menu): number | null {
  const raw = menu?.raw
  if (raw?.dozen != null) return raw.dozen / 12
  if (raw?.half != null) return raw.half / 6
  if (raw?.each != null) return raw.each
  const grill = menu?.chargrilled
  if (grill?.dozen != null) return grill.dozen / 12
  if (grill?.half != null) return grill.half / 6
  return null
}

/** "$22 a dozen", "$8 for 6", "from $2.75 each" */
export function formatMenuPrice(menu?: Menu): string | null {
  const raw = menu?.raw
  if (raw?.dozen != null) return `${money(raw.dozen)} a dozen`
  if (raw?.half != null) return `${money(raw.half)} for 6`
  if (raw?.each != null) return `from ${money(raw.each)} each`
  const grill = menu?.chargrilled
  if (grill?.dozen != null) return `${money(grill.dozen)} a dozen (chargrilled)`
  if (grill?.half != null) return `${money(grill.half)} for 6 (chargrilled)`
  return null
}

const median = (xs: number[]) => {
  const v = [...xs].sort((a, b) => a - b)
  return v.length ? (v.length % 2 ? v[(v.length - 1) / 2] : (v[v.length / 2 - 1] + v[v.length / 2]) / 2) : null
}
const dollars = (s: string) => {
  const m = /\$\s?(\d+(?:\.\d{2})?)/.exec(s)
  return m ? Number(m[1]) : null
}
const PLATE = /fried|roast|grill|charbroil|brochette|rockefeller|bienville|baked|platter|plate/i
const NOT_PLATE = /po.?boy|loaf|sandwich|shooter|bun|happy hour|add-on|tower|plateau/i

/** Typical New Orleans prices, worked out from the places that post real ones. Used for ~estimates. */
export type PriceModel = { rawDozen: number | null; grillDozen: number | null; plate: number | null; rawCount: number }
export function priceModel(venues: Venue[]): PriceModel {
  const raw = venues.map((v) => v.menu?.raw?.dozen ?? (v.menu?.raw?.half != null ? v.menu.raw.half * 2 : null)).filter((n): n is number => n != null)
  const grill = venues.map((v) => v.menu?.chargrilled?.dozen ?? null).filter((n): n is number => n != null)
  const plates = venues.flatMap((v) => (v.menu?.items ?? []).filter((i) => PLATE.test(i.name) && !NOT_PLATE.test(i.name)).map((i) => dollars(i.price))).filter((n): n is number => n != null)
  return { rawDozen: median(raw), grillDozen: median(grill), plate: median(plates), rawCount: raw.length }
}

/** The cheapest priced oyster dish on the venue's own menu list (real, not an estimate). */
function cheapestDish(venue: Venue) {
  const prices = (venue.menu?.items ?? []).filter((i) => !/happy hour/i.test(i.name)).map((i) => dollars(i.price)).filter((n): n is number => n != null && n >= 5)
  return prices.length ? Math.min(...prices) : null
}

export function priceTag(venue: Venue, hh: HappyHour, model?: PriceModel): PriceTag {
  if ((hh.state === "now" || hh.state === "later") && venue.price != null) {
    const text = formatPrice(venue)!.replace(" ea", " each").replace(" / 6", " for 6").replace(" / 12", " a dozen")
    return { kind: "happy", text, perOyster: perOyster(venue) }
  }
  const per = menuPerOyster(venue.menu)
  if (per != null) return { kind: "menu", text: formatMenuPrice(venue.menu)!, perOyster: per }
  if (!model) {
    if (venue.menu?.market) return { kind: "market", text: "Market price", perOyster: null }
    return { kind: "none", text: "See menu", perOyster: null }
  }
  // No posted per-oyster price: estimate from what similar dishes cost around town, marked with ~.
  const serves = venue.kind ?? []
  const round = (n: number) => `$${Math.round(n)}`
  const basis = `typical of ${model.rawCount} New Orleans oyster bars that post prices`
  if (serves.includes("raw") && model.rawDozen != null)
    return { kind: "estimate", text: `~${round(model.rawDozen)} a dozen`, perOyster: model.rawDozen / 12, basis }
  const dish = cheapestDish(venue)
  if (dish != null) return { kind: "dish", text: `dishes from ${money(dish)}`, perOyster: null }
  if (serves.includes("chargrilled") && model.grillDozen != null)
    return { kind: "estimate", text: `~${round(model.grillDozen)} a dozen chargrilled`, perOyster: model.grillDozen / 12, basis }
  if (model.plate != null) return { kind: "estimate", text: `~${round(model.plate)} a plate`, perOyster: null, basis }
  return { kind: "none", text: "See menu", perOyster: null }
}

/** The Monday & Thursday freshness guarantee. Longest gap between two check days is Thu→Mon: 4 days. */
export const VERIFY_EVERY_DAYS = 4
export type Freshness =
  | { state: "fresh"; label: string; date: string }
  | { state: "late"; label: string; date: string; days: number }
  | { state: "never" }
export function freshness(verified: { date: string } | undefined, now: Date): Freshness {
  if (!verified?.date) return { state: "never" }
  const label = new Intl.DateTimeFormat("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" }).format(
    new Date(`${verified.date}T12:00:00Z`),
  )
  const days = daysSince(verified.date, now)
  return days > VERIFY_EVERY_DAYS ? { state: "late", label, date: verified.date, days } : { state: "fresh", label, date: verified.date }
}
