import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import deals from "../deals.json"
import OysterMap, { oysterEyeSvg, oysterSvg } from "./OysterMap"
import {
  DAY_NAMES,
  type Mode,
  type Ranked,
  type Venue,
  STALE_AFTER_DAYS,
  daysSince,
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
  const [detail, setDetail] = useState<Ranked | null>(null)
  const [saved, setSaved] = useState<Set<string>>(readSaved)
  const [toast, setToast] = useState("")
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
  const openCount = enriched.filter((r) => r.open.state === "open").length

  const age = daysSince(UPDATED, now)
  const stale = age > STALE_AFTER_DAYS

  const choose = (next: Mode) => {
    setMode(next)
    setSelectedId(null)
    if (next === "map") window.setTimeout(() => mapRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 60)
  }

  const select = (id: string, from: "map" | "list") => {
    setSelectedId(id)
    if (from === "map") rowRefs.current.get(id)?.scrollIntoView({ behavior: "smooth", block: "nearest" })
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
    if (!detail) return
    const close = (e: KeyboardEvent) => e.key === "Escape" && setDetail(null)
    window.addEventListener("keydown", close)
    return () => window.removeEventListener("keydown", close)
  }, [detail])

  const checked = new Date(`${UPDATED}T12:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric" })

  return (
    <section className="mf" id="finder" aria-labelledby="mf-title">
      <div className="mf-grain" aria-hidden="true" />

      <header className="mf-head">
        <p className="mf-kicker">MOYSTER · New Orleans</p>
        <h1 id="mf-title" className="mf-title">
          <span className="mf-title-a">OYSTERS</span>
          <span className="mf-title-b" aria-hidden="true">
            <span dangerouslySetInnerHTML={{ __html: oysterEyeSvg() }} />
          </span>
          <span className="mf-title-c">NEAR ME</span>
        </h1>
        <span className="mf-head-art" aria-hidden="true" dangerouslySetInnerHTML={{ __html: oysterEyeSvg() }} />

        <div className="mf-origin" aria-live="polite">
          <span className="mf-origin-label">From</span>
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
            <b>HAPPY HOUR NOW</b>
            <span>
              {live.length} {live.length === 1 ? "spot" : "spots"}
            </span>
          </>
        ) : nextUp ? (
          <>
            <b>NEXT HAPPY HOUR</b>
            <span>
              {nextUp.venue.name} · {formatHappyHour(nextUp.hh).replace("Happy hour ", "")}
            </span>
          </>
        ) : (
          <b>HAPPY HOUR</b>
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
            <b>{m.label}</b>
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
              onSelect={() => select(r.venue.id, "list")}
              onMore={() => setDetail(r)}
              onShare={() => share(r)}
              onSave={() => toggleSaved(r.venue.id)}
            />
          ))}
        </ol>
      )}

      <div ref={mapRef} className="mf-map-anchor">
        <OysterMap
          items={mapItems}
          origin={origin}
          selectedId={selectedId}
          onSelect={(id) => select(id, "map")}
          expanded={mode === "map"}
        />
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
              onSelect={() => select(r.venue.id, "list")}
              onMore={() => setDetail(r)}
            />
          ))}
        </ol>
      )}

      <p className={`mf-fresh${stale ? " is-stale" : ""}`}>
        {venues.length} spots · {openCount} open now · {stale ? `last checked ${age} days ago, may be out of date` : `checked ${checked}`}
        {saved.size > 0 && ` · ${saved.size} saved`}
      </p>

      {mode !== "map" && (
        <button type="button" className="mf-fab" onClick={() => choose("map")} aria-label="Show map">
          <span aria-hidden="true" dangerouslySetInnerHTML={{ __html: oysterSvg() }} />
          Map
        </button>
      )}

      {detail && (
        <Detail
          r={enriched.find((x) => x.venue.id === detail.venue.id) ?? detail}
          saved={saved.has(detail.venue.id)}
          stale={stale}
          onClose={() => setDetail(null)}
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
      <label htmlFor="mf-address">Address, hotel or landmark</label>
      <input
        id="mf-address"
        ref={input}
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="e.g. Jackson Square, 700 Canal St…"
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
      {state === "empty" && <p className="mf-search-state">No match. Try a street name or landmark.</p>}
      {state === "error" && <p className="mf-search-state">Address search is down. Check your connection and try again.</p>}
    </form>
  )
}

type CardProps = {
  r: Ranked
  selected: boolean
  saved: boolean
  registerRef: (node: HTMLElement | null) => void
  onSelect: () => void
  onMore: () => void
}

function HHChip({ r }: { r: Ranked }) {
  const text = formatHappyHour(r.hh)
  return text ? <span className={`mf-chip mf-chip-${r.hh.state}`}>{text}</span> : null
}

function OpenLine({ r }: { r: Ranked }) {
  return <span className={`mf-open mf-open-${r.open.state}`}>{formatOpen(r.open)}</span>
}

function PickCard({ r, index, onShare, onSave, ...p }: CardProps & { index: number; onShare: () => void; onSave: () => void }) {
  const v = r.venue
  const price = priceLine(r)
  const walk = formatWalk(r)
  return (
    <li
      ref={p.registerRef}
      className={`mf-pick mf-pick-${index + 1}${p.selected ? " is-selected" : ""}${r.hh.state === "now" ? " is-hh" : ""}`}
      style={{ "--tilt": `${[-1.6, 1.1, -0.6][index]}deg`, "--drop": `${index * 90}ms` } as React.CSSProperties}
    >
      <button type="button" className="mf-pick-main" onClick={p.onSelect} aria-pressed={p.selected}>
        <span className="mf-pick-n">{index + 1}</span>
        <span className="mf-pick-area">{v.area}</span>
        <span className="mf-pick-name">{v.name}</span>
        <span className="mf-pick-meta">
          <span className="mf-walk">{walk ?? v.area}</span>
          {price && (
            <span className="mf-price">
              <b>{price.headline}</b>
              {price.per && <small>{price.per}</small>}
            </span>
          )}
        </span>
        <OpenLine r={r} />
        <HHChip r={r} />
        {v.start && v.deal && <span className="mf-deal">{v.deal}</span>}
      </button>
      <div className="mf-actions">
        <a className="mf-go" href={walkingDirections(v)} target="_blank" rel="noreferrer">
          Walk there ↗
        </a>
        <button type="button" onClick={onShare} aria-label={`Share ${v.name}`}>
          Share
        </button>
        <button type="button" onClick={onSave} aria-pressed={p.saved} aria-label={p.saved ? `Unsave ${v.name}` : `Save ${v.name}`}>
          {p.saved ? "★" : "☆"}
        </button>
        <button type="button" onClick={p.onMore} aria-label={`Details for ${v.name}`}>
          ⋯
        </button>
      </div>
    </li>
  )
}

function Row({ r, n, ...p }: CardProps & { n: number }) {
  const v = r.venue
  const price = formatPrice(v)
  const walk = formatWalk(r)
  return (
    <li ref={p.registerRef} className={`mf-row${p.selected ? " is-selected" : ""}${isClosed(r) ? " is-closed" : ""}${r.hh.state === "now" ? " is-hh" : ""}`}>
      <button type="button" className="mf-row-main" onClick={p.onSelect} aria-pressed={p.selected}>
        <span className="mf-row-n">{String(n).padStart(2, "0")}</span>
        <span className="mf-row-name">
          {v.name}
          {p.saved && <i aria-label="saved"> ★</i>}
        </span>
        <span className="mf-row-meta">
          {[walk ?? v.area, formatOpen(r.open), price].filter(Boolean).join(" · ")}
        </span>
        <HHChip r={r} />
      </button>
      <a className="mf-row-go" href={walkingDirections(v)} target="_blank" rel="noreferrer" aria-label={`Walking directions to ${v.name}`}>
        ↗
      </a>
      <button type="button" className="mf-row-more" onClick={p.onMore} aria-label={`Details for ${v.name}`}>
        ⋯
      </button>
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

function Detail({
  r,
  saved,
  stale,
  onClose,
  onShare,
  onSave,
}: {
  r: Ranked
  saved: boolean
  stale: boolean
  onClose: () => void
  onShare: () => void
  onSave: () => void
}) {
  const v = r.venue
  const price = priceLine(r)
  const hours = weekHours(v.hours)
  const closeRef = useRef<HTMLButtonElement>(null)
  useEffect(() => closeRef.current?.focus(), [])
  return (
    <div className="mf-sheet" role="dialog" aria-modal="true" aria-label={v.name}>
      <button type="button" className="mf-sheet-backdrop" onClick={onClose} aria-label="Close" tabIndex={-1} />
      <article>
        <button ref={closeRef} type="button" className="mf-sheet-close" onClick={onClose}>
          Close ×
        </button>
        <p className="mf-kicker">{v.area}</p>
        <h2>{v.name}</h2>
        <p className="mf-sheet-addr">{v.address}</p>
        <dl>
          <div>
            <dt>Now</dt>
            <dd>
              <OpenLine r={r} />
              {formatWalk(r) && <> · {formatWalk(r)}</>}
            </dd>
          </div>
          {v.start && v.end && (
            <div className={r.hh.state === "now" ? "is-hh" : ""}>
              <dt>Happy hour</dt>
              <dd>
                <b>
                  {formatDays(v.days)} {formatRange(v.start, v.end)}
                </b>
                {v.deal && <> · {v.deal}</>}
                <br />
                <HHChip r={r} />
              </dd>
            </div>
          )}
          {price && (
            <div>
              <dt>Price</dt>
              <dd>
                {price.headline}
                {price.per && <small> {price.per}</small>}
              </dd>
            </div>
          )}
          {hours.length > 0 && (
            <div>
              <dt>Oysters</dt>
              <dd className="mf-hours">
                {hours.map((h) => (
                  <span key={h.days}>
                    <b>{h.days}</b> {h.text}
                  </span>
                ))}
              </dd>
            </div>
          )}
          {v.note && (
            <div>
              <dt>Note</dt>
              <dd>{v.note}</dd>
            </div>
          )}
        </dl>
        {stale && <p className="mf-alert">Over {STALE_AFTER_DAYS} days since this was checked. Call ahead.</p>}
        <div className="mf-actions">
          <a className="mf-go" href={walkingDirections(v)} target="_blank" rel="noreferrer">
            Walk there ↗
          </a>
          <a href={v.source} target="_blank" rel="noreferrer">
            Source ↗
          </a>
          <button type="button" onClick={onShare}>
            Share
          </button>
          <button type="button" onClick={onSave} aria-pressed={saved}>
            {saved ? "★ Saved" : "☆ Save"}
          </button>
        </div>
      </article>
    </div>
  )
}
