import { useEffect, useRef, useState } from "react"
import L from "leaflet"
import "leaflet/dist/leaflet.css"
import type { Ranked } from "./logic"
import { hasCoords } from "./logic"
import type { Origin } from "./location"
import { halfShell, hash01, shellPile } from "./art"
import { PLATE_BOUNDS, topoOverlay } from "./topo"

const OSM_TILES = "https://tile.openstreetmap.org/{z}/{x}/{y}.png"
const OSM_FALLBACK = "https://a.tile.openstreetmap.fr/osmfr/{z}/{x}/{y}.png"

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
    // OpenStreetMap's own tiles: free, no key. (CARTO's basemaps now answer with an
    // "API key required" picture instead of an error, so they can't be trusted as the primary.)
    const tiles = L.tileLayer(OSM_TILES, {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    })
      .on("tileerror", () => {
        // Failing across the board (not one flaky tile): try OpenStreetMap France's mirror once,
        // and only tell the visitor if that fails too.
        if (++errors < 3 || loads > 0) return
        if (!fellBack) {
          fellBack = true
          errors = 0
          tiles.setUrl(OSM_FALLBACK)
        } else setTilesFailed(true)
      })
      .on("tileload", () => {
        loads++
        setTilesFailed(false)
      })
      .addTo(m)
    // Plate I laid over the street map: the shell's growth rings run across the city as contour lines.
    const tpl = document.createElement("template")
    tpl.innerHTML = topoOverlay()
    L.svgOverlay(tpl.content.firstElementChild as SVGElement, L.latLngBounds(PLATE_BOUNDS), { interactive: false, className: "mf-topo-layer" }).addTo(m)
    // Engraver's furniture: a compass rose and a scale bar in miles.
    const Compass = L.Control.extend({
      onAdd() {
        const d = L.DomUtil.create("div", "mf-compass")
        d.setAttribute("aria-hidden", "true")
        d.innerHTML = `<svg viewBox="-24 -32 48 58"><circle r="15"/><path d="M0 -22 L4 0 L0 22 L-4 0 Z"/><path class="n" d="M0 -22 L4 0 L-4 0 Z"/><text y="-25" text-anchor="middle">N</text></svg>`
        return d
      },
    })
    new Compass({ position: "topright" }).addTo(m)
    L.control.scale({ position: "bottomright", metric: false, maxWidth: 90 }).addTo(m)
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
            html: `<span class="mf-pin-tilt" style="--r:${((hash01(id) - 0.5) * 30).toFixed(0)}deg">${halfShell()}</span><b>${order.get(id)}</b>`,
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
            html: `${shellPile()}<b>×${c.ids.length}</b>`,
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
        <span className="is-live" dangerouslySetInnerHTML={{ __html: halfShell() }} />
        Happy hour
        <span dangerouslySetInnerHTML={{ __html: halfShell() }} />
        Open
        <span className="is-closed" dangerouslySetInnerHTML={{ __html: halfShell() }} />
        Closed now
      </p>
      {tilesFailed && <p className="mf-map-note">Street map didn't load.</p>}
      {unmappedCount > 0 && <p className="mf-map-count">{unmappedCount} not on map yet</p>}
    </div>
  )
}
