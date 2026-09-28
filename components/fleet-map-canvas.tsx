'use client'

/**
 * Leaflet map of the home waters, now with live boat positions.
 *
 * It used to draw only the base, because our boats carry no AIS transmitter
 * and there was nowhere to read a position from. That changed: the captain's
 * phone reports fixes into `trip_positions`, so a boat with an open trip has a
 * real track to draw. Anything without a fix is still not drawn — a plausible
 * guess is worse than an honest blank, because someone might act on it.
 *
 * Loaded through next/dynamic with ssr:false by the parent, because Leaflet
 * touches `window` at import time.
 */

// Leaflet's CSS is imported in app/globals.css, deliberately BEFORE our
// overrides — see the comment there.

import L from 'leaflet'
import { useEffect, useMemo, useRef } from 'react'

export type MapBoat = {
  id: string
  name: string
  lat: number
  lon: number
  headingDeg: number | null
  speedKn: number | null
  /** Minutes since the fix. Drives the colour: a stale dot must not look live. */
  ageMin: number
  /** Oldest-to-newest fixes for this trip. */
  track: { lat: number; lon: number }[]
  destination: string | null
  distanceNm: number | null
}

type Props = {
  lat: number
  lon: number
  label: string
  /** Navigation marks (buoys, lights, depths) on top of the street map. */
  nautical: boolean
  boats: MapBoat[]
  /** Minutes after which a fix counts as lost, matched to the alert rule. */
  noSignalMin: number
}

/** Fresh / going stale / lost. Same three-step reading as the fleet cards. */
function ageColor(ageMin: number, noSignalMin: number) {
  if (ageMin >= noSignalMin) return { dot: '#c2415a', ring: 'rgba(194,65,90,.35)' }
  if (ageMin >= 10) return { dot: '#a8761a', ring: 'rgba(168,118,26,.35)' }
  return { dot: '#1f6f96', ring: 'rgba(31,111,150,.35)' }
}

