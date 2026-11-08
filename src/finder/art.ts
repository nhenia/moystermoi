// Engraved oyster illustrations, as inline SVG strings.
//
// The look is a 19th-century wood/steel engraving: black ink on cream, contour lines that follow
// the shell, dense parallel hatching for shadow, and a shared "mf-rough" filter so every line has
// a slightly hand-cut wobble. Colour comes only from the page palette (a "plate" fill behind the ink),
// so the same drawings work in every palette.

const ink = (paths: string) => `<g class="a-ink" filter="url(#mf-rough)">${paths}</g>`

/** Ruffled teardrop half shell, drawn in a 60 × 44 space. */
const HALF_SHELL_SHAPE =
  "M4 26C8 20 12 15 18 12q3-3 6-2q3-3 7-1q4-3 7 0q4-2 7 1q4 0 6 4q4 2 3 6q3 3 0 7q1 4-4 5q-1 4-6 3q-3 3-7 1q-3 3-7 0q-4 2-7-1q-4 1-6-3C12 31 7 29 4 26z"
const CUP = "M10 26c4-8 14-12 24-12s16 5 16 11-6 8-16 8c-10 0-20-2-24-7z"

const halfShellBody = () => `
  <path class="a-plate" d="${HALF_SHELL_SHAPE}" transform="translate(1.6 1.6)"/>
  <path class="a-shell" d="${HALF_SHELL_SHAPE}"/>
  <path class="a-cup" d="${CUP}"/>
  <path class="a-meat" d="M16 25c3-6 12-8 19-8 8 0 12 4 12 8s-5 6-12 6c-8 0-16-2-19-6z"/>
  ${ink(`
    <path class="a-line" d="${HALF_SHELL_SHAPE}"/>
    <path class="a-thin" d="M8 23c3-6 8-10 14-12M10 20C16 13 26 10 36 11c8 0 14 3 16 8M12 31c8 5 20 6 30 4 5-1 8-4 10-7M9 28c8 6 22 9 34 6"/>
    <path class="a-hatch" d="M13 33l2-3M15.5 34l2-3M18 35l2-3M20.5 35.6l2-3M23 36.2l2-3M25.5 36.6l2-3M28 37l2-3M30.5 37l2-3M33 36.8l2-3M7 28l2-2.4M6 25.5l2.4-1.6M44 35.4l1.6-2.6M46.5 34l1.4-2.4M49 32l1.2-2.2"/>
    <path class="a-hatch" d="M20 11.5l1 2.6M24 10.4l.8 2.6M28 9.8l.6 2.6M32 9.6l.4 2.6M36 9.8l.2 2.6M40 10.4l-.2 2.6M44 11.6l-.6 2.4"/>
    <path class="a-thin" d="${CUP}"/>
    <path class="a-frill" d="M17 25q2-3 4-3q2-3 5-3q3-2 6-1q3-1 6 0q3 0 5 2q3 1 3 4q1 3-2 4q-2 2-5 2q-3 2-6 1q-3 1-6 0q-3 0-5-2q-3 0-5-4"/>
    <path class="a-hatch" d="M21 26c6-3 13-4 22-2M24 28c5-1 11-1 17 0M22 23.5c5-2 10-3 16-2"/>
  `)}
  <ellipse class="a-glint" cx="29" cy="20.5" rx="2.4" ry="1" transform="rotate(-12 29 20.5)"/>`

export const halfShell = (cls = "") =>
  `<svg class="mf-art mf-half ${cls}" viewBox="-2 2 66 44" aria-hidden="true">${halfShellBody()}</svg>`

/** Two half shells, for map clusters. */
export const shellPile = (cls = "") =>
  `<svg class="mf-art mf-pile ${cls}" viewBox="-4 0 74 54" aria-hidden="true"><g transform="translate(6 9) rotate(12 30 24)">${halfShellBody()}</g><g transform="rotate(-8 30 24)">${halfShellBody()}</g></svg>`

