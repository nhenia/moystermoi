/**
 * Plate I — New Orleans read as an oyster shell.
 * A naturalist engraving: the shell's growth rings double as contour lines, the Mississippi
 * crescent cuts across the lip, Lake Pontchartrain is hatched water at the hinge, and every
 * oyster bar in the guide sits on it as a seed pearl at its real position.
 * Everything is drawn from code (deterministic), so it is crisp at any size and themeable.
 */

type Pt = [number, number]

function rng(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const f = (n: number) => n.toFixed(1)

/** Smooth open/closed curve through points (Catmull-Rom → cubic Bézier). */
function smooth(pts: Pt[], close = true) {
  const n = pts.length
  const at = (i: number) => (close ? pts[(i + n) % n] : pts[Math.max(0, Math.min(n - 1, i))])
  let d = `M${f(pts[0][0])} ${f(pts[0][1])}`
  const end = close ? n : n - 1
  for (let i = 0; i < end; i++) {
    const p0 = at(i - 1)
    const p1 = at(i)
    const p2 = at(i + 1)
    const p3 = at(i + 2)
    const c1: Pt = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6]
    const c2: Pt = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6]
    d += ` C${f(c1[0])} ${f(c1[1])} ${f(c2[0])} ${f(c2[1])} ${f(p2[0])} ${f(p2[1])}`
  }
  return close ? `${d} Z` : d
}

type ShellOpts = { cx: number; cy: number; rx: number; ry: number; seed: number; steps?: number }

/** An oyster outline: broad ruffled lip below, narrowing to the hinge (umbo) at the top. */
function shellOutline({ cx, cy, rx, ry, seed, steps = 96 }: ShellOpts, wobble = 1): Pt[] {
  const r = rng(seed)
  const ph = Array.from({ length: 5 }, () => r() * Math.PI * 2)
  const pts: Pt[] = []
  for (let i = 0; i < steps; i++) {
    const t = (i / steps) * Math.PI * 2 - Math.PI / 2
    const up = Math.max(0, -Math.sin(t))
    const narrow = 1 - 0.34 * up ** 1.4
    const n =
      1 +
      wobble *
        (0.045 * Math.sin(3 * t + ph[0]) +
          0.03 * Math.sin(5 * t + ph[1]) +
          0.018 * Math.sin(9 * t + ph[2]) +
          0.012 * Math.sin(17 * t + ph[3]) * (1 - up))
    pts.push([cx + rx * Math.cos(t) * narrow * n, cy + ry * Math.sin(t) * n])
  }
  return pts
}

// Map frame: these bounds are stretched over the shell.
const W = 320
const H = 380
const LNG0 = -90.158
const LNG1 = -89.992
const LAT0 = 30.074
const LAT1 = 29.892
export const project = (lng: number, lat: number): Pt => [26 + ((lng - LNG0) / (LNG1 - LNG0)) * 268, 26 + ((LAT0 - lat) / (LAT0 - LAT1)) * 340]

const RIVER: [number, number][] = [
  [-90.17, 29.956], [-90.148, 29.951], [-90.133, 29.943], [-90.124, 29.929], [-90.116, 29.918], [-90.101, 29.912],
  [-90.086, 29.913], [-90.075, 29.921], [-90.067, 29.934], [-90.062, 29.946], [-90.058, 29.955], [-90.051, 29.962],
  [-90.04, 29.965], [-90.028, 29.962], [-90.016, 29.953], [-90.006, 29.94], [-89.996, 29.925], [-89.98, 29.91],
]

const SHORE: [number, number][] = [
  [-90.175, 30.031], [-90.15, 30.03], [-90.13, 30.027], [-90.112, 30.029], [-90.098, 30.031], [-90.08, 30.03],
  [-90.06, 30.033], [-90.04, 30.035], [-90.02, 30.04], [-90.0, 30.048], [-89.98, 30.06],
]

const BAYOU: [number, number][] = [[-90.094, 30.03], [-90.092, 30.012], [-90.087, 29.998], [-90.09, 29.986], [-90.085, 29.976]]

export type Pearl = { lat: number; lng: number; live: boolean }

const BASE: ShellOpts = { cx: 160, cy: 205, rx: 138, ry: 168, seed: 7 }

let cached: { key: string; svg: string } | null = null

/** The shell itself: outline, growth rings (= contour lines, every fourth an index contour), ribs. */
function shellParts() {
  const outline = shellOutline(BASE)
  const outlineD = smooth(outline)
  const top = outline.reduce((a, b) => (b[1] < a[1] ? b : a))
  const umbo: Pt = [top[0], top[1] + 4]
  const r = rng(11)
  const rings: string[] = []
  for (let k = 1; k <= 13; k++) {
    const s = 1 - k * 0.068
    const ring = shellOutline({ ...BASE, seed: 7 + k * 13 }, 1 + k * 0.05).map(
      ([x, y]): Pt => [umbo[0] + (x - umbo[0]) * s, umbo[1] + (y - umbo[1]) * s * (1 - k * 0.004)],
    )
    rings.push(`<path class="${k % 4 === 0 ? "t-index" : "t-contour"}" d="${smooth(ring)}"/>`)
  }
  // Radial ribs from the hinge, faint, like the shell's plications.
  const ribs: string[] = []
  for (let i = 0; i < 28; i++) {
    const p = outline[Math.floor((i / 28) * outline.length + 2) % outline.length]
    const k = 0.62 + r() * 0.3
    ribs.push(`M${f(umbo[0] + (p[0] - umbo[0]) * 0.2)} ${f(umbo[1] + (p[1] - umbo[1]) * 0.2)} L${f(umbo[0] + (p[0] - umbo[0]) * k)} ${f(umbo[1] + (p[1] - umbo[1]) * k)}`)
  }
  return { outline, outlineD, top, umbo, rings, ribs, r }
}

