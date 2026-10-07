'use client'

/**
 * GA-style interactive choropleth: countries shaded by page views.
 * Leaflet only (same stack as fleet map). Loaded with ssr:false by parent.
 */

import L from 'leaflet'
import { useEffect, useRef } from 'react'

export type MapCountry = { country: string; views: number }

type Props = {
  countries: MapCountry[]
  lang: 'en' | 'sl'
  labelViews: string
}

function countryName(code: string, lang: 'en' | 'sl'): string {
  if (!code) return lang === 'sl' ? 'Neznano' : 'Unknown'
  try {
    return (
      new Intl.DisplayNames([lang === 'sl' ? 'sl' : 'en'], {
        type: 'region',
      }).of(code.toUpperCase()) ?? code.toUpperCase()
    )
  } catch {
    return code.toUpperCase()
  }
}

function colorFor(views: number, max: number): string {
  if (views <= 0 || max <= 0) return '#e8e2d6'
  const t = Math.min(1, Math.sqrt(views / max))
  // Accent navy → teal scale (matches AAM admin, not purple GA default)
  const r = Math.round(30 + (20 - 30) * t)
  const g = Math.round(58 + (140 - 58) * t)
  const b = Math.round(95 + (160 - 95) * t)
  return `rgb(${r},${g},${b})`
}

export default function VisitorWorldMap({ countries, lang, labelViews }: Props) {
  const hostRef = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<L.Map | null>(null)

  useEffect(() => {
    const host = hostRef.current
    if (!host) return

    const byCode = new Map(
      countries
        .filter((c) => c.country)
        .map((c) => [c.country.toUpperCase(), c.views] as const),
    )
    const max = Math.max(1, ...byCode.values())

    if (mapRef.current) {
      mapRef.current.remove()
      mapRef.current = null
    }

    const map = L.map(host, {
      center: [20, 10],
      zoom: 2,
      minZoom: 1,
      maxZoom: 6,
      scrollWheelZoom: true,
      worldCopyJump: true,
      attributionControl: true,
    })
    mapRef.current = map

    L.tileLayer(
      'https://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}{r}.png',
      {
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/">CARTO</a>',
        subdomains: 'abcd',
        maxZoom: 6,
      },
    ).addTo(map)

    let cancelled = false
    const layerGroup = L.layerGroup().addTo(map)

    void fetch('/geo/countries.geojson')
      .then((r) => r.json())
      .then(
        (geo: {
          features: {
            properties: { iso: string; name: string }
            geometry: GeoJSON.Geometry
          }[]
        }) => {
          if (cancelled || !mapRef.current) return
          const layer = L.geoJSON(geo as GeoJSON.GeoJsonObject, {
            style: (feature) => {
              const iso = (
                feature?.properties as { iso?: string } | undefined
              )?.iso?.toUpperCase()
              const views = iso ? (byCode.get(iso) ?? 0) : 0
              return {
                fillColor: colorFor(views, max),
                weight: views > 0 ? 1.2 : 0.4,
                opacity: 1,
                color: views > 0 ? '#1e3a5f' : '#cfc6b6',
                fillOpacity: views > 0 ? 0.85 : 0.35,
              }
            },
            onEachFeature: (feature, lyr) => {
              const iso = (
                feature.properties as { iso?: string } | undefined
              )?.iso?.toUpperCase()
              if (!iso) return
              const views = byCode.get(iso) ?? 0
              const name = countryName(iso, lang)
              lyr.bindTooltip(
                `<strong>${name}</strong><br/>${labelViews}: ${views.toLocaleString(
                  lang === 'sl' ? 'sl-SI' : 'en-GB',
                )}`,
                { sticky: true, className: 'aam-analytics-tip' },
              )
              lyr.on({
                mouseover: (e) => {
                  const t = e.target as L.Path
                  t.setStyle({ weight: 2, color: '#0f2744' })
                  t.bringToFront()
                },
                mouseout: (e) => {
                  const t = e.target as L.Path
                  const v = byCode.get(iso) ?? 0
                  t.setStyle({
                    weight: v > 0 ? 1.2 : 0.4,
                    color: v > 0 ? '#1e3a5f' : '#cfc6b6',
                  })
                },
              })
            },
          })
          layerGroup.addLayer(layer)
        },
      )
      .catch((err) => console.error('[analytics map]', err))

    const onResize = () => map.invalidateSize()
    window.addEventListener('resize', onResize)
    // Leaflet often needs a tick after layout.
    const t = window.setTimeout(() => map.invalidateSize(), 80)

    return () => {
      cancelled = true
      window.clearTimeout(t)
      window.removeEventListener('resize', onResize)
      map.remove()
      mapRef.current = null
    }
  }, [countries, lang, labelViews])

  return (
    <div
      ref={hostRef}
      className="h-[min(420px,55vh)] w-full overflow-hidden rounded-xl border border-border bg-[#f3efe6] [&_.leaflet-container]:h-full [&_.leaflet-container]:w-full [&_.leaflet-container]:bg-[#f3efe6] [&_.aam-analytics-tip]:rounded-md [&_.aam-analytics-tip]:border [&_.aam-analytics-tip]:border-border [&_.aam-analytics-tip]:bg-card [&_.aam-analytics-tip]:px-2 [&_.aam-analytics-tip]:py-1 [&_.aam-analytics-tip]:text-xs [&_.aam-analytics-tip]:text-foreground [&_.aam-analytics-tip]:shadow-md"
    />
  )
}
