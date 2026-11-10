#!/usr/bin/env node
// Daily restaurant check — run by .github/workflows/daily-restaurant-check.yml at 9am New Orleans time,
// or by hand:  node scripts/check-restaurants.mjs [venue-id ...]   (add --dry-run to change nothing)
//
// For every restaurant in src/deals.json it:
//   1. reads the restaurant's OWN website (menus, happy hour pages, menu PDFs) in a headless browser;
//   2. skips the AI step if those pages haven't changed since the last good read (free, and re-confirms the data);
//   3. otherwise asks an AI model to pull out oyster dishes + prices, happy hour, hours and address,
//      each with the exact words it read them from;
//   4. keeps a value only if those exact words are on the restaurant's page (see restaurant-check/lib.mjs);
//   5. updates src/deals.json and writes a plain-language report to data/last-check.md.
// It never removes a restaurant: "closing" notices are reported for a human to act on.

import fs from "node:fs/promises"
import path from "node:path"
import crypto from "node:crypto"
import { fileURLToPath } from "node:url"
import { readSite, launch, launchHttp1 } from "./restaurant-check/pages.mjs"
import { extract, provider, textBudget } from "./restaurant-check/ai.mjs"
import { verifyExtraction, applyResult, relevantText, oldestVerified } from "./restaurant-check/lib.mjs"

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

const report = { changed: [], confirmed: [], unchanged: [], couldNotRead: [], rejected: [], needsHuman: [], aiSkipped: [] }
let aiDown = null
const browser = await launch()
let http1 = null

async function checkVenue(venue) {
  let site = await readSite(browser, venue)
  if (!site.pages.length && site.problems.some((p) => /ERR_HTTP2|ERR_EMPTY_RESPONSE|ERR_CONNECTION_CLOSED/.test(p))) {
    http1 ??= await launchHttp1()
    site = await readSite(http1, venue)
  }
  const pages = site.pages.map((p) => ({ url: p.url, text: relevantText(p.text, 20000) })).filter((p) => p.text.length > 40)
  if (!pages.length) {
    report.couldNotRead.push({ venue, why: site.problems.join("; ") || "no readable text on its site" })
    return venue
  }
  const hash = crypto.createHash("sha256").update(pages.map((p) => p.url + "\n" + p.text).join("\n")).digest("hex").slice(0, 16)
  const prev = state[venue.id]

  // Same pages as last time: nothing to re-read, and what we read then still holds.
  if (prev?.hash === hash && prev.ok) {
    state[venue.id] = { ...prev, checked: today }
    if (prev.confirmed) {
      report.unchanged.push(venue)
      return { ...venue, verified: today }
    }
    report.unchanged.push(venue)
    return venue
  }

  // Fit the request: split the budget across pages, most useful (most prices) first.
  const budget = textBudget()
  const ranked = [...pages].sort((a, b) => (b.text.match(/\$|\d+\.\d{2}/g)?.length ?? 0) - (a.text.match(/\$|\d+\.\d{2}/g)?.length ?? 0))
  const share = Math.floor(budget / ranked.length)
  const sent = ranked.map((p) => ({ url: p.url, text: p.text.slice(0, Math.max(share, 2000)) }))
  let used = 0
  const fitted = sent.filter((p) => (used += p.text.length) <= budget)
  const fewPrices = fitted.reduce((n, p) => n + (p.text.match(/\$\s?\d/g)?.length ?? 0), 0) < 3

  if (aiDown) {
    report.aiSkipped.push(venue)
    return venue
  }
  let answer
  try {
    answer = await extract(venue, fitted)
  } catch (e) {
    // The AI service itself isn't working (no key, bad key, service off): stop asking, say so once.
    if (/unreadable reply|fetch failed|\b40[13]\b|ANTHROPIC_API_KEY/.test(e.message)) {
      aiDown = e.message
      report.aiSkipped.push(venue)
    } else report.couldNotRead.push({ venue, why: `AI reader failed: ${e.message}` })
    return venue
  }
  const { result, rejected } = verifyExtraction(answer, fitted)
  if (rejected.length) report.rejected.push({ venue, rejected })

  const { venue: updated, changes, confirmed, needsHuman } = applyResult(venue, result, today, fitted[0].url)
  if (needsHuman) report.needsHuman.push({ venue, why: needsHuman })
  if (changes.length) report.changed.push({ venue, changes })
  else if (confirmed) report.confirmed.push(venue)
  else if (fewPrices && site.images.length)
    report.couldNotRead.push({ venue, why: `its menu looks like a photo, which can't be checked word for word: ${site.images[0]}` })
  else report.couldNotRead.push({ venue, why: "its pages didn't show oyster prices or a happy hour the reader could prove" })

  state[venue.id] = { hash, checked: today, ok: true, confirmed }
  return updated
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

const line = (v) => `**${v.name}**`
const md = [
  `# Daily restaurant check: ${today}`,
  "",
  `Read each restaurant's own website with ${provider()}. ${venues.length} checked: ${report.changed.length} changed, ${report.confirmed.length + report.unchanged.length} confirmed, ${report.couldNotRead.length} couldn't be read${report.aiSkipped.length ? `, ${report.aiSkipped.length} waiting on the AI reader` : ""}.`,
  "",
  ...(aiDown
    ? [
        "## ⚠️ The AI reader isn't working, so prices weren't updated",
        "",
        process.env.ANTHROPIC_API_KEY
          ? `Claude refused the request (${aiDown.slice(0, 200)}). Check the ANTHROPIC_API_KEY secret is a valid, funded key.`
          : "No `ANTHROPIC_API_KEY` secret is set, and GitHub's free AI models aren't available on this account. Add the key: repository Settings → Secrets and variables → Actions → New repository secret → name `ANTHROPIC_API_KEY`.",
        "",
        `Restaurant sites read fine and were left untouched: ${report.aiSkipped.map((v) => v.name).sort().join(" · ")}`,
        "",
      ]
    : []),
  ...(report.changed.length
    ? ["## Changed", "", "| Restaurant | What | Was | Now | Proof |", "|---|---|---|---|---|", ...report.changed.flatMap(({ venue, changes }) => changes.map((c) => `| ${venue.name} | ${c.field} | ${String(c.was).slice(0, 160)} | ${String(c.now).slice(0, 160)} | ${c.proof ? `[page](${c.proof})` : ""} |`)), ""]
    : []),
  ...(report.needsHuman.length ? ["## Needs you", "", ...report.needsHuman.map(({ venue, why }) => `- ${line(venue)} ${why}`), ""] : []),
  ...(report.couldNotRead.length ? ["## Couldn't read (data left as it was)", "", ...report.couldNotRead.map(({ venue, why }) => `- ${line(venue)}: ${why}`), ""] : []),
  ...(report.confirmed.length || report.unchanged.length
    ? ["## Confirmed, no change", "", [...report.confirmed, ...report.unchanged].map((v) => v.name).sort().join(" · "), ""]
    : []),
  ...(report.rejected.length
    ? ["<details><summary>Values thrown out because their wording wasn't on the restaurant's page</summary>", "", ...report.rejected.map(({ venue, rejected }) => `- ${venue.name}: ${rejected.join("; ")}`), "", "</details>", ""]
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
const summary = `data: daily check ${today} · ${report.changed.length} changed · ${report.confirmed.length + report.unchanged.length} confirmed · ${report.couldNotRead.length} unread`
if (process.env.GITHUB_OUTPUT) await fs.appendFile(process.env.GITHUB_OUTPUT, `summary=${summary}\nchanged=${report.changed.length}\n`)
