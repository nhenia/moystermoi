#!/usr/bin/env node
// Moyster data refresh — run by .github/workflows/refresh-data.yml (weekly + on data edits),
// or locally with:  pnpm refresh-data
//
// What it does (and deliberately does NOT do):
//   1. Fills in missing map coordinates by geocoding each venue's street address
//      (US Census geocoder first, OpenStreetMap Nominatim as a fallback).
//   2. Checks that every venue's source link (menu / happy-hour page) still loads.
//   3. Writes the results back into src/deals.json and prints a short report.
//
//   It never changes names, prices, deals, days or times. Those are verified by a human,
//   and the "updated" date in deals.json only changes when a person re-checks them.

import fs from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const file = path.join(root, "src", "deals.json")
const UA = "Moyster/1.0 (oyster finder; weekly data refresh)"
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

// Rough box around Orleans Parish; anything outside is rejected as a bad geocode.
const inNola = (lat, lng) => lat > 29.85 && lat < 30.1 && lng > -90.15 && lng < -89.9

async function fetchJson(url, ms = 15000) {
  const res = await fetch(url, { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(ms) })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json()
}

async function census(address) {
  const url = `https://geocoding.geo.census.gov/geocoder/locations/onelineaddress?benchmark=Public_AR_Current&format=json&address=${encodeURIComponent(address)}`
  const match = (await fetchJson(url)).result?.addressMatches?.[0]
  return match ? { lat: match.coordinates.y, lng: match.coordinates.x, by: "census" } : null
}

async function nominatim(address) {
  const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=us&q=${encodeURIComponent(address)}`
  const hit = (await fetchJson(url))[0]
  await sleep(1100) // Nominatim policy: max 1 request per second
  return hit ? { lat: Number(hit.lat), lng: Number(hit.lon), by: "osm" } : null
}

async function geocode(address) {
  for (const provider of [census, nominatim]) {
    try {
      const hit = await provider(address)
      if (hit && inNola(hit.lat, hit.lng)) return hit
    } catch (error) {
      console.warn(`  ${provider.name} failed for "${address}": ${error.message}`)
    }
  }
  return null
}

async function linkWorks(url) {
  for (const method of ["HEAD", "GET"]) {
    try {
      const res = await fetch(url, {
        method,
        redirect: "follow",
        headers: { "User-Agent": UA },
        signal: AbortSignal.timeout(15000),
      })
      if (res.ok) return true
      // Some sites block HEAD or bots (403/405); try GET before giving up.
    } catch {
      /* try next method */
    }
  }
  return false
}

const round = (n) => Math.round(n * 1e5) / 1e5

const data = JSON.parse(await fs.readFile(file, "utf8"))
const report = { geocoded: [], unresolved: [], brokenLinks: [] }

for (const venue of data.venues) {
  if (typeof venue.lat !== "number" || typeof venue.lng !== "number") {
    const hit = await geocode(venue.address)
    if (hit) {
      venue.lat = round(hit.lat)
      venue.lng = round(hit.lng)
      venue.geocoded = hit.by
      report.geocoded.push(`${venue.name} (${hit.by})`)
    } else {
      report.unresolved.push(venue.name)
    }
  }
}

const linkResults = await Promise.all(data.venues.map(async (v) => [v, await linkWorks(v.source)]))
for (const [venue, ok] of linkResults) if (!ok) report.brokenLinks.push(venue.id)

data.checks = {
  ranAt: new Date().toISOString().slice(0, 10),
  brokenLinks: report.brokenLinks,
}

await fs.writeFile(file, `${JSON.stringify(data, null, 2)}\n`)

const lines = [
  "## Moyster data refresh",
  `- Prices last verified by a person: **${data.updated}**`,
  `- Newly mapped: ${report.geocoded.length ? report.geocoded.join(", ") : "none"}`,
  `- Could not map: ${report.unresolved.length ? report.unresolved.join(", ") : "none"}`,
  `- Source links not loading: ${report.brokenLinks.length ? report.brokenLinks.join(", ") : "none"}`,
]
console.log(lines.join("\n"))
if (process.env.GITHUB_STEP_SUMMARY) await fs.appendFile(process.env.GITHUB_STEP_SUMMARY, `${lines.join("\n")}\n`)
