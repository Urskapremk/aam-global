'use client'

/**
 * GA-style interactive choropleth: countries shaded by page views.
 * Leaflet is imported inside useEffect so the dynamic chunk does not
 * evaluate `window` at module load (same reason parents use ssr:false).
 */

import { useEffect, useRef, useState } from 'react'

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
  const r = Math.round(30 + (20 - 30) * t)
  const g = Math.round(58 + (140 - 58) * t)
  const b = Math.round(95 + (160 - 95) * t)
  return `rgb(${r},${g},${b})`
}

export default function VisitorWorldMap({ countries, lang, labelViews }: Props) {
  const hostRef = useRef<HTMLDivElement | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const host = hostRef.current
    if (!host) return

    let cancelled = false
    let map: import('leaflet').Map | null = null

    const byCode = new Map(
      countries
        .filter((c) => c.country)
        .map((c) => [c.country.toUpperCase(), c.views] as const),
    )
    const max = Math.max(1, ...byCode.values())

    void (async () => {
      try {
        const L = (await import('leaflet')).default
        if (cancelled || !hostRef.current) return

        map = L.map(host, {
          center: [20, 10],
          zoom: 2,
          minZoom: 1,
          maxZoom: 6,
          scrollWheelZoom: true,
          worldCopyJump: true,
          attributionControl: true,
        })

        L.tileLayer(
          'https://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}{r}.png',
          {
            attribution:
              '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/">CARTO</a>',
            subdomains: 'abcd',
            maxZoom: 6,
          },
        ).addTo(map)

        const geoRes = await fetch('/geo/countries.geojson')
        if (!geoRes.ok) throw new Error(`GeoJSON ${geoRes.status}`)
        const geo = (await geoRes.json()) as {
          type: string
          features: {
            type: string
            properties: { iso: string; name: string }
            geometry: object
          }[]
        }
        if (cancelled || !map) return

        L.geoJSON(geo as never, {
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
                const t = e.target as import('leaflet').Path
                t.setStyle({ weight: 2, color: '#0f2744' })
                t.bringToFront()
              },
              mouseout: (e) => {
                const t = e.target as import('leaflet').Path
                const v = byCode.get(iso) ?? 0
                t.setStyle({
                  weight: v > 0 ? 1.2 : 0.4,
                  color: v > 0 ? '#1e3a5f' : '#cfc6b6',
                })
              },
            })
          },
        }).addTo(map)

        window.setTimeout(() => map?.invalidateSize(), 80)
      } catch (err) {
        console.error('[analytics map]', err)
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Map failed to load')
        }
      }
    })()

    return () => {
      cancelled = true
      if (map) {
        map.remove()
        map = null
      }
    }
  }, [countries, lang, labelViews])

  if (error) {
    return (
      <div className="flex h-[min(420px,55vh)] items-center justify-center rounded-xl border border-dashed border-border bg-card px-4 text-center text-sm text-muted-foreground">
        {error}
      </div>
    )
  }

  return (
    <div
      ref={hostRef}
      className="h-[min(420px,55vh)] w-full overflow-hidden rounded-xl border border-border bg-[#f3efe6] [&_.leaflet-container]:h-full [&_.leaflet-container]:w-full [&_.leaflet-container]:bg-[#f3efe6] [&_.aam-analytics-tip]:rounded-md [&_.aam-analytics-tip]:border [&_.aam-analytics-tip]:border-border [&_.aam-analytics-tip]:bg-card [&_.aam-analytics-tip]:px-2 [&_.aam-analytics-tip]:py-1 [&_.aam-analytics-tip]:text-xs [&_.aam-analytics-tip]:text-foreground [&_.aam-analytics-tip]:shadow-md"
    />
  )
}