export default function FleetMapCanvas({
  lat,
  lon,
  label,
  nautical,
  boats,
  noSignalMin,
}: Props) {
  const hostRef = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<L.Map | null>(null)
  const seamarkRef = useRef<L.TileLayer | null>(null)
  // One layer for everything boat-related, so an update is a clear-and-redraw
  // rather than tracking each marker's identity.
  const boatLayerRef = useRef<L.LayerGroup | null>(null)
  // Which set of boats we have already framed. Re-fitting on every 60-second
  // refresh would yank the map away from wherever the office just panned it.
  const fittedRef = useRef<string>('')

  const baseIcon = useMemo(
    () =>
      L.divIcon({
        className: '',
        html: `<span style="
          display:block;width:12px;height:12px;border-radius:9999px;
          background:#3f6b7d;box-shadow:0 0 0 3px rgba(255,255,255,.9);
        "></span>`,
        iconSize: [12, 12],
        iconAnchor: [6, 6],
      }),
    [],
  )

  // Create the map ONCE. Re-creating it on every prop change would reset the
  // pan/zoom the office just set.
  useEffect(() => {
    if (!hostRef.current || mapRef.current) return

    const map = L.map(hostRef.current, {
      center: [lat, lon],
      zoom: 10,
      // The map sits inside a scrolling page, so grabbing the wheel would trap
      // the scroll. Ctrl/⌘ + wheel still zooms, and the +/- buttons always do.
      scrollWheelZoom: false,
      attributionControl: true,
    })

    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 18,
      attribution: '&copy; OpenStreetMap contributors',
    }).addTo(map)

    L.marker([lat, lon], { icon: baseIcon, title: label })
      .addTo(map)
      .bindPopup(`<strong>${label}</strong><br>Home base`)

    boatLayerRef.current = L.layerGroup().addTo(map)
    mapRef.current = map

    // The container is measured before the card has finished laying out, which
    // leaves Leaflet with grey gaps until something nudges it.
    const t = setTimeout(() => map.invalidateSize(), 250)

    return () => {
      clearTimeout(t)
      map.remove()
      mapRef.current = null
      seamarkRef.current = null
      boatLayerRef.current = null
    }
  }, [lat, lon, label, baseIcon])

  // Nautical overlay toggled without rebuilding the map.
  useEffect(() => {
    const map = mapRef.current
    if (!map) return

    if (nautical && !seamarkRef.current) {
      seamarkRef.current = L.tileLayer(
        'https://tiles.openseamap.org/seamark/{z}/{x}/{y}.png',
        { maxZoom: 18, opacity: 0.9, attribution: '&copy; OpenSeaMap' },
      ).addTo(map)
    } else if (!nautical && seamarkRef.current) {
      map.removeLayer(seamarkRef.current)
      seamarkRef.current = null
    }
  }, [nautical])

  // Boats: tracks first, then the marker, so the marker sits on top.
  useEffect(() => {
    const map = mapRef.current
    const layer = boatLayerRef.current
    if (!map || !layer) return

    layer.clearLayers()

    for (const b of boats) {
      const c = ageColor(b.ageMin, noSignalMin)

      if (b.track.length > 1) {
        L.polyline(
          b.track.map((p) => [p.lat, p.lon] as [number, number]),
          { color: c.dot, weight: 3, opacity: 0.75 },
        ).addTo(layer)
      }

      // An arrow when we know which way she is pointing, a plain dot when we
      // do not — a north-up arrow would be a heading we invented.
      const html =
        b.headingDeg == null
          ? `<span style="display:block;width:16px;height:16px;border-radius:9999px;
               background:${c.dot};box-shadow:0 0 0 4px ${c.ring},0 0 0 6px rgba(255,255,255,.85);"></span>`
          : `<span style="display:block;width:22px;height:22px;transform:rotate(${b.headingDeg}deg);">
               <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
                 <circle cx="12" cy="12" r="11" fill="rgba(255,255,255,.85)"/>
                 <path d="M12 3 L18.5 20 L12 16 L5.5 20 Z" fill="${c.dot}"/>
               </svg>
             </span>`

      const marker = L.marker([b.lat, b.lon], {
        icon: L.divIcon({
          className: '',
          html,
          iconSize: [22, 22],
          iconAnchor: [11, 11],
        }),
        title: b.name,
      }).addTo(layer)

      const bits = [
        b.speedKn != null ? `${b.speedKn.toFixed(1)} kn` : null,
        b.distanceNm != null ? `${b.distanceNm.toFixed(1)} nm run` : null,
        b.destination ? `to ${b.destination}` : null,
        b.ageMin >= noSignalMin
          ? `<span style="color:#c2415a">no signal ${b.ageMin} min</span>`
          : b.ageMin < 1
            ? 'fix just now'
            : `fix ${b.ageMin} min ago`,
      ].filter(Boolean)

      marker.bindPopup(`<strong>${b.name}</strong><br>${bits.join('<br>')}`)
    }

    // Frame the boats the first time this particular set appears, so a boat
    // that has sailed off the default view is not silently out of frame.
    const key = boats
      .map((b) => b.id)
      .sort()
      .join('|')
    if (key && key !== fittedRef.current) {
      fittedRef.current = key
      const pts: [number, number][] = [
        [lat, lon],
        ...boats.map((b) => [b.lat, b.lon] as [number, number]),
      ]
      map.fitBounds(L.latLngBounds(pts).pad(0.3), { animate: false })
    }
    if (!key) fittedRef.current = ''
  }, [boats, noSignalMin, lat, lon])

  // NOT aria-hidden: the map contains real focusable zoom buttons, and hiding
  // the subtree would leave them reachable by keyboard but unnamed. The panels
  // beside it carry the same information as text, so nothing is lost either way.
  //
  // The zoom buttons ship at 30px, below the 44px touch target. They are sized
  // up in app/globals.css rather than here: Leaflet's own rule has two classes
  // (`.leaflet-touch .leaflet-bar a`), so a single-class Tailwind utility loses
  // on specificity — and Tailwind does not generate an arbitrary selector that
  // targets the container's OWN class either (measured: the rule was absent
  // from the stylesheet entirely).
  return (
    <div
      ref={hostRef}
      role="application"
      aria-label={`Map of the waters around ${label}`}
      className="h-[420px] w-full"
    />
  )
}
