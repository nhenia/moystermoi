import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import deals from "../deals.json"
import OysterMap from "./OysterMap"
import { closedBottom, closedTop, halfShell, hash01, openBottom, roughFilterSvg, tape, tornClip } from "./art"
import {
  DAY_NAMES,
  type Mode,
  type Ranked,
  type Venue,
  STALE_AFTER_DAYS,
  daysSince,
  drawOyster,
  enrich,
  formatDays,
  formatHappyHour,
  formatMoney,
  formatOpen,
  formatPrice,
  formatRange,
  formatWalk,
  nolaClock,
  pickThree,
  rank,
  walkingDirections,
} from "./logic"
import {
  type LocateError,
  type Origin,
  type Place,
  defaultOrigin,
  loadOrigin,
  locate,
  locateMessage,
  saveOrigin,
  searchPlaces,
} from "./location"
import "./finder.css"

const venues = deals.venues as Venue[]
const UPDATED = deals.updated

const MODES: { value: Mode; label: string }[] = [
  { value: "near", label: "Near me" },
  { value: "happy", label: "Happy hour" },
  { value: "cheap", label: "Cheapest" },
  { value: "map", label: "Map" },
]

const SAVED_KEY = "moyster-saved"

function readSaved(): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem(SAVED_KEY) ?? "[]") as string[])
  } catch {
    return new Set()
  }
}

const reducedMotion = () => typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches

/** Re-render every minute so "open" and "happy hour now" flip without a reload. */
function useMinuteClock() {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 60_000)
    const wake = () => document.visibilityState === "visible" && setNow(new Date())
    document.addEventListener("visibilitychange", wake)
    return () => {
      window.clearInterval(id)
      document.removeEventListener("visibilitychange", wake)
    }
  }, [])
  return now
}

/** "$10 / 6" plus "≈ $1.67 each" when it isn't already per oyster. */
function priceLine(r: Ranked) {
  const headline = formatPrice(r.venue)
  if (!headline) return null
  const per = r.perOyster != null && r.venue.unit !== "each" ? `≈ ${formatMoney(r.perOyster)} each` : ""
  return { headline, per }
}

const isClosed = (r: Ranked) => r.open.state === "opens" && r.hh.state !== "now"

