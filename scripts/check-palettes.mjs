#!/usr/bin/env node
// Checks every palette in src/finder/finder.css against WCAG contrast targets.
// Run: pnpm check-palettes   (fails if any pair misses its target)
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const css = fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "src", "finder", "finder.css"), "utf8")

// Collect palettes: the default `.mf {` block that sets --bg, then each `.mf[data-palette='x'] {` block.
const blocks = [...css.matchAll(/\.mf(?:\[data-palette='([\w-]+)'\])?\s*\{([^}]*--bg:[^}]*)\}/g)]
const palettes = blocks.map(([, id, body]) => {
  const vars = Object.fromEntries([...body.matchAll(/--([\w-]+):\s*(#[0-9a-f]{6})/gi)].map((m) => [m[1], m[2]]))
  return { id: id ?? "mardi-gras (default)", vars }
})

const lum = (hex) => {
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((x) => (x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4))
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]
}
const ratio = (a, b) => {
  const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m)
  return (x + 0.05) / (y + 0.05)
}

// [foreground, background, minimum ratio, where it's used]
const PAIRS = [
  ["ink", "bg", 7, "body text on the page"],
  ["ink", "surface", 7, "text on cards"],
  ["muted", "surface", 7, "secondary text on cards"],
  ["muted", "bg", 7, "secondary text on the page"],
  ["#ffffff", "primary", 7, "white text on buttons"],
  ["primary", "surface", 7, "links and outline buttons"],
  ["ink", "highlight", 7, "happy hour tags"],
  ["#ffffff", "accent", 4.5, "price tags (large bold text)"],
  ["open", "surface", 4.5, "'Open now' (bold)"],
]

let failed = 0
for (const p of palettes) {
  const results = PAIRS.map(([fg, bg, min, use]) => {
    const r = ratio(p.vars[fg] ?? fg, p.vars[bg] ?? bg)
    if (r < min) failed++
    return `${r < min ? "✗" : "✓"} ${r.toFixed(1)}:1 ${use}${r < min ? ` (needs ${min})` : ""}`
  })
  console.log(`\n${p.id}\n  ${results.join("\n  ")}`)
}
console.log(failed ? `\n${failed} pair(s) below target` : `\nAll ${palettes.length} palettes pass.`)
process.exit(failed ? 1 : 0)
