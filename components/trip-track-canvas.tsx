'use client'

import { useEffect, useRef } from 'react'
import L from 'leaflet'

export type TrackPoint = { lat: number; lon: number; speedKn: number | null; at: string }
export type TrackCatch = {
  id: string
  lat: number | null
  lon: number | null
  species: string
  weightKg: number | null
  released: boolean
  caughtAtLabel: string
}

/** Sea chart on top of the street map, same pairing as the fleet map. */
function baseLayers(map: L.Map) {
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 18,
    attribution: '© OpenStreetMap',
  }).addTo(map)

  L.tileLayer('https://tiles.openseamap.org/seamark/{z}/{x}/{y}.png', {
    maxZoom: 18,
    attribution: '© OpenSeaMap',
  }).addTo(map)
}

export default function TripTrackCanvas({
  track,
  catches,
}: {
  track: TrackPoint[]
  catches: TrackCatch[]
}) {
  const boxRef = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<L.Map | null>(null)

  useEffect(() => {
    const box = boxRef.current
    if (!box || mapRef.current) return

    const map = L.map(box, { zoomControl: true, attributionControl: true })
    mapRef.current = map
    baseLayers(map)

    return () => {
      map.remove()
      mapRef.current = null
    }
  }, [])

  useEffect(() => {
    const map = mapRef.current
    if (!map) return

    // Everything except the base layers is redrawn, so a re-render cannot
    // leave a stale route behind next to the new one.
    map.eachLayer((l) => {
      if (!(l instanceof L.TileLayer)) map.removeLayer(l)
    })

    const line = track.map((p) => [p.lat, p.lon] as [number, number])

    if (line.length > 1) {
      // Drawn twice: a wide dark casing under a light line. A single thin
      // stroke disappears over the busy chart tiles at this zoom.
      L.polyline(line, { color: '#0f2e3a', weight: 7, opacity: 0.45 }).addTo(map)
      L.polyline(line, { color: '#8f6d3a', weight: 3, opacity: 0.95 }).addTo(map)
    }

    if (line.length > 0) {
      const first = line[0]
      const last = line[line.length - 1]
      // A boat almost always comes home to the mooring it left, so the two
      // markers land on the same pixel and the departure one is buried under
      // the return one — invisible, while a legend still explains its colour.
      // Round trips therefore get a single marker that says both things.
      // ~250 m, comfortably more than GPS scatter at anchor and far less than
      // the distance to any other anchorage.
      const roundTrip =
        line.length > 1 &&
        Math.abs(first[0] - last[0]) < 0.0025 &&
        Math.abs(first[1] - last[1]) < 0.0025

      if (roundTrip) {
        L.circleMarker(first, {
          radius: 7,
          color: '#456b49',
          weight: 3,
          fillColor: '#8fae92',
          fillOpacity: 1,
        })
          .addTo(map)
          .bindTooltip('Left and returned here', { direction: 'top' })
      } else {
        L.circleMarker(first, {
          radius: 6,
          color: '#456b49',
          weight: 2,
          fillColor: '#8fae92',
          fillOpacity: 1,
        })
          .addTo(map)
          .bindTooltip('Left the base', { direction: 'top' })

        // Only worth a second marker once the boat has actually moved — on an
        // open trip the last fix is where she is now, not where she ended.
        if (line.length > 1) {
          L.circleMarker(last, {
            radius: 6,
            color: '#7d3a2e',
            weight: 2,
            fillColor: '#c8846b',
            fillOpacity: 1,
          })
            .addTo(map)
            .bindTooltip('Where she is now', { direction: 'top' })
        }
      }
    }

    for (const c of catches) {
      if (c.lat == null || c.lon == null) continue
      const kg = c.weightKg == null ? '' : ` · ${c.weightKg} kg`
      L.circleMarker([c.lat, c.lon], {
        // Fish sit on top of the route, so they are filled and outlined in
        // the sea blue rather than the route gold.
        radius: 7,
        color: '#0f2e3a',
        weight: 2,
        fillColor: c.released ? '#9ecbdd' : '#1f6f96',
        fillOpacity: 1,
      })
        .addTo(map)
        .bindTooltip(
          `${c.species}${kg}${c.released ? ' · released' : ''} — ${c.caughtAtLabel}`,
          { direction: 'top' },
        )
    }

    const all = [
      ...line,
      ...catches
        .filter((c) => c.lat != null && c.lon != null)
        .map((c) => [c.lat as number, c.lon as number] as [number, number]),
    ]

    if (all.length > 1) {
      map.fitBounds(L.latLngBounds(all), { padding: [26, 26] })
    } else if (all.length === 1) {
      map.setView(all[0], 12)
    } else {
      // No fixes at all — show the home water rather than the empty ocean at
      // zoom 0, which reads as a broken map.
      map.setView([-13.45, 48.34], 10)
    }
  }, [track, catches])

  return (
    <div
      ref={boxRef}
      role="application"
      aria-label="Map of the trip's route with the fish landed along it"
      className="h-[360px] w-full"
    />
  )
}
