import { useEffect, useRef, useState } from "react"
import L from "leaflet"
import "leaflet/dist/leaflet.css"
import type { Ranked } from "./logic"
import { hasCoords } from "./logic"
import type { Origin } from "./location"

// The oyster-eye: a ruffled half shell holding a human eye. Used for the logo and title.
export const oysterEyeSvg = (n?: number | string) => `
<svg class="mf-eye" viewBox="0 0 48 44" aria-hidden="true">
  <path class="shell" d="M24 2c7 0 15 3 19 9 4 7 4 14 0 21-4 7-11 10-19 10S9 39 5 32C1 25 1 18 5 11 9 5 17 2 24 2z"/>
  <path class="ruffle" d="M8 13c4-3 7 1 10-2s7 0 10-2 7 1 10 0M6 30c4 3 8-1 11 2s8 0 11 2 7-1 12-3"/>
  <path class="lid" d="M9 22c5-8 25-8 30 0-5 8-25 8-30 0z"/>
  <circle class="iris" cx="24" cy="22" r="6.4"/>
  <circle class="pupil" cx="24" cy="22" r="2.8"/>
  <circle class="glint" cx="26.2" cy="19.8" r="1.2"/>
</svg>${n != null ? `<b>${n}</b>` : ""}`

// An engraved half-shell oyster: ruffled rim, growth rings, hatching, pearly cup and a plump oyster
// with a dark frilled mantle. Used for every map marker; CSS recolours it by state.
const OYSTER_BODY = `
  <path class="o-shell" d="M4 26C8 20 12 15 18 12q3-3 6-2q3-3 7-1q4-3 7 0q4-2 7 1q4 0 6 4q4 2 3 6q3 3 0 7q1 4-4 5q-1 4-6 3q-3 3-7 1q-3 3-7 0q-4 2-7-1q-4 1-6-3C12 31 7 29 4 26z"/>
  <path class="o-ring" d="M10 20C16 13 26 10 36 11c8 0 14 3 16 8M12 31c8 5 20 6 30 4 5-1 8-4 10-7"/>
  <path class="o-hatch" d="M14 33l2-3M18 35l2-3M22 36l2-3M26 37l2-3M30 37l2-3M8 29l2-2.5M6 24l3-1"/>
  <path class="o-cup" d="M10 26c4-8 14-12 24-12s16 5 16 11-6 8-16 8c-10 0-20-2-24-7z"/>
  <path class="o-meat" d="M16 25c3-6 12-8 19-8 8 0 12 4 12 8s-5 6-12 6c-8 0-16-2-19-6z"/>
  <path class="o-gill" d="M21 26c6-3 13-4 22-2M24 28c5-1 11-1 17 0"/>
  <path class="o-frill" d="M17 25q2-3 4-3q2-3 5-3q3-2 6-1q3-1 6 0q3 0 5 2q3 1 3 4q1 3-2 4q-2 2-5 2q-3 2-6 1q-3 1-6 0q-3 0-5-2q-3 0-5-4"/>
  <ellipse class="o-belly" cx="38" cy="25" rx="3.2" ry="2.3"/>
  <ellipse class="o-glint" cx="29" cy="20.5" rx="2.4" ry="1" transform="rotate(-12 29 20.5)"/>`

export const oysterSvg = (n?: number | string) =>
  `<svg class="mf-oyster" viewBox="0 0 60 44" aria-hidden="true">${OYSTER_BODY}</svg>${n != null ? `<b>${n}</b>` : ""}`

const oysterPileSvg = (n: number) =>
  `<svg class="mf-oyster mf-oyster-pile" viewBox="0 0 66 52" aria-hidden="true"><g transform="translate(6 8) rotate(12 30 24)">${OYSTER_BODY}</g><g transform="translate(0 0) rotate(-8 30 24)">${OYSTER_BODY}</g></svg><b>×${n}</b>`

const OSM_TILES = "https://tile.openstreetmap.org/{z}/{x}/{y}.png"

