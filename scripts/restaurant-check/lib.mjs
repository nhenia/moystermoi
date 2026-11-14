// Pure helpers for the daily restaurant check. No network, no files: everything here is tested
// by lib.test.mjs. The rules that keep wrong data out of the app live here.
//
// The one rule that matters most: a value from the AI reader is used only if it comes with a
// quote, and that quote (with the value inside it) is found word-for-word on the restaurant's
// own page. Anything else is thrown away and listed in the report.

/** Lowercase, straighten quotes and dashes, collapse whitespace: so "$18 / Dozen" ~ "$18/dozen". */
export function normalize(s) {
  return String(s ?? "")
    .toLowerCase()
    .replace(/[‘’ʼ]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—−]/g, "-")
    .replace(/ /g, " ")
    .replace(/\s*([/|:,$.-])\s*/g, "$1")
    .replace(/\s+/g, " ")
    .trim()
}

/** Is `quote` printed on `page` (ignoring case, spacing and punctuation spacing)? */
export function quoteOnPage(quote, page) {
  const q = normalize(quote)
  return q.length >= 3 && normalize(page).includes(q)
}

/** Every number in a price ("$17.95", "17.95") must be inside the quote. */
export function numberInQuote(n, quote) {
  if (n == null) return true
  const q = normalize(quote).replace(/,/g, "")
  const forms = [String(n), Number(n).toFixed(2)]
  if (Number.isInteger(Number(n))) forms.push(`${n}.00`)
  return forms.some((f) => new RegExp(`(^|[^0-9.])${f.replace(".", "\\.")}([^0-9]|$)`).test(q))
}

const TIME = /^\d{2}:\d{2}$/
// one window "HH:MM-HH:MM", or several joined by commas for split days (lunch, then dinner)
const HOURS = /^\d{2}:\d{2}-\d{2}:\d{2}(,\d{2}:\d{2}-\d{2}:\d{2})*$/

/** "16:00" → hour digits a page would print ("4", "16"). */
function hourForms(t) {
  const h = Number(t.slice(0, 2))
  return [String(h), String(h % 12 === 0 ? 12 : h % 12)]
}

function timesInQuote(times, quote) {
  const q = normalize(quote)
  return times.every((t) => hourForms(t).some((h) => new RegExp(`(^|[^0-9])${h}([^0-9]|$)`).test(q)))
}

/**
 * Check the AI reader's answer against the pages it was given. Returns only the parts whose quote
 * is on the page they cite, plus a list of what was thrown out and why.
 * @param {object} x  the AI answer (see EXTRACTION_SCHEMA in ai.mjs)
 * @param {{url: string, text: string}[]} pages
 */
