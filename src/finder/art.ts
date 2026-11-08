// Hand-drawn oyster illustrations, as inline SVG strings.
//
// How they look hand-made:
//  - every ink line runs through the shared "mf-rough" filter (see RoughFilter in OysterFinder),
//    which wobbles strokes like a dip pen;
//  - outlines are drawn twice, slightly offset (a sketchy double pass);
//  - each piece sits on a riso "plate" fill that is misregistered a few units off the ink.
//
// All pieces share the 60 × 44 drawing space so they can be swapped freely.

const ink = (paths: string) => `<g class="a-ink" filter="url(#mf-rough)">${paths}</g>`

/** Ruffled, teardrop half shell with the oyster in it. Used for map markers and cards. */
const HALF_SHELL_SHAPE =
  "M4 26C8 20 12 15 18 12q3-3 6-2q3-3 7-1q4-3 7 0q4-2 7 1q4 0 6 4q4 2 3 6q3 3 0 7q1 4-4 5q-1 4-6 3q-3 3-7 1q-3 3-7 0q-4 2-7-1q-4 1-6-3C12 31 7 29 4 26z"

const halfShellBody = () => `
  <path class="a-plate" d="${HALF_SHELL_SHAPE}" transform="translate(2.4 2.2)"/>
  <path class="a-shell" d="${HALF_SHELL_SHAPE}"/>
  <path class="a-cup" d="M10 26c4-8 14-12 24-12s16 5 16 11-6 8-16 8c-10 0-20-2-24-7z"/>
  <path class="a-meat" d="M16 25c3-6 12-8 19-8 8 0 12 4 12 8s-5 6-12 6c-8 0-16-2-19-6z"/>
  ${ink(`
    <path class="a-line" d="${HALF_SHELL_SHAPE}"/>
    <path class="a-line a-ghost" d="${HALF_SHELL_SHAPE}" transform="translate(.6 -.5) rotate(.6 30 24)"/>
    <path class="a-thin" d="M10 20C16 13 26 10 36 11c8 0 14 3 16 8M12 31c8 5 20 6 30 4 5-1 8-4 10-7M8 24c1-3 3-5 5-7"/>
    <path class="a-hatch" d="M14 33l2-3M17 34.5l2-3M20 35.5l2-3M23 36.2l2-3M26 36.8l2-3M29 37l2-3M8 29l2-2.5M6 25l2.6-1.4M45 35l1.6-2.6M48 33l1.4-2.4"/>
    <path class="a-thin" d="M10 26c4-8 14-12 24-12s16 5 16 11-6 8-16 8c-10 0-20-2-24-7z"/>
    <path class="a-frill" d="M17 25q2-3 4-3q2-3 5-3q3-2 6-1q3-1 6 0q3 0 5 2q3 1 3 4q1 3-2 4q-2 2-5 2q-3 2-6 1q-3 1-6 0q-3 0-5-2q-3 0-5-4"/>
    <path class="a-thin a-gill" d="M21 26c6-3 13-4 22-2M24 28c5-1 11-1 17 0"/>
  `)}
  <ellipse class="a-belly" cx="38" cy="25" rx="3.2" ry="2.3"/>
  <ellipse class="a-glint" cx="29" cy="20.5" rx="2.4" ry="1" transform="rotate(-12 29 20.5)"/>`

export const halfShell = (cls = "") =>
  `<svg class="mf-art mf-half ${cls}" viewBox="-2 2 66 44" aria-hidden="true">${halfShellBody()}</svg>`

/** A pile of two half shells, for map clusters. */
export const shellPile = (cls = "") =>
  `<svg class="mf-art mf-pile ${cls}" viewBox="-4 0 74 54" aria-hidden="true"><g transform="translate(6 9) rotate(12 30 24)">${halfShellBody()}</g><g transform="rotate(-8 30 24)">${halfShellBody()}</g></svg>`

/** A whole, closed oyster: craggy layered shell, lips shut. The oracle and the card lid. */
const CLOSED_SHAPE = "M5 25C4 14 17 6 33 6c14 0 23 7 22 17-1 10-11 17-26 17C15 40 6 34 5 25z"

export const closedTop = () => `
  <path class="a-plate" d="M5 25C4 14 17 6 33 6c14 0 23 7 22 17q-5 2-10 0q-5 2-10 0q-5 2-10 0q-5 2-9-1q-4 2-8-1z" transform="translate(2.4 -2)"/>
  <path class="a-shell" d="M5 25C4 14 17 6 33 6c14 0 23 7 22 17q-5 2-10 0q-5 2-10 0q-5 2-10 0q-5 2-9-1q-4 2-8-1z"/>
  ${ink(`
    <path class="a-line" d="M5 25C4 14 17 6 33 6c14 0 23 7 22 17"/>
    <path class="a-line a-ghost" d="M5.6 24.4C5 14 17.4 6.6 33 6.6c13.4 0 22 6.6 21.4 16"/>
    <path class="a-thin" d="M10 21c4-7 13-11 23-11 10 0 16 4 18 9M15 19c5-4 11-6 18-6 7 0 12 2 15 5M21 16c4-1 8-2 12-2"/>
    <path class="a-hatch" d="M9 15l2 3M13 11l1.6 3M18 9l1.2 3M44 9l-1 3M49 12l-1.6 2.6M53 16l-2 2"/>
    <path class="a-lip" d="M5 25q4 2 8-1q4 3 9 1q5 2 10 0q5 2 10 0q5 2 10 0q2-1 3-2"/>
  `)}`