export default function OysterFinder() {
  const now = useMinuteClock()
  const [origin, setOrigin] = useState<Origin>(() => loadOrigin() ?? defaultOrigin())
  const [locating, setLocating] = useState(false)
  const [locateError, setLocateError] = useState<LocateError | null>(null)
  const [searchOpen, setSearchOpen] = useState(false)
  const [mode, setMode] = useState<Mode>("near")
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [detailId, setDetailId] = useState<string | null>(null)
  const [saved, setSaved] = useState<Set<string>>(readSaved)
  const [toast, setToast] = useState("")
  const [shucking, setShucking] = useState(false)
  const rowRefs = useRef(new Map<string, HTMLElement>())
  const mapRef = useRef<HTMLDivElement>(null)

  const askForLocation = useCallback(async () => {
    setLocating(true)
    setLocateError(null)
    try {
      const here = await locate()
      setOrigin(here)
      saveOrigin(here)
      setSearchOpen(false)
    } catch (error) {
      setLocateError(error as LocateError)
      setSearchOpen(true)
    } finally {
      setLocating(false)
    }
  }, [])

  // Ask right away on first visit; results are already on screen from the French Quarter meanwhile.
  useEffect(() => {
    if (origin.source === "default") void askForLocation()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const chooseOrigin = (place: Origin) => {
    setOrigin(place)
    saveOrigin(place)
    setSearchOpen(false)
    setLocateError(null)
    setSelectedId(null)
  }

  const clock = useMemo(() => nolaClock(now), [now])
  const enriched = useMemo(() => enrich(venues, origin, clock), [origin, clock])
  const ranked = useMemo(() => rank(enriched, mode), [enriched, mode])
  const nearOrder = useMemo(() => rank(enriched, "near"), [enriched])
  const happyOrder = useMemo(() => rank(enriched, "happy"), [enriched])

  const live = enriched.filter((r) => r.hh.state === "now")
  const nextUp = happyOrder.find((r) => r.hh.state === "later") ?? happyOrder.find((r) => r.hh.state === "upcoming")

  const picks = mode === "map" ? [] : pickThree(ranked)
  const pickIds = new Set(picks.map((r) => r.venue.id))
  const rest = ranked.filter((r) => !pickIds.has(r.venue.id))
  const mapItems = mode === "near" || mode === "map" ? nearOrder : ranked
  const detail = detailId ? (enriched.find((r) => r.venue.id === detailId) ?? null) : null

  const age = daysSince(UPDATED, now)
  const stale = age > STALE_AFTER_DAYS

  const choose = (next: Mode) => {
    setMode(next)
    setSelectedId(null)
    if (next === "map") window.setTimeout(() => mapRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 60)
  }

  /** Tapping a restaurant anywhere (map oyster, card, list row) highlights it and opens its card. */
  const open = (id: string) => {
    setSelectedId(id)
    setDetailId(id)
  }

  const closeDetail = () => {
    const id = detailId
    setDetailId(null)
    // Leave the list where the visitor can see the spot they just looked at.
    if (id) window.setTimeout(() => rowRefs.current.get(id)?.scrollIntoView({ behavior: "smooth", block: "nearest" }), 50)
  }

  /** The experimental bit: shuck the oyster, it pulls a spot for you. */
  const shuck = () => {
    if (shucking) return
    const pick = drawOyster(enriched)
    if (!pick) return
    setShucking(true)
    window.setTimeout(
      () => {
        open(pick.venue.id)
        setShucking(false)
      },
      reducedMotion() ? 0 : 950,
    )
  }

  const toggleSaved = (id: string) =>
    setSaved((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      try {
        localStorage.setItem(SAVED_KEY, JSON.stringify([...next]))
      } catch {
        /* storage blocked: keep it for this visit */
      }
      return next
    })

  const flash = (message: string) => {
    setToast(message)
    window.setTimeout(() => setToast(""), 2400)
  }

  const share = async (r: Ranked) => {
    const v = r.venue
    const hh = v.start && v.end ? `${v.deal} · ${formatDays(v.days)} ${formatRange(v.start, v.end)}` : null
    const payload = { title: v.name, text: [v.name, v.address, hh].filter(Boolean).join("\n"), url: walkingDirections(v) }
    try {
      if (navigator.share) {
        await navigator.share(payload)
        return
      }
      await navigator.clipboard.writeText(`${payload.text}\n${payload.url}`)
      flash("Copied")
    } catch (error) {
      if ((error as DOMException)?.name !== "AbortError") flash("Couldn't share from this browser")
    }
  }

  useEffect(() => {
    if (!detailId) return
    const close = (e: KeyboardEvent) => e.key === "Escape" && closeDetail()
    window.addEventListener("keydown", close)
    return () => window.removeEventListener("keydown", close)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [detailId])

  return (
    <section className="mf" id="finder" aria-labelledby="mf-title">
      <span className="mf-defs" dangerouslySetInnerHTML={{ __html: roughFilterSvg }} />
      <div className="mf-scraps" aria-hidden="true">
        <i className="mf-scrap mf-scrap-news" />
        <i className="mf-scrap mf-scrap-kraft" />
        <i className="mf-scrap mf-scrap-dots" />
      </div>

      <header className="mf-head">
        <RansomTitle />
        <button
          type="button"
          className={`mf-oracle${shucking ? " is-shucking" : ""}`}
          onClick={shuck}
          aria-label="Shuck me: pick a spot for me"
        >
          <svg className="mf-art mf-oracle-art" viewBox="-2 0 64 46" aria-hidden="true">
            <g className="a-open" dangerouslySetInnerHTML={{ __html: openBottom() }} />
            <g className="a-closed" dangerouslySetInnerHTML={{ __html: closedBottom() }} />
            <g className="a-top" dangerouslySetInnerHTML={{ __html: closedTop() }} />
          </svg>
          <span className="mf-oracle-label">shuck me</span>
        </button>

        <div className="mf-origin" aria-live="polite">
          <strong>{locating ? "Finding you…" : origin.label}</strong>
          {origin.source !== "device" && !locating && (
            <button type="button" onClick={askForLocation}>
              Use my location
            </button>
          )}
          <button type="button" onClick={() => setSearchOpen((o) => !o)} aria-expanded={searchOpen}>
            {searchOpen ? "Close" : "Address"}
          </button>
        </div>
        {locateError && <p className="mf-alert">{locateMessage[locateError]}</p>}
        {searchOpen && <AddressSearch onPick={chooseOrigin} />}
      </header>

      <button
        type="button"
        className={`mf-hh${live.length ? " is-live" : ""}${mode === "happy" ? " is-active" : ""}`}
        onClick={() => choose("happy")}
      >
        {live.length ? (
          <>
            <b>Happy hour now</b>
            <span>{live.length}</span>
          </>
        ) : nextUp ? (
          <>
            <b>Next happy hour</b>
            <span>
              {nextUp.venue.name} · {formatHappyHour(nextUp.hh).replace("Happy hour ", "")}
            </span>
          </>
        ) : (
          <b>Happy hour</b>
        )}
        <i aria-hidden="true">→</i>
      </button>

      <div className="mf-modes" role="tablist" aria-label="Sort oyster spots">
        {MODES.map((m) => (
          <button
            key={m.value}
            type="button"
            role="tab"
            aria-selected={mode === m.value}
            className={`mf-mode mf-mode-${m.value}`}
            onClick={() => choose(m.value)}
          >
            {m.label}
          </button>
        ))}
      </div>

      {picks.length > 0 && (
        <ol className="mf-picks" aria-label="Top three picks">
          {picks.map((r, i) => (
            <PickCard
              key={`${mode}-${r.venue.id}`}
              r={r}
              index={i}
              selected={selectedId === r.venue.id}
              saved={saved.has(r.venue.id)}
              registerRef={(node) => (node ? rowRefs.current.set(r.venue.id, node) : rowRefs.current.delete(r.venue.id))}
              onOpen={() => open(r.venue.id)}
            />
          ))}
        </ol>
      )}

      <div ref={mapRef} className="mf-map-anchor">
        <OysterMap items={mapItems} origin={origin} selectedId={selectedId} onSelect={open} expanded={mode === "map"} />
      </div>

      {rest.length > 0 && (
        <ol className="mf-list" start={picks.length + 1} aria-label={picks.length ? "More spots" : "All spots"}>
          {rest.map((r, i) => (
            <Row
              key={r.venue.id}
              r={r}
              n={picks.length + i + 1}
              selected={selectedId === r.venue.id}
              saved={saved.has(r.venue.id)}
              registerRef={(node) => (node ? rowRefs.current.set(r.venue.id, node) : rowRefs.current.delete(r.venue.id))}
              onOpen={() => open(r.venue.id)}
            />
          ))}
        </ol>
      )}

      {stale && <p className="mf-fresh">Last checked {age} days ago. Call ahead.</p>}

      {mode !== "map" && !detail && (
        <button type="button" className="mf-fab" onClick={() => choose("map")} aria-label="Show map">
          <span aria-hidden="true" dangerouslySetInnerHTML={{ __html: halfShell() }} />
          Map
        </button>
      )}

      {detail && (
        <Detail
          key={detail.venue.id}
          r={detail}
          saved={saved.has(detail.venue.id)}
          onClose={closeDetail}
          onShare={() => share(detail)}
          onSave={() => toggleSaved(detail.venue.id)}
        />
      )}

      <p className="mf-toast" role="status" aria-live="polite" data-show={toast ? "true" : "false"}>
        {toast}
      </p>
    </section>
  )
}

// ---------- Pieces ----------

/** Ransom-note title: every letter cut from a different scrap of paper. */
function RansomTitle() {
  const words = ["OYSTERS", "NEAR ME"]
  let k = 0
  return (
    <h1 id="mf-title" className="mf-title" aria-label="Oysters near me">
      {words.map((word) => (
        <span className="mf-title-word" key={word} aria-hidden="true">
          {[...word].map((ch, i) => {
            if (ch === " ") return <span className="mf-gap" key={i} />
            const n = k++
            const tilt = ((hash01(`${word}${i}`) - 0.5) * 12).toFixed(1)
            return (
              <span key={i} className={`mf-cut mf-cut-${n % 6}`} style={{ "--t": `${tilt}deg`, "--d": `${n * 45}ms` } as React.CSSProperties}>
                {ch}
              </span>
            )
          })}
        </span>
      ))}
    </h1>
  )
}

function AddressSearch({ onPick }: { onPick: (p: Place) => void }) {
  const [q, setQ] = useState("")
  const [results, setResults] = useState<Place[]>([])
  const [state, setState] = useState<"idle" | "loading" | "error" | "empty">("idle")
  const input = useRef<HTMLInputElement>(null)

  useEffect(() => input.current?.focus(), [])

  useEffect(() => {
    if (q.trim().length < 3) {
      setResults([])
      setState("idle")
      return
    }
    const ctrl = new AbortController()
    const t = window.setTimeout(async () => {
      setState("loading")
      try {
        const found = await searchPlaces(q, ctrl.signal)
        setResults(found)
        setState(found.length ? "idle" : "empty")
      } catch (error) {
        if ((error as DOMException).name !== "AbortError") setState("error")
      }
    }, 280)
    return () => {
      ctrl.abort()
      window.clearTimeout(t)
    }
  }, [q])

  return (
    <form
      className="mf-search"
      role="search"
      onSubmit={(e) => {
        e.preventDefault()
        if (results[0]) onPick(results[0])
      }}
    >
      <input
        id="mf-address"
        ref={input}
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Address, hotel or landmark"
        aria-label="Address, hotel or landmark"
        autoComplete="street-address"
        enterKeyHint="search"
        aria-autocomplete="list"
        aria-controls="mf-address-results"
      />
      <ul id="mf-address-results" className="mf-search-results">
        {results.map((p, i) => (
          <li key={`${p.lat},${p.lng},${i}`}>
            <button type="button" onClick={() => onPick(p)}>
              <b>{p.label}</b>
              <small>{p.detail}</small>
            </button>
          </li>
        ))}
      </ul>
      {state === "loading" && <p className="mf-search-state">Searching…</p>}
      {state === "empty" && <p className="mf-search-state">No match.</p>}
      {state === "error" && <p className="mf-search-state">Address search is down. Try again.</p>}
    </form>
  )
}

type CardProps = {
  r: Ranked
  selected: boolean
  saved: boolean
  registerRef: (node: HTMLElement | null) => void
  onOpen: () => void
}

function HHChip({ r }: { r: Ranked }) {
  const text = formatHappyHour(r.hh)
  return text ? <span className={`mf-chip mf-chip-${r.hh.state}`}>{text}</span> : null
}

function PickCard({ r, index, ...p }: CardProps & { index: number }) {
  const v = r.venue
  const price = formatPrice(v)
  const walk = formatWalk(r)
  const tilt = [-1.6, 1.2, -0.7][index]
  return (
    <li
      ref={p.registerRef}
      className={`mf-pick mf-pick-${index + 1}${p.selected ? " is-selected" : ""}${r.hh.state === "now" ? " is-hh" : ""}`}
      style={{ "--tilt": `${tilt}deg`, "--drop": `${index * 90}ms` } as React.CSSProperties}
    >
      <div className="mf-paper" style={{ clipPath: tornClip(v.id) }}>
        <button type="button" className="mf-pick-main" onClick={p.onOpen} aria-haspopup="dialog">
          <span className="mf-pick-n">{index + 1}</span>
          <span className="mf-pick-name">
            {v.name}
            {p.saved && <i aria-label="saved"> ★</i>}
          </span>
          <span className="mf-pick-meta">
            <span>{[walk, formatOpen(r.open)].filter(Boolean).join(" · ")}</span>
            {price && <b className="mf-price">{price}</b>}
          </span>
          <HHChip r={r} />
        </button>
        <a className="mf-go" href={walkingDirections(v)} target="_blank" rel="noreferrer">
          Walk there ↗
        </a>
      </div>
      <span className="mf-pick-tape" aria-hidden="true" dangerouslySetInnerHTML={{ __html: tape() }} />
      <span
        className="mf-pick-art"
        aria-hidden="true"
        style={{ "--r": `${((hash01(v.id) - 0.5) * 40).toFixed(0)}deg` } as React.CSSProperties}
        dangerouslySetInnerHTML={{ __html: halfShell(r.hh.state === "now" ? "is-live" : "") }}
      />
    </li>
  )
}

function Row({ r, n, ...p }: CardProps & { n: number }) {
  const v = r.venue
  const price = formatPrice(v)
  const walk = formatWalk(r)
  return (
    <li ref={p.registerRef} className={`mf-row${p.selected ? " is-selected" : ""}${isClosed(r) ? " is-closed" : ""}${r.hh.state === "now" ? " is-hh" : ""}`}>
      <button type="button" className="mf-row-main" onClick={p.onOpen} aria-haspopup="dialog">
        <span className="mf-row-n">{String(n).padStart(2, "0")}</span>
        <span className="mf-row-name">
          {v.name}
          {p.saved && <i aria-label="saved"> ★</i>}
        </span>
        <span className="mf-row-meta">{[walk, formatOpen(r.open), price].filter(Boolean).join(" · ")}</span>
        <HHChip r={r} />
      </button>
      <a className="mf-row-go" href={walkingDirections(v)} target="_blank" rel="noreferrer" aria-label={`Walking directions to ${v.name}`}>
        ↗
      </a>
    </li>
  )
}

/** Mon–Thu 11am–10pm / Fri–Sat 11am–11pm / Sun closed — consecutive days with the same hours merge. */
function weekHours(hours: Venue["hours"]) {
  if (!hours) return []
  const order = [1, 2, 3, 4, 5, 6, 0]
  const label = (h: string | null) => (h == null ? "not posted" : h === "closed" ? "closed" : formatRange(...(h.split("-") as [string, string])))
  const rows: { days: number[]; text: string }[] = []
  for (const d of order) {
    const text = label(hours[d])
    const last = rows[rows.length - 1]
    if (last && last.text === text) last.days.push(d)
    else rows.push({ days: [d], text })
  }
  return rows.map((row) => ({
    days: row.days.length === 1 ? DAY_NAMES[row.days[0]] : `${DAY_NAMES[row.days[0]]}–${DAY_NAMES[row.days[row.days.length - 1]]}`,
    text: row.text,
  }))
}

/** The restaurant card. Pops up like a shell lid lifting off. */
function Detail({ r, saved, onClose, onShare, onSave }: { r: Ranked; saved: boolean; onClose: () => void; onShare: () => void; onSave: () => void }) {
  const v = r.venue
  const price = priceLine(r)
  const hours = weekHours(v.hours)
  const closeRef = useRef<HTMLButtonElement>(null)
  useEffect(() => closeRef.current?.focus(), [])
  return (
    <div className="mf-sheet" role="dialog" aria-modal="true" aria-labelledby="mf-sheet-title">
      <button type="button" className="mf-sheet-backdrop" onClick={onClose} aria-label="Close" tabIndex={-1} />
      <article>
        <svg className="mf-art mf-sheet-lid" viewBox="0 0 60 44" aria-hidden="true" dangerouslySetInnerHTML={{ __html: closedTop() }} />
        <div className="mf-sheet-paper" style={{ clipPath: tornClip(`${v.id}-sheet`, 9) }}>
          <button ref={closeRef} type="button" className="mf-sheet-close" onClick={onClose} aria-label="Close">
            ×
          </button>
          <h2 id="mf-sheet-title">{v.name}</h2>
          <p className="mf-sheet-addr">{v.address.replace(/, New Orleans, LA$/, "")}</p>
          <p className="mf-sheet-now">
            <span className={`mf-open mf-open-${r.open.state}`}>{formatOpen(r.open)}</span>
            {formatWalk(r) && <> · {formatWalk(r)}</>}
          </p>
          {v.start && v.end && (
            <div className={`mf-sheet-hh${r.hh.state === "now" ? " is-now" : ""}`}>
              <b>
                Happy hour {formatDays(v.days)} {formatRange(v.start, v.end)}
              </b>
              {v.deal && <span>{v.deal}</span>}
              <HHChip r={r} />
            </div>
          )}
          {price && (
            <p className="mf-sheet-price">
              {price.headline}
              {price.per && <small> {price.per}</small>}
            </p>
          )}
          {hours.length > 0 && (
            <p className="mf-hours">
              {hours.map((h) => (
                <span key={h.days}>
                  <b>{h.days}</b> {h.text}
                </span>
              ))}
            </p>
          )}
          {v.note && <p className="mf-sheet-note">{v.note}</p>}
          <div className="mf-sheet-actions">
            <a className="mf-go" href={walkingDirections(v)} target="_blank" rel="noreferrer">
              Walk there ↗
            </a>
            <button type="button" onClick={onShare}>
              Share
            </button>
            <button type="button" onClick={onSave} aria-pressed={saved} aria-label={saved ? "Unsave" : "Save"}>
              {saved ? "★" : "☆"}
            </button>
            <a href={v.source} target="_blank" rel="noreferrer">
              Source
            </a>
          </div>
        </div>
        <span className="mf-sheet-tape" aria-hidden="true" dangerouslySetInnerHTML={{ __html: tape() }} />
      </article>
    </div>
  )
}