export function verifyExtraction(x, pages) {
  const rejected = []
  const textOf = (url) => pages.find((p) => p.url === url)?.text ?? pages.map((p) => p.text).join("\n")
  const ok = (what, quote, url, extra = true) => {
    if (!quote || !quoteOnPage(quote, textOf(url))) {
      rejected.push(`${what}: quote not found on ${url || "the pages"}`)
      return false
    }
    if (!extra) {
      rejected.push(`${what}: value isn't in its quote`)
      return false
    }
    return true
  }
  const out = { items: [], raw: null, chargrilled: null, market: false, address: null, happyHour: null, hours: null, closedForGood: null, menuUrl: null }

  for (const it of x.oyster_items ?? []) {
    // Dollar amounts must be in the quote ("for 6", "a dozen" are just wording); bare numbers count if there's no "$".
    const dollars = (String(it.price ?? "").match(/\$\s?\d+(?:\.\d+)?/g) ?? []).map((d) => d.replace(/[$\s]/g, ""))
    const nums = dollars.length ? dollars : (String(it.price ?? "").match(/\d+(?:\.\d+)?/g) ?? [])
    const isMarket = /market|mkt|\bmp\b/i.test(it.price ?? "")
    if (!it.name || (!nums.length && !isMarket && !/free/i.test(it.price ?? ""))) continue
    if (ok(`item "${it.name}"`, it.quote, it.url, nums.every((n) => numberInQuote(n, it.quote)))) {
      out.items.push({ name: String(it.name).trim(), price: String(it.price).trim(), url: it.url })
    }
  }
  if (out.items.length) {
    const counts = {}
    for (const it of out.items) counts[it.url] = (counts[it.url] ?? 0) + 1
    out.menuUrl = Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0]
    out.items = out.items.map(({ name, price }) => ({ name, price }))
  }
  out.market = Boolean(x.market_price?.value && ok("market price", x.market_price.quote, x.market_price.url))

  for (const key of ["raw", "chargrilled"]) {
    const p = x[key]
    if (!p) continue
    const nums = ["each", "half", "dozen"].filter((k) => p[k] != null)
    if (!nums.length) continue
    if (ok(`${key} price`, p.quote, p.url, nums.every((k) => numberInQuote(p[k], p.quote)))) {
      out[key] = Object.fromEntries(nums.filter((k) => !(key === "chargrilled" && k === "each")).map((k) => [k, Number(p[k])]))
    }
  }

  if (x.address?.value) {
    const num = x.address.value.match(/^\d+/)?.[0]
    if (ok("address", x.address.quote, x.address.url, !num || normalize(x.address.quote).includes(num))) out.address = x.address.value.trim()
  }

  const hh = x.happy_hour
  if (hh?.listed) {
    const wellFormed = Array.isArray(hh.days) && hh.days.length > 0 && hh.days.every((d) => Number.isInteger(d) && d >= 0 && d <= 6) && TIME.test(hh.start ?? "") && TIME.test(hh.end ?? "") && hh.deal
    if (!wellFormed) rejected.push("happy hour: missing days, times or deal")
    else if (ok("happy hour", hh.quote, hh.url, timesInQuote([hh.start, hh.end], hh.quote) && numberInQuote(hh.price, hh.quote))) {
      out.happyHour = { deal: String(hh.deal).trim(), days: [...new Set(hh.days)].sort((a, b) => a - b), start: hh.start, end: hh.end, price: hh.price ?? null, unit: hh.unit || (hh.price != null ? "each" : "variable"), url: hh.url }
    }
  }

  if (Array.isArray(x.hours?.days) && x.hours.days.length === 7) {
    const valid = x.hours.days.every((h) => h === "closed" || HOURS.test(h ?? ""))
    const times = x.hours.days.filter((h) => h && h !== "closed").flatMap((h) => h.split(/[,-]/))
    if (!valid) rejected.push("hours: not 7 valid days")
    else if (ok("hours", x.hours.quote, x.hours.url, timesInQuote([...new Set(times)], x.hours.quote))) out.hours = x.hours.days
  }

  if (x.closed_for_good?.value && ok("closed for good", x.closed_for_good.quote, x.closed_for_good.url)) out.closedForGood = x.closed_for_good.quote

  return { result: out, rejected }
}

const sameStreet = (a, b) => normalize(a).replace(/,?\s*new orleans.*$/, "").replace(/\bstreet\b/g, "st").replace(/\bavenue\b/g, "ave").replace(/[.,]/g, "") ===
  normalize(b).replace(/,?\s*new orleans.*$/, "").replace(/\bstreet\b/g, "st").replace(/\bavenue\b/g, "ave").replace(/[.,]/g, "")

const eq = (a, b) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null)

/**
 * Apply a verified result to one venue (returns a new venue, never mutates).
 * Rules:
 *  - menu items / prices / address / hours / happy hour change only when a verified value differs;
 *  - a timed happy hour counts as re-confirmed (verified = today) only if it was found on the page;
 *  - "closed for good" is never applied automatically, it is reported for a human.
 */
