// Pure helpers for the weekly shell-giving check. No network, no files: tested by lib.test.mjs.
//
// Two questions, answered without AI or API keys:
//   1. Is the restaurant on the Coalition to Restore Coastal Louisiana's (CRCL) list of restaurants
//      that give their oyster shells back to the coast? Matched by the restaurant's own street address,
//      so another branch of the same restaurant never counts for this one.
//   2. Does the restaurant's own website mention shell recycling or coastal charities? Those are only
//      listed in the report for a person to read; they never change what the app shows.

export const CRCL_URL = "https://crcl.org/osrp-restaurants"

/** Lowercase, no accents, no punctuation, single spaces: "Pêche Seafood, 800 Magazine St." → "peche seafood 800 magazine st" */
export function plain(s) {
  return String(s ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[‘’ʼ']/g, "")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
}

// Words that say nothing about which restaurant it is.
const COMMON = new Set(
  "the and restaurant restaurants oyster oysters seafood bar bars house grill kitchen cafe market patio spirits wine new orleans nola le la st saint tavern lakefront".split(" "),
)
const PREFIX = "(?:(?:n|s|e|w|st|saint) )*"

/** "144 Bourbon St, New Orleans, LA" → { number: "144", street: "bourbon" } */
function streetOf(address) {
  const m = plain(String(address).split(",")[0]).match(/^(\d+) (.+)$/)
  if (!m) return null
  const words = m[2].split(" ").filter((w) => !/^(n|s|e|w|st|saint)$/.test(w))
  return words.length ? { number: m[1], street: words[0] } : null
}

/** The words of a name that identify the restaurant ("Felix's Lakefront" → ["felixs"]). */
function nameWords(name) {
  return plain(String(name).replace(/\(.*?\)/g, " "))
    .split(" ")
    .filter((w) => w.length >= 3 && !COMMON.has(w))
}

const WINDOW = 160 // characters before an address where its restaurant's name is printed

/**
 * Is this venue on CRCL's partner list?
 * "partner": its own address is listed (or its name on the same street, a door number apart);
 * "other-location": its name is listed, but only at another address;
 * "no": not listed.
 * @param {{name: string, address: string}} venue
 * @param {string} listText  the text of CRCL's partner page
 */
export function onPartnerList(venue, listText) {
  const text = plain(listText)
  const at = streetOf(venue.address)
  const names = nameWords(venue.name)
  // The name must sit in the same entry as the address: after the previous entry's last zip code.
  // A zip followed by another address ("…LA 70130 7400 Lakeshore", or "… & 841 Iberville") is still one entry.
  const entryStart = (index) => {
    let start = Math.max(0, index - WINDOW)
    for (const z of text.matchAll(/\bla 70\d{3}\b(?! and | \d)/g)) if (z.index < index) start = Math.max(start, z.index + z[0].length)
    return start
  }
  const nameNear = (index) => names.some((w) => new RegExp(`\\b${w}\\b`).test(text.slice(entryStart(index), index)))
  if (at) {
    const exact = new RegExp(`\\b${at.number} ${PREFIX}${at.street}\\b`, "g")
    for (const m of text.matchAll(exact)) if (nameNear(m.index)) return { status: "partner", why: "own address is listed" }
    const sameStreet = new RegExp(`\\b(\\d+) ${PREFIX}${at.street}\\b`, "g")
    for (const m of text.matchAll(sameStreet)) {
      if (Math.abs(Number(m[1]) - Number(at.number)) <= 20 && nameNear(m.index))
        return { status: "partner", why: `listed by name at ${m[1]} ${at.street.replace(/^./, (c) => c.toUpperCase())} (we show ${at.number})` }
    }
  }
  if (names.length && names.every((w) => new RegExp(`\\b${w}\\b`).test(text))) return { status: "other-location", why: "the name is listed, but at another address" }
  return { status: "no", why: "" }
}

/** A real partner list prints many addresses; a bot check or an error page doesn't. */
export function partnerListReadable(listText) {
  return (String(listText).match(/\bLA\s+70\d{3}\b/g) ?? []).length >= 8
}

// Shell recycling and the coastal charities that run it. Kept narrow: "Shell" the oil company,
// "Shell Beach", plain "oyster bar" and an oyster farm's own reefs must not match.
const GIVING =
  /coalition to restore coastal louisiana|\bcrcl\b|shell recycl\w*|recycl\w* (?:\w+ ){0,3}shells?\b|coastal restoration|restore (?:the|our|louisiana'?s) coast/i

/**
 * Sentences on the restaurant's own pages that mention giving shells back or coastal charities.
 * @param {{url: string, text: string}[]} pages
 * @returns {{url: string, words: string}[]}  at most one per page, with the words around the match
 */
export function givingMentions(pages) {
  const out = []
  const seen = new Set()
  for (const p of pages) {
    if (seen.has(p.url)) continue
    seen.add(p.url)
    const m = GIVING.exec(p.text)
    if (!m) continue
    const from = Math.max(0, m.index - 90)
    const words = p.text.slice(from, m.index + m[0].length + 90).replace(/\s+/g, " ").trim()
    out.push({ url: p.url, words: (from > 0 ? "…" : "") + words + "…" })
  }
  return out
}

/**
 * Put this week's answers into the venues. Only "partner" adds the mark; "no" and "other-location"
 * remove it. Venues with no answer (not checked this run) are left exactly as they were.
 */
export function applyShells(venues, statusById, today, source = CRCL_URL) {
  return venues.map((v) => {
    const status = statusById[v.id]
    if (!status) return v
    if (status === "partner") return { ...v, shells: { via: "CRCL", source, checked: today } }
    if (!("shells" in v)) return v
    const { shells, ...rest } = v
    return rest
  })
}
