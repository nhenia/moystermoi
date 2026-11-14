#!/usr/bin/env node
// Daily restaurant check — run by .github/workflows/daily-restaurant-check.yml at 9am New Orleans time,
// or by hand:  node scripts/check-restaurants.mjs [venue-id ...]   (add --dry-run to change nothing)
//
// No AI, no API keys. For every restaurant in src/deals.json it:
//   1. reads the restaurant's OWN website (menus, happy hour pages, menu PDFs) in a headless browser;
//   2. checks that the prices, happy-hour times and opening hours we show are still printed there,
//      word for word (see restaurant-check/lib.mjs);
//   3. stamps a restaurant "verified today" only when every price and time we show was found;
//   4. notes which restaurants' pages changed since the last run, so a person knows where to look;
//   5. writes a plain-language report to data/last-check.md and the site-wide "Verified" date.
// It never changes a price or removes a restaurant on its own: anything that no longer matches is
// listed in the report for a person to fix.

import fs from "node:fs/promises"
import path from "node:path"
import crypto from "node:crypto"
import { fileURLToPath } from "node:url"
import { readSite, launch, launchHttp1 } from "./restaurant-check/pages.mjs"
import { relevantText, oldestVerified, stillPosted, hoursPosted, verificationStamp } from "./restaurant-check/lib.mjs"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const dataFile = path.join(root, "src", "deals.json")
const stateFile = path.join(root, "data", "restaurant-check.json")
const reportFile = path.join(root, "data", "last-check.md")

const args = process.argv.slice(2)
const dryRun = args.includes("--dry-run")
const only = args.filter((a) => !a.startsWith("--"))
const today = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Chicago" }).format(new Date())

const data = JSON.parse(await fs.readFile(dataFile, "utf8"))
const state = JSON.parse(await fs.readFile(stateFile, "utf8").catch(() => "{}"))
const venues = data.venues.filter((v) => !only.length || only.includes(v.id))

const posted = { read: 0, confirmed: [], missing: [] }
const report = { couldNotRead: [], pageChanged: [], hoursMissing: [], hoursOk: [] }
const browser = await launch()
let http1 = null

async function checkVenue(venue) {
  let site = await readSite(browser, venue)
  if (!site.pages.length && site.problems.some((p) => /ERR_HTTP2|ERR_EMPTY_RESPONSE|ERR_CONNECTION_CLOSED/.test(p))) {
    http1 ??= await launchHttp1()
    site = await readSite(http1, venue)
  }
  const pages = site.pages.map((p) => ({ url: p.url, text: p.text })).filter((p) => p.text.length > 40)
  if (!pages.length) {
    report.couldNotRead.push({ venue, why: site.problems.join("; ") || "no readable text on its site" })
    return venue
  }
  posted.read++
  const still = stillPosted(venue, pages)
  if (still.confirmed) posted.confirmed.push(venue)
  else if (still.missing.length) posted.missing.push({ venue, missing: still.missing })

  const hours = hoursPosted(venue, pages)
  if (hours?.confirmed) report.hoursOk.push(venue)
  else if (hours) report.hoursMissing.push({ venue, missing: hours.missing })

  const hash = crypto.createHash("sha256").update(pages.map((p) => p.url + "\n" + relevantText(p.text, 20000)).join("\n")).digest("hex").slice(0, 16)
  const prev = state[venue.id]
  if (prev?.hash && prev.hash !== hash) report.pageChanged.push({ venue, url: pages[0].url })
  state[venue.id] = { hash, checked: today, posted: still.confirmed }

  return still.confirmed ? { ...venue, verified: today } : venue
}

// A few at a time: polite to restaurant sites and within free AI rate limits.
const results = new Map()
const queue = [...venues]
await Promise.all(
  Array.from({ length: 3 }, async () => {
    while (queue.length) {
      const v = queue.shift()
      try {
        results.set(v.id, await checkVenue(v))
      } catch (e) {
        report.couldNotRead.push({ venue: v, why: e.message })
        results.set(v.id, v)
      }
      process.stdout.write(".")
    }
  }),
)
await browser.close()
await http1?.close()
console.log("")

data.venues = data.venues.map((v) => results.get(v.id) ?? v)
data.updated = oldestVerified(data.venues) ?? data.updated
// The freshness stamp the site shows. Only a full run that read most restaurant sites counts.
const stamp = only.length ? null : verificationStamp(today, venues.length, posted.read, posted.confirmed.length)
if (stamp) data.checks = { ...data.checks, verified: stamp }

const line = (v) => `**${v.name}**`
const md = [
  `# Daily restaurant check: ${today}`,
  "",
  `Read each restaurant's own website (no AI). ${venues.length} restaurants: ${posted.read} sites read, ${report.couldNotRead.length} couldn't be read.`,
  "",
  `**Prices:** every price and happy-hour time we show is still printed word for word at ${posted.confirmed.length} places.${stamp ? ` The site now says "Verified ${today}".` : only.length ? " (Partial run: the site's verified date only moves on a full run.)" : " Not enough sites were read, so the site's verified date was NOT moved."}`,
  "",
  `**Hours:** opening and closing times all found on the page at ${report.hoursOk.length} places.`,
  "",
  ...(posted.missing.length
    ? ["## Prices or happy-hour times no longer on the restaurant's page", "", "Check these and update src/deals.json:", "", ...posted.missing.map(({ venue, missing }) => `- ${line(venue)}: ${missing.join(", ")}`), ""]
    : []),
  ...(report.pageChanged.length
    ? ["## Pages that changed since the last check", "", ...report.pageChanged.map(({ venue, url }) => `- ${line(venue)}: [page](${url})`), ""]
    : []),
  ...(report.couldNotRead.length ? ["## Couldn't read (data left as it was)", "", ...report.couldNotRead.map(({ venue, why }) => `- ${line(venue)}: ${why}`), ""] : []),
  ...(report.hoursMissing.length
    ? ["<details><summary>Hours we show that weren't found on the page (often just written differently)</summary>", "", ...report.hoursMissing.map(({ venue, missing }) => `- ${venue.name}: ${missing.join(", ")}`), "", "</details>", ""]
    : []),
].join("\n")

console.log(md)
if (process.env.GITHUB_STEP_SUMMARY) await fs.appendFile(process.env.GITHUB_STEP_SUMMARY, md + "\n")
if (!dryRun) {
  await fs.writeFile(dataFile, JSON.stringify(data, null, 2) + "\n")
  await fs.mkdir(path.dirname(stateFile), { recursive: true })
  await fs.writeFile(stateFile, JSON.stringify(state, null, 2) + "\n")
  await fs.writeFile(reportFile, md + "\n")
}
// One line for the commit message.
const summary = `data: daily check ${today} · ${posted.confirmed.length} prices confirmed · ${posted.missing.length} to look at · ${report.couldNotRead.length} unread`
if (process.env.GITHUB_OUTPUT) await fs.appendFile(process.env.GITHUB_OUTPUT, `summary=${summary}\nchanged=${posted.missing.length}\n`)