/** Where the plate's 320×380 box sits on Earth (the inverse of `project`). */
export const PLATE_BOUNDS: [[number, number], [number, number]] = [
  [LAT0 - (((H - 26) / 340) * (LAT0 - LAT1)), LNG0 - (26 / 268) * (LNG1 - LNG0)], // south-west
  [LAT0 + (26 / 340) * (LAT0 - LAT1), LNG0 + ((W - 26) / 268) * (LNG1 - LNG0)], // north-east
]

/**
 * Plate I as a map overlay: the same shell, laid over the real street map at true scale, so the
 * growth rings run across the city as contour lines and the lip outlines it at low zoom.
 * Only the shell and its rings are drawn (no ribs, which would read as streets); the real map supplies
 * river, lake and streets. Lines keep a fixed
 * on-screen width at every zoom (non-scaling strokes), and nothing in it takes taps.
 */
export function topoOverlay(): string {
  const { outlineD, top, rings } = shellParts()
  return `<svg xmlns="http://www.w3.org/2000/svg" class="mf-topo mf-topo-overlay" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" aria-hidden="true" focusable="false">
<defs><clipPath id="o-clip"><path d="${outlineD}"/></clipPath></defs>
<path class="t-shell o-shell" d="${outlineD}"/>
<g clip-path="url(#o-clip)">
  <g class="t-rings">${rings.join("")}</g>
</g>
<path class="t-lip" d="${outlineD}"/>
<path class="t-hinge" d="M${f(top[0] - 13)} ${f(top[1] + 3)} Q${f(top[0])} ${f(top[1] - 10)} ${f(top[0] + 13)} ${f(top[1] + 3)} Q${f(top[0])} ${f(top[1] + 10)} ${f(top[0] - 13)} ${f(top[1] + 3)} Z"/>
</svg>`
}