type Props = {
  items: Ranked[]
  origin: Origin
  selectedId: string | null
  onSelect: (id: string) => void
  expanded: boolean
}

type Cluster = { ids: string[]; lat: number; lng: number }

const CLUSTER_PX = 28

export default function OysterMap({ items, origin, selectedId, onSelect, expanded }: Props) {
  const el = useRef<HTMLDivElement>(null)
  const map = useRef<L.Map | null>(null)
  const layer = useRef<L.LayerGroup | null>(null)
  const originMarker = useRef<L.Marker | null>(null)
  const onSelectRef = useRef(onSelect)
  onSelectRef.current = onSelect
  const fit = useRef<L.LatLngBounds | null>(null)
  const userMoved = useRef(false)
  const [tilesFailed, setTilesFailed] = useState(false)
  const [view, setView] = useState(0) // bumps on zoom/move so clusters recompute

  const mapped = items.filter((r) => hasCoords(r.venue))
  const unmappedCount = items.length - mapped.length

  // Create the map once.
  useEffect(() => {
    if (!el.current || map.current) return
    const m = L.map(el.current, { zoomControl: false, attributionControl: true, tap: false } as L.MapOptions)
    m.setView([origin.lat, origin.lng], 15)
    m.zoomControl = L.control.zoom({ position: "bottomright" }).addTo(m)
    let errors = 0
    let loads = 0
    let fellBack = false
    const tiles = L.tileLayer("https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png", {
      maxZoom: 19,
      subdomains: "abcd",
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
    })
      .on("tileerror", () => {
        // Failing across the board (not one flaky tile): switch to OpenStreetMap's own tiles once,
        // and only tell the visitor if those fail too.
        if (++errors < 3 || loads > 0) return
        if (!fellBack) {
          fellBack = true
          errors = 0
          tiles.setUrl(OSM_TILES)
        } else setTilesFailed(true)
      })
      .on("tileload", () => {
        loads++
        setTilesFailed(false)
      })
      .addTo(m)
    layer.current = L.layerGroup().addTo(m)
    m.on("zoomend moveend", () => setView((v) => v + 1))
    // Once someone drags or zooms, stop re-framing the map under their fingers.
    m.on("dragstart", () => (userMoved.current = true))
    el.current.addEventListener("wheel", () => (userMoved.current = true), { passive: true })
    m.zoomControl?.getContainer()?.addEventListener("click", () => (userMoved.current = true))
    map.current = m

    // The map's box changes size (layout settling, Map mode, rotating the phone): re-measure and re-frame.
    const ro = new ResizeObserver(() => {
      m.invalidateSize({ pan: false })
      if (fit.current && !userMoved.current) m.fitBounds(fit.current, { padding: [44, 44], maxZoom: 17, animate: false })
    })
    ro.observe(el.current)
    return () => {
      ro.disconnect()
      m.remove()
      map.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Frame the origin + the three best results whenever the search center changes.
  const mappedKey = mapped.slice(0, 3).map((r) => r.venue.id).join()
  useEffect(() => {
    const m = map.current
    if (!m) return
    const pts: L.LatLngExpression[] = [[origin.lat, origin.lng]]
    mapped.slice(0, 3).forEach((r) => pts.push([r.venue.lat!, r.venue.lng!]))
    userMoved.current = false
    fit.current = pts.length > 1 ? L.latLngBounds(pts) : L.latLng(origin.lat, origin.lng).toBounds(800)
    m.fitBounds(fit.current, { padding: [44, 44], maxZoom: 17 })

    originMarker.current?.remove()
    originMarker.current = L.marker([origin.lat, origin.lng], {
      icon: L.divIcon({ className: "mf-you", html: "<i></i><span>YOU</span>", iconSize: [22, 22] }),
      keyboard: false,
      interactive: false,
      zIndexOffset: -100,
    }).addTo(m)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [origin.lat, origin.lng, mappedKey])

  // Bring the selected venue into view (selection from the list).
  useEffect(() => {
    const m = map.current
    const r = mapped.find((x) => x.venue.id === selectedId)
    if (!m || !r) return
    const ll = L.latLng(r.venue.lat!, r.venue.lng!)
    if (!m.getBounds().pad(-0.15).contains(ll)) m.panTo(ll, { animate: true })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId])

  // Draw markers, merging ones that overlap on screen. The selected venue is never hidden in a cluster.
  useEffect(() => {
    const m = map.current
    const g = layer.current
    if (!m || !g) return
    g.clearLayers()
    const order = new Map(items.map((r, i) => [r.venue.id, i + 1]))
    const clusters: (Cluster & { px: L.Point })[] = []
    for (const r of mapped) {
      const v = r.venue
      const px = m.latLngToContainerPoint([v.lat!, v.lng!])
      const near = v.id === selectedId ? null : clusters.find((c) => !c.ids.includes(selectedId ?? "") && c.px.distanceTo(px) < CLUSTER_PX)
      if (near) near.ids.push(v.id)
      else clusters.push({ ids: [v.id], lat: v.lat!, lng: v.lng!, px })
    }
    for (const c of clusters) {
      if (c.ids.length === 1) {
        const id = c.ids[0]
        const r = mapped.find((x) => x.venue.id === id)!
        const selected = id === selectedId
        const live = r.hh.state === "now"
        const closed = r.open.state === "opens" && !live
        const marker = L.marker([c.lat, c.lng], {
          icon: L.divIcon({
            className: `mf-pin${selected ? " is-selected" : ""}${live ? " is-live" : ""}${closed ? " is-closed" : ""}`,
            html: oysterSvg(order.get(id)),
            iconSize: selected ? [66, 48] : [46, 34],
            iconAnchor: selected ? [33, 42] : [23, 30],
          }),
          title: r.venue.name,
          alt: `${r.venue.name}${live ? ", happy hour now" : closed ? ", closed" : ""}`,
          riseOnHover: true,
          zIndexOffset: selected ? 1000 : live ? 300 : closed ? -50 : 100,
        })
        marker.on("click", () => onSelectRef.current(id))
        marker.addTo(g)
      } else {
        const names = c.ids.map((id) => mapped.find((x) => x.venue.id === id)!.venue.name)
        const marker = L.marker([c.lat, c.lng], {
          icon: L.divIcon({
            className: `mf-pin mf-cluster${c.ids.some((id) => mapped.find((x) => x.venue.id === id)!.hh.state === "now") ? " is-live" : ""}`,
            html: oysterPileSvg(c.ids.length),
            iconSize: [54, 42],
            iconAnchor: [27, 36],
          }),
          title: names.join(", "),
          alt: `${c.ids.length} spots: ${names.join(", ")}`,
        })
        marker.on("click", () => {
          userMoved.current = true
          const pts = c.ids.map((id) => {
            const v = mapped.find((x) => x.venue.id === id)!.venue
            return L.latLng(v.lat!, v.lng!)
          })
          m.fitBounds(L.latLngBounds(pts), { padding: [60, 60], maxZoom: 19 })
        })
        marker.addTo(g)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, selectedId, view])

  return (
    <div className={`mf-map${expanded ? " is-expanded" : ""}`}>
      <div ref={el} className="mf-map-canvas" role="region" aria-label="Map of oyster spots" />
      <div className="mf-map-riso" aria-hidden="true" />
      <p className="mf-map-legend" aria-hidden="true">
        <span className="is-live" dangerouslySetInnerHTML={{ __html: oysterSvg() }} />
        Happy hour
        <span dangerouslySetInnerHTML={{ __html: oysterSvg() }} />
        Open
        <span className="is-closed" dangerouslySetInnerHTML={{ __html: oysterSvg() }} />
        Closed
      </p>
      {tilesFailed && <p className="mf-map-note">Street map didn't load. Oysters are still in the right places.</p>}
      {unmappedCount > 0 && <p className="mf-map-count">{unmappedCount} not on map yet</p>}
    </div>
  )
}