export const closedBottom = () => `
  <path class="a-plate" d="M5 25q4 2 8-1q4 3 9 1q5 2 10 0q5 2 10 0q5 2 10 0q2-1 3-2c-1 10-11 17-26 17C15 40 6 34 5 25z" transform="translate(2.4 2)"/>
  <path class="a-shell" d="M5 25q4 2 8-1q4 3 9 1q5 2 10 0q5 2 10 0q5 2 10 0q2-1 3-2c-1 10-11 17-26 17C15 40 6 34 5 25z"/>
  ${ink(`
    <path class="a-line" d="M55 23c-1 10-11 17-26 17C15 40 6 34 5 25"/>
    <path class="a-line a-ghost" d="M54.4 23.6c-1 9.4-10.6 16-25.4 16C15.6 39.6 6.6 33.6 5.6 25.6"/>
    <path class="a-thin" d="M9 30c5 5 13 7 22 7 10 0 18-3 22-9M14 34c5 2 11 3 17 3"/>
    <path class="a-hatch" d="M11 33l1.4 3M16 36l1 3M22 37.6l.6 2.6M38 38l-.6 2.4M44 36l-1 2.6M49 33l-1.6 2.4"/>
  `)}`

export const closedOyster = (cls = "") =>
  `<svg class="mf-art mf-closed ${cls}" viewBox="0 0 60 44" aria-hidden="true"><g class="a-bottom">${closedBottom()}</g><g class="a-top">${closedTop()}</g></svg>`

/** The pearl inside the oracle: a surreal pearl with an eye. */
export const pearlEye = () => `
  <g class="a-pearl">
    <circle class="a-pearl-ball" cx="30" cy="24" r="7.5"/>
    <path class="a-pearl-lid" d="M24 24c3-4 9-4 12 0-3 4-9 4-12 0z"/>
    <circle class="a-pearl-iris" cx="30" cy="24" r="2.6"/>
    <circle class="a-pearl-pupil" cx="30" cy="24" r="1.1"/>
    ${ink(`<circle class="a-thin" cx="30" cy="24" r="7.5"/><path class="a-thin" d="M24 24c3-4 9-4 12 0-3 4-9 4-12 0z"/>`)}
    <circle class="a-glint" cx="27.4" cy="20.8" r="1.4"/>
  </g>`

/** The open bottom half used by the oracle once it's shucked: cup, meat and the pearl-eye. */
export const openBottom = () => `
  <path class="a-plate" d="${HALF_SHELL_SHAPE}" transform="translate(2.4 2.2)"/>
  <path class="a-shell" d="${HALF_SHELL_SHAPE}"/>
  <path class="a-cup" d="M10 26c4-8 14-12 24-12s16 5 16 11-6 8-16 8c-10 0-20-2-24-7z"/>
  ${ink(`<path class="a-line" d="${HALF_SHELL_SHAPE}"/><path class="a-thin" d="M10 26c4-8 14-12 24-12s16 5 16 11-6 8-16 8c-10 0-20-2-24-7z"/>`)}
  ${pearlEye()}`

/** A strip of torn masking tape. */
export const tape = (cls = "") =>
  `<svg class="mf-tape ${cls}" viewBox="0 0 100 24" preserveAspectRatio="none" aria-hidden="true"><path d="M2 3l4 2 3-3 5 2 4-1 6 2 5-2 6 2 5-1 6 1 5-2 6 2 5-1 6 2 5-2 6 1 5-1 6 2 5-1 4 1-2 4 3 4-2 3 2 4-3 3h-4l-5-2-6 2-5-1-6 1-5-1-6 2-5-2-6 1-5-1-6 2-5-1-6 1-5-2-4 1-4-2-3 1 2-4-3-3 3-4-2-4z"/></svg>`

/** Shared ink filter: makes every stroke wobble like it was drawn by hand. Render once per page. */
export const roughFilterSvg = `<svg width="0" height="0" style="position:absolute" aria-hidden="true" focusable="false">
  <filter id="mf-rough" x="-5%" y="-5%" width="110%" height="110%">
    <feTurbulence type="fractalNoise" baseFrequency="0.09" numOctaves="2" seed="7" result="n"/>
    <feDisplacementMap in="SourceGraphic" in2="n" scale="1.6" xChannelSelector="R" yChannelSelector="G"/>
  </filter>
</svg>`

/** Deterministic 0..1 from a string, so each venue keeps its own tilt and scrap. */
export function hash01(text: string) {
  let h = 2166136261
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619)
  return ((h >>> 0) % 10_000) / 10_000
}

/**
 * A torn-paper outline as a CSS clip-path: ragged top and bottom edges, slightly uneven sides.
 * Same seed, same tear, so cards don't change shape on every render.
 */
export function tornClip(seed: string, depth = 7) {
  let n = hash01(seed) * 1000
  const rnd = () => {
    n = (n * 9301 + 49297) % 233280
    return n / 233280
  }
  const pts: string[] = []
  const steps = 22
  for (let i = 0; i <= steps; i++) pts.push(`${((i / steps) * 100).toFixed(1)}% ${(rnd() * depth).toFixed(1)}px`)
  pts.push(`calc(100% - ${(rnd() * 3).toFixed(1)}px) 50%`)
  for (let i = steps; i >= 0; i--) pts.push(`${((i / steps) * 100).toFixed(1)}% calc(100% - ${(rnd() * depth).toFixed(1)}px)`)
  pts.push(`${(rnd() * 3).toFixed(1)}px 50%`)
  return `polygon(${pts.join(", ")})`
}