export function applyResult(venue, r, today, pageUrl) {
  const v = structuredClone(venue)
  const changes = []
  const note = (field, was, now, proof) => changes.push({ field, was, now, proof })

  if (r.items.length || r.raw || r.chargrilled || r.market) {
    const menu = v.menu ?? { url: r.menuUrl ?? pageUrl }
    if (r.items.length && !eq(menu.items, r.items)) {
      note("oyster menu", (menu.items ?? []).map((i) => `${i.name} ${i.price}`).join("; ") || "none", r.items.map((i) => `${i.name} ${i.price}`).join("; "), r.menuUrl)
      menu.items = r.items
    }
    for (const key of ["raw", "chargrilled"]) {
      if (r[key] && !eq(menu[key], r[key])) {
        note(`${key} price`, JSON.stringify(menu[key] ?? null), JSON.stringify(r[key]), r.menuUrl ?? pageUrl)
        menu[key] = r[key]
      }
    }
    if (r.market && !menu.market) menu.market = true
    if (r.menuUrl) menu.url = r.menuUrl
    menu.checked = today
    menu.checkedFrom = "restaurant"
    v.menu = menu
  }

  if (r.address && !sameStreet(r.address, v.address)) {
    note("address", v.address, r.address, pageUrl)
    v.address = /new orleans/i.test(r.address) ? r.address : `${r.address}, New Orleans, LA`
    delete v.lat
    delete v.lng // the data robot re-maps it
  }

  if (r.hours && !eq(v.hours, r.hours)) {
    note("hours", JSON.stringify(v.hours ?? null), JSON.stringify(r.hours), pageUrl)
    v.hours = r.hours
  }

  let confirmed = false
  if (r.happyHour) {
    const h = r.happyHour
    const now = { deal: h.deal, days: h.days, start: h.start, end: h.end, price: h.price, unit: h.unit }
    const was = { deal: v.deal, days: v.days, start: v.start, end: v.end, price: v.price, unit: v.unit }
    const timesSame = eq(was.days, now.days) && was.start === now.start && was.end === now.end && was.price === now.price
    if (!timesSame) {
      note("happy hour", v.start ? `${v.deal} (${JSON.stringify(v.days)} ${v.start}–${v.end})` : "none", `${h.deal} (${JSON.stringify(h.days)} ${h.start}–${h.end})`, h.url)
      Object.assign(v, now)
      delete v.hhUnposted
    }
    v.source = h.url // the restaurant's own page is the proof from now on
    confirmed = true
  } else if (!v.start) {
    // No timed happy hour to keep fresh: reading the menu is the confirmation.
    confirmed = Boolean(r.items.length || r.raw || r.chargrilled || r.market || r.hours)
  }
  if (confirmed) v.verified = today

  return { venue: v, changes, confirmed, needsHuman: r.closedForGood ? `says it may be closing: "${r.closedForGood}"` : null }
}

/** Keep the parts of a page that can hold oyster prices, happy hours, hours or the address. */
export function relevantText(text, cap) {
  const lines = String(text).split("\n").map((l) => l.trim()).filter(Boolean)
  const hit = /oyster|half shell|chargrill|charbroil|rockefeller|bienville|happy|hour|daily|mon|tue|wed|thu|fri|sat|sun|am\b|pm\b|closed|\$|\bmkt\b|market|dozen|each|street|\bst\b|ave|blvd|new orleans/i
  const keep = new Set()
  lines.forEach((l, i) => {
    if (hit.test(l)) for (let j = Math.max(0, i - 2); j <= Math.min(lines.length - 1, i + 2); j++) keep.add(j)
  })
  let out = [...keep].sort((a, b) => a - b).map((i) => lines[i]).join("\n")
  if (out.length > cap) out = out.slice(0, cap)
  return out
}

/**
 * GitHub's scheduler only speaks UTC, so the workflow fires at both 14:00 and 15:00 UTC and this
 * keeps the one that is 9:00 in New Orleans today (14:00 UTC in summer time, 15:00 in winter).
 */
export function isNineInNewOrleans(cron, now = new Date()) {
  const offsetHours = Number(
    new Intl.DateTimeFormat("en-US", { timeZone: "America/Chicago", timeZoneName: "shortOffset" })
      .formatToParts(now)
      .find((p) => p.type === "timeZoneName")
      .value.replace("GMT", "") || 0,
  )
  const wantedUtcHour = 9 - offsetHours // -5 → 14, -6 → 15
  return new RegExp(`^\\S+\\s+${wantedUtcHour}\\s`).test(cron.trim())
}

/** Oldest verified date across venues: "everything has been checked since". */
export const oldestVerified = (venues) => venues.map((v) => v.verified).filter(Boolean).sort()[0]
