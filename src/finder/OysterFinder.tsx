import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import deals from "../deals.json"
import OysterMap from "./OysterMap"
import { closedBottom, closedTop, eyeOyster, halfShell, hash01, roughFilterSvg } from "./art"
import { choosePalette } from "./palettes"
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
  formatMenuPrice,
  formatOpen,
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
  { value: "near", label: "Closest" },
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

const isClosed = (r: Ranked) => r.open.state === "opens" && r.hh.state !== "now"

/** A small engraving for each restaurant: an open half shell or a closed oyster, chosen per venue. */
const thumb = (id: string, live: boolean) =>
  hash01(id) > 0.5
    ? halfShell(live ? "is-live" : "")
    : `<svg class="mf-art mf-closed${live ? " is-live" : ""}" viewBox="0 2 60 42" aria-hidden="true">${closedBottom()}${closedTop()}</svg>`

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
  const [palette] = useState(choosePalette)
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
  const restOpen = rest.filter((r) => !isClosed(r))
  const restClosed = rest.filter(isClosed)
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

  const row = (r: Ranked, n: number) => (
    <Row
      key={r.venue.id}
      r={r}
      n={n}
      selected={selectedId === r.venue.id}
      saved={saved.has(r.venue.id)}
      registerRef={(node) => (node ? rowRefs.current.set(r.venue.id, node) : rowRefs.current.delete(r.venue.id))}
      onOpen={() => open(r.venue.id)}
    />
  )

  return (
    <section className="mf" id="finder" data-palette={palette} aria-labelledby="mf-title">
      <span className="mf-defs" dangerouslySetInnerHTML={{ __html: roughFilterSvg }} />

      <header className="mf-head">
        <p className="mf-brand">
          <span>MOYSTER.</span>
          <small>New Orleans</small>
        </p>

        <button
          type="button"
          className={`mf-oracle${shucking ? " is-shucking" : ""}`}
          onClick={shuck}
          aria-label="Can't decide? Tap the oyster and it picks a place for you"
        >
          <span className="mf-oracle-art" aria-hidden="true" dangerouslySetInnerHTML={{ __html: eyeOyster() }} />
          <span className="mf-oracle-label" aria-hidden="true">
            Can't decide? <b>Tap the oyster</b>
          </span>
        </button>

        <h1 id="mf-title" className="mf-title">
          <span className="mf-brush">
            Oysters
            <br />
            near me
          </span>
        </h1>

        <div className="mf-origin" aria-live="polite">
          <span className="mf-pin-icon" aria-hidden="true">
            ●
          </span>
          <strong>{locating ? "Finding you…" : origin.label}</strong>
          {origin.source !== "device" && !locating && (
            <button type="button" className="mf-link" onClick={askForLocation}>
              Use my location
            </button>
          )}
          <button type="button" className="mf-link" onClick={() => setSearchOpen((o) => !o)} aria-expanded={searchOpen}>
            {searchOpen ? "Close" : "Change"}
          </button>
        </div>
        {locateError && <p className="mf-alert">{locateMessage[locateError]}</p>}
        {searchOpen && <AddressSearch onPick={chooseOrigin} />}
      </header>

      <button type="button" className={`mf-hh${live.length ? " is-live" : ""}`} onClick={() => choose("happy")}>
        <span className="mf-hh-title">
          <span className="mf-brush mf-brush-hl">{live.length ? "Happy hour now" : "Happy hour"}</span>
        </span>
        <span className="mf-hh-text">
          {live.length
            ? `${live.length} ${live.length === 1 ? "place" : "places"} with oyster deals right now`
            : nextUp
              ? `Next: ${nextUp.venue.name} · ${formatHappyHour(nextUp.hh).replace("Happy hour ", "")}`
              : "No more today"}
        </span>
        <span className="mf-hh-go">See all ›</span>
      </button>

      <div className="mf-modes" role="tablist" aria-label="Sort oyster places">
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
        <ol className="mf-picks" aria-label="Top three">
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

      {restOpen.length > 0 && (
        <section className="mf-section" aria-labelledby="mf-more">
          <h2 id="mf-more" className="mf-h2">
            {picks.length ? "More oyster places" : "All oyster places"}
          </h2>
          <ol className="mf-list" start={picks.length + 1}>
            {restOpen.map((r, i) => row(r, picks.length + i + 1))}
          </ol>
        </section>
      )}

      {restClosed.length > 0 && (
        <section className="mf-section" aria-labelledby="mf-closed">
          <h2 id="mf-closed" className="mf-h2">
            Closed now
          </h2>
          <ol className="mf-list" start={picks.length + restOpen.length + 1}>
            {restClosed.map((r, i) => row(r, picks.length + restOpen.length + i + 1))}
          </ol>
        </section>
      )}

      {stale && <p className="mf-fresh">Last checked {age} days ago. Call ahead.</p>}

      {mode !== "map" && !detail && (
        <button type="button" className="mf-fab" onClick={() => choose("map")}>
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

function PriceTag({ r }: { r: Ranked }) {
  const p = r.price
  return (
    <span className={`mf-price mf-price-${p.kind}`}>
      {p.text}
      {p.kind === "happy" && <small> happy hour</small>}
    </span>
  )
}

function Status({ r }: { r: Ranked }) {
  return <span className={`mf-open mf-open-${r.open.state}`}>{formatOpen(r.open)}</span>
}

function Walk({ r }: { r: Ranked }) {
  const w = formatWalk(r)
  return w ? (
    <span className="mf-walk">
      <span aria-hidden="true">🚶 </span>
      {w}
    </span>
  ) : null
}

function PickCard({ r, index, ...p }: CardProps & { index: number }) {
  const v = r.venue
  return (
    <li
      ref={p.registerRef}
      className={`mf-card mf-pick mf-pick-${index + 1}${p.selected ? " is-selected" : ""}${r.hh.state === "now" ? " is-hh" : ""}`}
      style={{ "--drop": `${index * 80}ms` } as React.CSSProperties}
    >
      <button type="button" className="mf-card-main" onClick={p.onOpen} aria-haspopup="dialog">
        <span className="mf-thumb" aria-hidden="true" dangerouslySetInnerHTML={{ __html: thumb(v.id, r.hh.state === "now") }} />
        <span className="mf-card-body">
          <span className="mf-name">
            {v.name}
            {p.saved && <i aria-label="saved"> ★</i>}
          </span>
          <PriceTag r={r} />
          <HHChip r={r} />
          <Status r={r} />
          <Walk r={r} />
        </span>
      </button>
      <div className="mf-card-actions">
        <a className="mf-btn mf-btn-primary" href={walkingDirections(v)} target="_blank" rel="noreferrer">
          Walk there →
        </a>
        <button type="button" className="mf-btn mf-btn-quiet" onClick={p.onOpen} aria-haspopup="dialog" aria-label={`Details for ${v.name}`}>
          Details
        </button>
      </div>
    </li>
  )
}

function Row({ r, n, ...p }: CardProps & { n: number }) {
  const v = r.venue
  return (
    <li ref={p.registerRef} className={`mf-card mf-row${p.selected ? " is-selected" : ""}${isClosed(r) ? " is-closed" : ""}${r.hh.state === "now" ? " is-hh" : ""}`}>
      <button type="button" className="mf-card-main" onClick={p.onOpen} aria-haspopup="dialog">
        <span className="mf-thumb" aria-hidden="true" dangerouslySetInnerHTML={{ __html: thumb(v.id, r.hh.state === "now") }} />
        <span className="mf-card-body">
          <span className="mf-name">
            <span className="mf-n" aria-hidden="true">
              {n}.{" "}
            </span>
            {v.name}
            {p.saved && <i aria-label="saved"> ★</i>}
          </span>
          <PriceTag r={r} />
          <HHChip r={r} />
          <Status r={r} />
          <Walk r={r} />
        </span>
        <span className="mf-chev" aria-hidden="true">
          ›
        </span>
      </button>
    </li>
  )
}

/** Mon–Thu 11am–10pm / Fri–Sat 11am–11pm / Sun closed — consecutive days with the same hours merge. */
function weekHours(hours: Venue["hours"]) {
  if (!hours) return []
  const order = [1, 2, 3, 4, 5, 6, 0]
  const label = (h: string | null) => (h == null ? "not listed" : h === "closed" ? "closed" : formatRange(...(h.split("-") as [string, string])))
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

/** The restaurant card. A shell lid lifts off it as it opens. */
function Detail({ r, saved, onClose, onShare, onSave }: { r: Ranked; saved: boolean; onClose: () => void; onShare: () => void; onSave: () => void }) {
  const v = r.venue
  const hours = weekHours(v.hours)
  const menuPrice = formatMenuPrice(v.menu)
  const grill = v.menu?.chargrilled
  const closeRef = useRef<HTMLButtonElement>(null)
  useEffect(() => closeRef.current?.focus(), [])
  return (
    <div className="mf-sheet" role="dialog" aria-modal="true" aria-labelledby="mf-sheet-title">
      <button type="button" className="mf-sheet-backdrop" onClick={onClose} aria-label="Close" tabIndex={-1} />
      <article className="mf-sheet-card">
        <svg className="mf-art mf-sheet-lid" viewBox="0 0 60 44" aria-hidden="true" dangerouslySetInnerHTML={{ __html: closedTop() }} />
        <button ref={closeRef} type="button" className="mf-sheet-close" onClick={onClose}>
          Close ✕
        </button>
        <h2 id="mf-sheet-title">{v.name}</h2>
        <p className="mf-sheet-addr">{v.address.replace(/, New Orleans, LA$/, "")}</p>
        <p className="mf-sheet-now">
          <Status r={r} />
          <Walk r={r} />
        </p>

        {v.start && v.end && (
          <div className={`mf-sheet-box mf-sheet-hh${r.hh.state === "now" ? " is-now" : ""}`}>
            <h3>Happy hour</h3>
            <p>
              <b>
                {formatDays(v.days)}, {formatRange(v.start, v.end)}
              </b>
            </p>
            {v.deal && <p>{v.deal}</p>}
            <HHChip r={r} />
          </div>
        )}

        <div className="mf-sheet-box">
          <h3>Oyster prices</h3>
          {v.price != null && v.start && <p>Happy hour: {v.deal}</p>}
          {v.menu?.raw?.half != null || v.menu?.raw?.dozen != null ? (
            <p>
              Raw: {[v.menu.raw.half != null && `$${v.menu.raw.half} for 6`, v.menu.raw.dozen != null && `$${v.menu.raw.dozen} a dozen`].filter(Boolean).join(" · ")}
            </p>
          ) : (
            menuPrice && <p>Raw: {menuPrice}</p>
          )}
          {grill && (grill.half != null || grill.dozen != null) && (
            <p>Chargrilled: {[grill.half != null && `$${grill.half} for 6`, grill.dozen != null && `$${grill.dozen} a dozen`].filter(Boolean).join(" · ")}</p>
          )}
          {v.menu?.market && <p>Market price (changes daily)</p>}
          {!menuPrice && !v.menu?.market && !(v.price != null && v.start) && <p>Prices not posted online.</p>}
          {v.menu?.url && (
            <a className="mf-link" href={v.menu.url} target="_blank" rel="noreferrer">
              See menu ↗
            </a>
          )}
        </div>

        {hours.length > 0 && (
          <div className="mf-sheet-box">
            <h3>Oyster hours</h3>
            <p className="mf-hours">
              {hours.map((h) => (
                <span key={h.days}>
                  <b>{h.days}</b> {h.text}
                </span>
              ))}
            </p>
          </div>
        )}
        {v.note && <p className="mf-sheet-note">{v.note}</p>}

        <a className="mf-btn mf-btn-primary mf-btn-wide" href={walkingDirections(v)} target="_blank" rel="noreferrer">
          Walk there →
        </a>
        <div className="mf-sheet-actions">
          <button type="button" className="mf-btn mf-btn-quiet" onClick={onShare}>
            Share
          </button>
          <button type="button" className="mf-btn mf-btn-quiet" onClick={onSave} aria-pressed={saved}>
            {saved ? "★ Saved" : "☆ Save"}
          </button>
        </div>
      </article>
    </div>
  )
}
