#!/usr/bin/env node
// Contrast check for the colours in src/finder/finder.css (WCAG; AAA = 7:1 for text).
// Run: pnpm check-palettes   (fails if any pair misses its target)
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const css = fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "src", "finder", "finder.css"), "utf8")
const themes = {
  light: css.match(/\.mf\s*\{([^}]*--ink:[^}]*)\}/)[1],
  dark: css.match(/\.mf\[data-theme='dark'\]\s*\{([^}]*)\}/)[1],
}

const lum = (hex) => {
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((x) => (x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4))
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]
}
const ratio = (a, b) => {
  const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m)
  return (x + 0.05) / (y + 0.05)
}

let failed = 0
for (const [theme, block] of Object.entries(themes)) {
  const vars = Object.fromEntries([...block.matchAll(/--([\w-]+):\s*(#[0-9a-f]{6})/gi)].map((m) => [m[1], m[2]]))
  const foil = [...block.match(/--foil:[^;]*;/)[0].matchAll(/#[0-9a-f]{6}/gi)].map((m) => m[0])
  const PAIRS = [
    ["ink", "bg", 7, "headings on the page"],
    ["ink", "paper", 7, "text on cards"],
    ["muted", "paper", 7, "secondary text on cards"],
    ["muted", "bg", 7, "secondary text on the page"],
    ["on-ink", "ink", 7, "text on solid buttons and price tags"],
    ["open", "paper", 7, "'Open now'"],
    ["ink", "shell", 7, "labels on the shell map"],
    ["ink", "water", 7, "labels on the river and lake"],
    ...foil.map((c) => ["ink", c, 7, `text on prism foil ${c}`]),
  ]
  console.log(`\n${theme}`)
  for (const [fg, bg, min, use] of PAIRS) {
    const r = ratio(vars[fg] ?? fg, vars[bg] ?? bg)
    if (r < min) failed++
    console.log(`${r < min ? "✗" : "✓"} ${r.toFixed(1)}:1 ${use}${r < min ? ` (needs ${min})` : ""}`)
  }
}
console.log(failed ? `\n${failed} pair(s) below target` : "\nAll colours pass in light and dark.")
process.exit(failed ? 1 : 0)