/** Top valve of a closed, craggy oyster (the lid that lifts when a card opens, and the oracle's lid). */
export const closedTop = () => `
  <path class="a-plate" d="M5 25C4 14 17 6 33 6c14 0 23 7 22 17q-5 2-10 0q-5 2-10 0q-5 2-10 0q-5 2-9-1q-4 2-8-1z" transform="translate(1.6 -1.4)"/>
  <path class="a-shell" d="M5 25C4 14 17 6 33 6c14 0 23 7 22 17q-5 2-10 0q-5 2-10 0q-5 2-10 0q-5 2-9-1q-4 2-8-1z"/>
  ${ink(`
    <path class="a-line" d="M5 25C4 14 17 6 33 6c14 0 23 7 22 17"/>
    <path class="a-thin" d="M8 22c3-8 13-13 25-13 11 0 18 4 20 10M11 20c4-6 12-9 22-9 9 0 14 3 17 7M15 18c4-3 10-5 18-5 6 0 11 2 14 4M21 15c4-1 8-1 12-1"/>
    <path class="a-hatch" d="M8 17l2 3M11 13l1.8 3M15 10.5l1.4 3M19 8.6l1.2 3M23 7.4l.8 3M44 8.6l-1 3M48 10.6l-1.4 2.8M51 13.4l-1.8 2.6M54 17l-2 2"/>
    <path class="a-lip" d="M5 25q4 2 8-1q4 3 9 1q5 2 10 0q5 2 10 0q5 2 10 0q2-1 3-2"/>
  `)}`

export const closedBottom = () => `
  <path class="a-plate" d="M5 25q4 2 8-1q4 3 9 1q5 2 10 0q5 2 10 0q5 2 10 0q2-1 3-2c-1 10-11 17-26 17C15 40 6 34 5 25z" transform="translate(1.6 1.6)"/>
  <path class="a-shell" d="M5 25q4 2 8-1q4 3 9 1q5 2 10 0q5 2 10 0q5 2 10 0q2-1 3-2c-1 10-11 17-26 17C15 40 6 34 5 25z"/>
  ${ink(`
    <path class="a-line" d="M55 23c-1 10-11 17-26 17C15 40 6 34 5 25"/>
    <path class="a-thin" d="M9 30c5 5 13 7 22 7 10 0 18-3 22-9M13 33c5 3 11 4 18 4 7 0 13-2 17-5"/>
    <path class="a-hatch" d="M10 32l1.4 3M13 34.4l1.2 3M16.5 36l1 3M20 37.2l.8 2.8M24 38l.4 2.6M36 38l-.4 2.6M40 37l-.8 2.8M44 35.4l-1 2.8M48 33l-1.4 2.6M51 30l-1.6 2.4"/>
  `)}`

/** The open bottom half with a pearl that is an eye — revealed when the oracle is shucked. */
export const openBottom = () => `
  <path class="a-plate" d="${HALF_SHELL_SHAPE}" transform="translate(1.6 1.6)"/>
  <path class="a-shell" d="${HALF_SHELL_SHAPE}"/>
  <path class="a-cup" d="${CUP}"/>
  ${ink(`<path class="a-line" d="${HALF_SHELL_SHAPE}"/><path class="a-thin" d="${CUP}"/>`)}
  <g class="a-pearl">
    <circle class="a-pearl-ball" cx="30" cy="24" r="7.5"/>
    <path class="a-eye-white" d="M24 24c3-4 9-4 12 0-3 4-9 4-12 0z"/>
    <circle class="a-iris" cx="30" cy="24" r="2.6"/>
    <circle class="a-pupil" cx="30" cy="24" r="1.1"/>
    ${ink(`<circle class="a-thin" cx="30" cy="24" r="7.5"/><path class="a-thin" d="M24 24c3-4 9-4 12 0-3 4-9 4-12 0z"/>`)}
    <circle class="a-glint" cx="27.4" cy="20.8" r="1.4"/>
  </g>`

/**
 * The hero: a craggy closed oyster with a human eye looking out through the gap.
 * 120 × 84 space; the sunburst behind it is drawn in the palette's highlight colour.
 */
