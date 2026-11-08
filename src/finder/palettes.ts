// New Orleans colour palettes. Every one passes WCAG AAA (7:1) for body text and buttons;
// see scripts/check-palettes.mjs. Preview any of them with ?palette=<id> in the address bar.

export type Palette = { id: string; name: string; story: string }

export const PALETTES: Palette[] = [
  { id: "mardi-gras", name: "Mardi Gras", story: "Purple, green and gold: justice, faith and power, since 1872." },
  { id: "streetcar", name: "Streetcar", story: "St. Charles line green, brass fittings and brick-red trim." },
  { id: "creole-cottage", name: "Creole Cottage", story: "Shutter teal, mustard and terracotta from Marigny shotguns." },
  { id: "gaslight", name: "Gaslight", story: "Oxblood doors, gas-lamp amber and courtyard moss in the Quarter." },
  { id: "sazerac", name: "Sazerac", story: "Peychaud's red, absinthe green and an old bottle-glass green." },
]

export const DEFAULT_PALETTE = "mardi-gras"

/** Palette from ?palette=…, remembered on this device; otherwise the default. */
export function choosePalette(): string {
  const valid = new Set(PALETTES.map((p) => p.id))
  try {
    const fromUrl = new URLSearchParams(window.location.search).get("palette")
    if (fromUrl && valid.has(fromUrl)) {
      localStorage.setItem("moyster-palette", fromUrl)
      return fromUrl
    }
    const saved = localStorage.getItem("moyster-palette")
    if (saved && valid.has(saved)) return saved
  } catch {
    /* storage blocked */
  }
  return DEFAULT_PALETTE
}
