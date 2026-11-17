#!/usr/bin/env node
// Weekly shell-giving check — run by .github/workflows/shell-giving-check.yml on Mondays at 9am
// New Orleans time, or by hand:  node scripts/check-shells.mjs [venue-id ...]   (add --dry-run to change nothing)
//
// No AI, no API keys. It answers: does this restaurant give its oyster shells back to the coast,
// or work with the charities that do?
//   1. Reads the Coalition to Restore Coastal Louisiana's (CRCL) list of shell-recycling restaurants.
//      A restaurant whose own address is on it gets the "gives its shells back" mark in the app;
//      one that has dropped off loses it. If the list can't be read, nothing changes.
//   2. Reads each restaurant's own website for any mention of shell recycling or coastal charities.
//      Those go in the report (with the words found) for a person to look at; they never change the app.
// The report is on the run page and in data/shell-check.md.

import fs from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { readSite, launch, launchHttp1 } from "./restaurant-check/pages.mjs"
import { CRCL_URL, onPartnerList, partnerListReadable, givingMentions, applyShells } from "./shell-check/lib.mjs"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const dataFile = path.join(root, "src", "deals.json")
const stateFile = path.join(root, "data", "shell-check.json")
const reportFile = path.join(root, "data", "shell-check.md")

const args = process.argv.slice(2)
const dryRun = args.includes("--dry-run")
const only = args.filter((a) => !a.startsWith("--"))
const today = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Chicago" }).format(new Date())

const data = JSON.parse(await fs.readFile(dataFile, "utf8"))
const venues = data.venues.filter((v) => !only.length || only.includes(v.id))
const browser = await launch()
let http1 = null

// 1. CRCL's partner list
async function readPartnerList() {
  const context = await browser.newContext()
  const page = await context.newPage()
  try {
    await page.goto(CRCL_URL, { waitUntil: "domcontentloaded", timeout: 45000 })
    await page.waitForLoadState("networkidle", { timeout: 10000 }).catch(() => {})
    return await page.evaluate(() => document.body?.innerText ?? "")
  } catch (e) {
    console.log(`Couldn't open ${CRCL_URL}: ${e.message.split("\n")[0]}`)
    return ""
  } finally {
    await context.close()
  }
}
const listText = await readPartnerList()
const listOk = partnerListReadable(listText)
const status = {}
const partnerWhy = {}
if (listOk) {
  for (const v of venues) {
    const r = onPartnerList(v, listText)
    status[v.id] = r.status
    partnerWhy[v.id] = r.why
  }
}

// 2. Each restaurant's own site
const mentions = {}
const unread = []
const queue = [...venues]
await Promise.all(
  Array.from({ length: 3 }, async () => {
    while (queue.length) {
      const v = queue.shift()
      try {
        let site = await readSite(browser, v)
        if (!site.pages.length && site.problems.some((p) => /ERR_HTTP2|ERR_EMPTY_RESPONSE|ERR_CONNECTION_CLOSED/.test(p))) {
          http1 ??= await launchHttp1()
          site = await readSite(http1, v)
        }
        if (!site.pages.length) unread.push({ v, why: site.problems.join("; ") || "no readable text" })
        const found = givingMentions(site.pages)
        if (found.length) mentions[v.id] = found
      } catch (e) {
        unread.push({ v, why: e.message.split("\n")[0] })
      }
      process.stdout.write(".")
    }
  }),
)
await browser.close()
await http1?.close()
console.log("")

const before = new Set(data.venues.filter((v) => v.shells).map((v) => v.id))
data.venues = applyShells(data.venues, status, today)
const after = new Set(data.venues.filter((v) => v.shells).map((v) => v.id))
const added = [...after].filter((id) => !before.has(id))
const dropped = [...before].filter((id) => !after.has(id) && id in status)
const nameOf = (id) => data.venues.find((v) => v.id === id)?.name ?? id
const ids = (pred) => venues.filter((v) => pred(status[v.id])).map((v) => v.id)

const md = [
  `# Shell-giving check: ${today}`,
  "",
  "Do these restaurants give their oyster shells back to the coast, or work with the charities that do? (No AI.)",
  "",
  listOk
    ? `**CRCL's shell-recycling list** ([read it](${CRCL_URL})): ${ids((s) => s === "partner").length} of our ${venues.length} restaurants are on it. The app shows them as giving their shells back.`
    : `**CRCL's shell-recycling list couldn't be read** (${CRCL_URL}). Nothing in the app was changed.`,
  "",
  ...(added.length ? ["## Newly on the list", "", ...added.map((id) => `- **${nameOf(id)}**`), ""] : []),
  ...(dropped.length ? ["## No longer on the list (mark removed)", "", ...dropped.map((id) => `- **${nameOf(id)}**`), ""] : []),
  ...(listOk ? ["## On the list", "", ...ids((s) => s === "partner").map((id) => `- ${nameOf(id)}${/we show/.test(partnerWhy[id]) ? ` (${partnerWhy[id]}: check the address)` : ""}`), ""] : []),
  ...(ids((s) => s === "other-location").length
    ? ["## Another branch is on the list, not this one", "", "Worth asking whether this location recycles too:", "", ...ids((s) => s === "other-location").map((id) => `- ${nameOf(id)}`), ""]
    : []),
  ...(Object.keys(mentions).length
    ? [
        "## Restaurants' own sites that mention shell recycling or coastal charities",
        "",
        "Read these by hand. The app doesn't change from them.",
        "",
        ...Object.entries(mentions).flatMap(([id, found]) => found.map((m) => `- **${nameOf(id)}**: "${m.words}" ([page](${m.url}))`)),
        "",
      ]
    : ["No restaurant's own site mentioned shell recycling or coastal charities this week.", ""]),
  ...(unread.length ? ["<details><summary>Sites that couldn't be read</summary>", "", ...unread.map(({ v, why }) => `- ${v.name}: ${why}`), "", "</details>", ""] : []),
].join("\n")

console.log(md)
if (process.env.GITHUB_STEP_SUMMARY) await fs.appendFile(process.env.GITHUB_STEP_SUMMARY, md + "\n")
if (!dryRun) {
  await fs.writeFile(dataFile, JSON.stringify(data, null, 2) + "\n")
  await fs.mkdir(path.dirname(stateFile), { recursive: true })
  await fs.writeFile(stateFile, JSON.stringify({ checked: today, listRead: listOk, status, mentions }, null, 2) + "\n")
  await fs.writeFile(reportFile, md + "\n")
}
const summary = `data: shell check ${today} · ${after.size} recycle with CRCL · ${added.length} new · ${dropped.length} dropped · ${Object.keys(mentions).length} site mentions`
if (process.env.GITHUB_OUTPUT) await fs.appendFile(process.env.GITHUB_OUTPUT, `summary=${summary}\n`)
// The list being unreadable is a failed check, so the run shows red and someone looks.
if (!listOk) process.exitCode = 1