export const eyeOyster = (cls = "") => {
  const rays = Array.from({ length: 22 }, (_, i) => {
    const a = (i / 22) * Math.PI * 2
    const r1 = 30
    const r2 = i % 2 ? 50 : 58
    return `M${(60 + Math.cos(a) * r1).toFixed(1)} ${(44 + Math.sin(a) * r1 * 0.72).toFixed(1)}L${(60 + Math.cos(a) * r2).toFixed(1)} ${(44 + Math.sin(a) * r2 * 0.72).toFixed(1)}`
  }).join("")
  // Contour rings for each valve
  const top = "M10 44C8 26 30 10 58 9c26-1 48 12 50 30-6 3-12 1-18 3-8-5-18-8-30-8s-22 3-30 8c-7-1-13 2-20 2z"
  const bottom = "M10 44c7 0 13-3 20-2 8 6 18 9 30 9s22-3 30-9c6 2 12 0 18 3-4 18-26 31-50 31C34 76 12 64 10 44z"
  return `<svg class="mf-art mf-eye-oyster ${cls}" viewBox="0 0 120 88" aria-hidden="true">
  <path class="a-rays" d="${rays}"/>
  <path class="a-plate" d="${top}" transform="translate(2 -2)"/>
  <path class="a-plate" d="${bottom}" transform="translate(2 2)"/>
  <path class="a-shell" d="${top}"/>
  <path class="a-shell" d="${bottom}"/>
  <path class="a-cup" d="M30 42c8-5 18-8 30-8s22 3 30 8c-8 6-18 9-30 9s-22-3-30-9z"/>
  <path class="a-eye-white" d="M33 42.5c8-6 18-8.5 27-8.5s19 2.5 27 8.5c-8 5-18 7.5-27 7.5s-19-2.5-27-7.5z"/>
  <circle class="a-iris" cx="60" cy="42" r="8.4"/>
  <circle class="a-pupil" cx="60" cy="42" r="3.6"/>
  ${ink(`
    <path class="a-line" d="${top}"/>
    <path class="a-line" d="${bottom}"/>
    <path class="a-thin" d="M16 38c4-14 22-23 42-24 20-1 36 8 42 21M22 34c6-10 19-16 36-17 16-1 29 6 35 15M28 31c7-7 17-10 30-11 12 0 22 3 28 9M36 27c6-3 13-5 22-5s16 2 21 4"/>
    <path class="a-thin" d="M16 52c6 11 22 18 42 18 19 0 34-6 42-17M22 55c7 8 20 12 36 12 15 0 28-4 35-11M30 58c8 5 17 7 28 7s20-2 27-6"/>
    <path class="a-hatch" d="M14 30l3 4M18 25l2.6 3.6M23 21l2.2 3.4M28 17.6l1.8 3.4M33 15.2l1.4 3.2M38 13.4l1 3.2M84 13.6l-1 3.2M89 15.6l-1.4 3.2M94 18.4l-1.8 3.2M98 22l-2.2 3.2M102 26.4l-2.6 3M105 31l-3 2.6"/>
    <path class="a-hatch" d="M14 58l3-3M18 62l2.6-3.2M23 66l2.2-3.4M28 69l1.8-3.4M33 71.4l1.4-3.4M39 73l1-3.4M45 74l.6-3.4M51 74.6l.4-3.4M57 75l.2-3.4M63 75l-.2-3.4M69 74.6l-.4-3.4M75 74l-.6-3.4M81 72.6l-1-3.2M87 70.4l-1.4-3.2M92 67.4l-1.8-3.2M97 63.6l-2.2-3M101 59l-2.6-2.6"/>
    <path class="a-lip" d="M10 44c7 0 13-3 20-2M90 42c6 2 12 0 18 3"/>
    <path class="a-line" d="M33 42.5c8-6 18-8.5 27-8.5s19 2.5 27 8.5c-8 5-18 7.5-27 7.5s-19-2.5-27-7.5z"/>
    <path class="a-thin" d="M30 39c9-8 19-11 30-11s21 3 30 11"/>
    <path class="a-lash" d="M38 38.6l-2.4-4M43 36.4l-1.6-4.2M48.5 35l-.8-4.4M54 34.2l-.2-4.4M60 34l.2-4.4M66 34.2l.6-4.4M71.5 35l1.2-4.2M77 36.4l1.8-4M82 38.6l2.4-3.8"/>
    <circle class="a-thin" cx="60" cy="42" r="8.4"/>
    <path class="a-hatch" d="M60 33.6v3.4M66 36l-2.4 2.4M68.4 42H65M66 48l-2.4-2.4M60 50.4V47M54 48l2.4-2.4M51.6 42H55M54 36l2.4 2.4M63.2 34.2l-1.2 3.2M67.6 38.8l-3 1.4M67.6 45.2l-3-1.4M63.2 49.8l-1.2-3.2M56.8 49.8l1.2-3.2M52.4 45.2l3-1.4M52.4 38.8l3 1.4M56.8 34.2l1.2 3.2"/>
  `)}
  <circle class="a-glint" cx="57" cy="39" r="2"/>
</svg>`
}

/** Shared ink filter: makes every stroke wobble like an engraver's line. Render once per page. */
export const roughFilterSvg = `<svg width="0" height="0" style="position:absolute" aria-hidden="true" focusable="false">
  <filter id="mf-rough" x="-5%" y="-5%" width="110%" height="110%">
    <feTurbulence type="fractalNoise" baseFrequency="0.09" numOctaves="2" seed="7" result="n"/>
    <feDisplacementMap in="SourceGraphic" in2="n" scale="1.2" xChannelSelector="R" yChannelSelector="G"/>
  </filter>
</svg>`

/** Deterministic 0..1 from a string, so each venue keeps its own tilt. */
export function hash01(text: string) {
  let h = 2166136261
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619)
  return ((h >>> 0) % 10_000) / 10_000
}
