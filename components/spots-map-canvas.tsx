'use client'

import L from 'leaflet'
import { useEffect, useMemo, useRef } from 'react'

export type MapSpot = {
  id: string
  name: string
  lat: number
  lon: number
  kind: string
  catchCount: number
  bestKg: number | null
  topSpecies: string | null
  secret: boolean
}

type Props = {
  /** Base position, used only when there are no spots to frame. */
  lat: number
  lon: number
  label: string
  spots: MapSpot[]
  /** Navigation marks (buoys, lights, depths) over the street map. */
  nautical: boolean
  /**
   * When set, a click on the water reports its position. This is how a spot
   * gets added: typing coordinates by hand is both slow and easy to get wrong
   * by a degree.
   */
  onPick?: (lat: number, lon: number) => void
  /** Highlighted spot, kept in step with the list selection. */
  selectedId?: string | null
  onSelect?: (id: string) => void
}

/**
 * Marker size carries the catch count, so the map answers "where do we
 * actually catch fish" at a glance rather than after reading every label.
 */
function radiusFor(catchCount: number) {
  if (catchCount >= 20) return 15
  if (catchCount >= 10) return 13
  if (catchCount >= 5) return 11
  if (catchCount >= 1) return 9
  return 7
}

/** Proven / promising / unproven. Colour never carries meaning alone — the
 *  radius and the popup say the same thing in words. */
function toneFor(catchCount: number) {
  if (catchCount >= 5) return { fill: '#1f6f96', stroke: '#9ecbdd' }
  if (catchCount >= 1) return { fill: '#a8761a', stroke: '#e0b877' }
  return { fill: '#6b655d', stroke: '#a8a29a' }
}

export default function SpotsMapCanvas({
  lat,
  lon,
  label,
  spots,
  nautical,
  onPick,
  selectedId,
  onSelect,
}: Props) {
  const hostRef = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<L.Map | null>(null)
  const seamarkRef = useRef<L.TileLayer | null>(null)
  const spotLayerRef = useRef<L.LayerGroup | null>(null)
  // Which set of spots we have already framed. Re-fitting on every refresh
  // would yank the map away from wherever the office just panned it.
  const fittedRef = useRef<string>('')
  // Held in a ref so the click handler, bound once, always calls the current
  // callback instead of the one captured on mount.
  const pickRef = useRef(onPick)
  const selectRef = useRef(onSelect)
  useEffect(() => {
    pickRef.current = onPick
    selectRef.current = onSelect
  }, [onPick, onSelect])

  const baseIcon = useMemo(
    () =>
      L.divIcon({
        className: '',
        html: `<div style="width:14px;height:14px;border-radius:9999px;background:#456b49;border:2px solid #fff;box-shadow:0 0 0 4px rgba(69,107,73,.3)"></div>`,
        iconSize: [14, 14],
        iconAnchor: [7, 7],
      }),
    [],
  )

  // --- create the map once ------------------------------------------------
  useEffect(() => {
    if (mapRef.current || !hostRef.current) return

    const map = L.map(hostRef.current, {
      center: [lat, lon],
      zoom: 11,
      zoomControl: true,
      attributionControl: true,
    })

    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 18,
      attribution: '&copy; OpenStreetMap',
    }).addTo(map)

    L.marker([lat, lon], { icon: baseIcon })
      .addTo(map)
      .bindPopup(`<strong>${label}</strong><br/>Base`)

    spotLayerRef.current = L.layerGroup().addTo(map)
    mapRef.current = map

    map.on('click', (e: L.LeafletMouseEvent) => {
      pickRef.current?.(e.latlng.lat, e.latlng.lng)
    })

    return () => {
      map.remove()
      mapRef.current = null
      spotLayerRef.current = null
      seamarkRef.current = null
    }
  }, [lat, lon, label, baseIcon])

  // --- nautical overlay ---------------------------------------------------
  useEffect(() => {
    const map = mapRef.current
    if (!map) return

    if (nautical && !seamarkRef.current) {
      seamarkRef.current = L.tileLayer(
        'https://tiles.openseamap.org/seamark/{z}/{x}/{y}.png',
        { maxZoom: 18, attribution: '&copy; OpenSeaMap' },
      ).addTo(map)
    } else if (!nautical && seamarkRef.current) {
      map.removeLayer(seamarkRef.current)
      seamarkRef.current = null
    }
  }, [nautical])

  // --- spots --------------------------------------------------------------
  useEffect(() => {
    const map = mapRef.current
    const layer = spotLayerRef.current
    if (!map || !layer) return

    layer.clearLayers()

    for (const s of spots) {
      const tone = toneFor(s.catchCount)
      const isSel = s.id === selectedId

      const marker = L.circleMarker([s.lat, s.lon], {
        radius: radiusFor(s.catchCount),
        color: isSel ? '#f8f5ef' : tone.stroke,
        weight: isSel ? 3 : 2,
        fillColor: tone.fill,
        fillOpacity: 0.85,
      })

      const bits = [
        s.catchCount === 0
          ? 'No catches logged yet'
          : `${s.catchCount} ${s.catchCount === 1 ? 'catch' : 'catches'}`,
      ]
      if (s.topSpecies) bits.push(`Mostly ${s.topSpecies}`)
      if (s.bestKg) bits.push(`Best ${s.bestKg} kg`)
      if (s.secret) bits.push('Not shown to guests')

      marker.bindPopup(
        `<strong>${s.name}</strong><br/>${bits.join('<br/>')}`,
      )
      marker.on('click', () => selectRef.current?.(s.id))
      marker.addTo(layer)
    }

    // Frame the spots the first time we see this particular set.
    const key = spots.map((s) => s.id).join(',')
    if (key && key !== fittedRef.current) {
      fittedRef.current = key
      const bounds = L.latLngBounds([
        [lat, lon],
        ...spots.map((s) => [s.lat, s.lon] as [number, number]),
      ])
      map.fitBounds(bounds.pad(0.25), { animate: false })
    }
  }, [spots, selectedId, lat, lon])

  // Pan to a spot chosen in the list, without changing the zoom the office set.
  useEffect(() => {
    const map = mapRef.current
    if (!map || !selectedId) return
    const s = spots.find((x) => x.id === selectedId)
    if (s) map.panTo([s.lat, s.lon], { animate: true })
  }, [selectedId, spots])

  return (
    <div
      ref={hostRef}
      // Real focusable controls live inside, so aria-hidden would leave them
      // reachable by keyboard but unnamed.
      role="application"
      aria-label={`Map of fishing spots around ${label}`}
      className="h-[420px] w-full"
      style={{ cursor: onPick ? 'crosshair' : undefined }}
    />
  )
}