/** The full plate. `pearls` are the oyster bars; live happy hours get the prism fill. */
export function topoShell(pearls: Pearl[]): string {
  const key = pearls.map((p) => `${p.lat},${p.lng},${p.live ? 1 : 0}`).join("|")
  if (cached?.key === key) return cached.svg

  const { outline, outlineD, top, umbo, rings, ribs, r } = shellParts()

  // Lake: hatched water north of the shoreline.
  const shore = SHORE.map(([lng, lat]) => project(lng, lat))
  const lakeD = `${smooth(shore, false)} L${W} 0 L0 0 Z`
  const hatch: string[] = []
  for (let y = 4; y < 80; y += 3.2) hatch.push(`M0 ${f(y)} h${W}`)

  // River: banks, then wavy current lines inside.
  const river = smooth(RIVER.map(([lng, lat]) => project(lng, lat)), false)
  const bayou = smooth(BAYOU.map(([lng, lat]) => project(lng, lat)), false)

  // French Quarter grid, set at the angle of the riverbank.
  const [qx, qy] = project(-90.0645, 29.9585)
  const grid: string[] = []
  for (let i = 0; i <= 7; i++) grid.push(`M${f(-21 + i * 6)} -10 v20`)
  for (let j = 0; j <= 4; j++) grid.push(`M-21 ${f(-10 + j * 5)} h42`)

  // Stipple along the lip.
  const dots: string[] = []
  for (let i = 0; i < 360; i++) {
    const p = outline[Math.floor(r() * outline.length)]
    const s = 0.86 + r() * 0.13
    dots.push(`<circle cx="${f(umbo[0] + (p[0] - umbo[0]) * s)}" cy="${f(umbo[1] + (p[1] - umbo[1]) * s)}" r="${(0.35 + r() * 0.6).toFixed(2)}"/>`)
  }

  const pearlsSvg = pearls
    .map((p) => {
      const [x, y] = project(p.lng, p.lat)
      return `<circle class="t-pearl${p.live ? " is-live" : ""}" cx="${f(x)}" cy="${f(y)}" r="${p.live ? 4.4 : 3.4}"/>`
    })
    .join("")

  const label = (x: number, y: number, text: string, cls = "t-label", rot = 0) =>
    `<text class="${cls}" x="${f(x)}" y="${f(y)}"${rot ? ` transform="rotate(${rot} ${f(x)} ${f(y)})"` : ""}>${text}</text>`

  const [ux, uy] = project(-90.112, 29.93)
  const [ax, ay] = project(-90.045, 29.94)
  const [gx, gy] = project(-90.06, 29.995)
  const [bx, by] = project(-90.104, 29.996)

  const svg = `<svg class="mf-topo" viewBox="0 0 ${W} ${H}" aria-hidden="true" focusable="false">
<defs>
  <clipPath id="t-clip"><path d="${outlineD}"/></clipPath>
  <path id="t-river-path" d="${river}"/>
</defs>
<path class="t-shell" d="${outlineD}"/>
<g clip-path="url(#t-clip)">
  <path class="t-lake" d="${lakeD}"/>
  <g class="t-hatch"><path d="${hatch.join(" ")}" clip-path="url(#t-lakeclip)"/></g>
  <g class="t-ribs"><path d="${ribs.join(" ")}"/></g>
  <g class="t-rings">${rings.join("")}</g>
  <path class="t-levee" d="${river}"/>
  <path class="t-river" d="${river}"/>
  <path class="t-current" d="${river}"/>
  <path class="t-bayou" d="${bayou}"/>
  <g class="t-grid" transform="translate(${f(qx)} ${f(qy)}) rotate(-38)"><path d="${grid.join(" ")}"/></g>
  <g class="t-stipple">${dots.join("")}</g>
  ${label(160, project(-90.09, 30.031)[1] - 7, "L. Pontchartrain", "t-label t-lake-label")}
  ${label(ux - 18, uy - 14, "Uptown")}
  ${label(ax - 2, ay + 22, "Algiers")}
  ${label(gx - 6, gy, "Gentilly")}
  ${label(bx - 46, by + 4, "B. St. John", "t-label t-small", -80)}
  ${label(qx - 34, qy - 24, "Vieux Carré")}
  <text class="t-label t-river-label"><textPath href="#t-river-path" startOffset="8%">Mississippi</textPath></text>
  ${pearlsSvg}
</g>
<path class="t-lip" d="${outlineD}"/>
<path class="t-hinge" d="M${f(top[0] - 13)} ${f(top[1] + 3)} Q${f(top[0])} ${f(top[1] - 10)} ${f(top[0] + 13)} ${f(top[1] + 3)} Q${f(top[0])} ${f(top[1] + 10)} ${f(top[0] - 13)} ${f(top[1] + 3)} Z"/>
<g class="t-compass" transform="translate(286 46)">
  <circle r="15"/><path d="M0 -22 L4 0 L0 22 L-4 0 Z"/><path class="t-compass-n" d="M0 -22 L4 0 L-4 0 Z"/>
  <text y="-26" text-anchor="middle">N</text>
</g>
<g class="t-scale" transform="translate(24 358)"><path d="M0 0 h48 M0 -4 v8 M24 -3 v6 M48 -4 v8"/><text x="0" y="16">1 mile</text></g>
<text class="t-plate" x="296" y="372" text-anchor="end">Pl. I</text>
</svg>`
  // The lake hatch needs its own clip (the lake shape) inside the shell clip.
  const out = svg.replace("<defs>", `<defs><clipPath id="t-lakeclip"><path d="${lakeD}"/></clipPath>`)
  cached = { key, svg: out }
  return out
}

/** The logotype's "o": the same shell in miniature, rings and river only. */
export function logoShell(): string {
  const opts: ShellOpts = { cx: 50, cy: 54, rx: 42, ry: 46, seed: 7, steps: 64 }
  const outline = smooth(shellOutline(opts))
  const pts = shellOutline(opts)
  const top = pts.reduce((a, b) => (b[1] < a[1] ? b : a))
  const umbo: Pt = [top[0], top[1] + 2]
  const rings: string[] = []
  for (let k = 1; k <= 5; k++) {
    const s = 1 - k * 0.15
    rings.push(smooth(shellOutline({ ...opts, seed: 7 + k * 13 }).map(([x, y]): Pt => [umbo[0] + (x - umbo[0]) * s, umbo[1] + (y - umbo[1]) * s])))
  }
  const river = smooth(
    RIVER.map(([lng, lat]) => {
      const [x, y] = project(lng, lat)
      return [8 + (x / W) * 84, 8 + (y / H) * 92] as Pt
    }),
    false,
  )
  return `<svg class="mf-logo-shell" viewBox="0 0 100 104" aria-hidden="true" focusable="false">
<defs><clipPath id="l-clip"><path d="${outline}"/></clipPath></defs>
<path class="t-shell" d="${outline}"/>
<g clip-path="url(#l-clip)">
  <g class="t-rings">${rings.map((d, i) => `<path class="${i === 2 ? "t-index" : "t-contour"}" d="${d}"/>`).join("")}</g>
  <path class="t-river l-river" d="${river}"/>
</g>
<path class="t-lip l-lip" d="${outline}"/>
<path class="t-hinge" d="M${f(top[0] - 8)} ${f(top[1] + 2)} Q${f(top[0])} ${f(top[1] - 6)} ${f(top[0] + 8)} ${f(top[1] + 2)} Q${f(top[0])} ${f(top[1] + 7)} ${f(top[0] - 8)} ${f(top[1] + 2)} Z"/>
</svg>`
}

