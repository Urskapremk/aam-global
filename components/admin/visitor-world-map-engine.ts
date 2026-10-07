/**
 * Leaflet choropleth engine — kept in a separate module so the
 * next/dynamic entry for VisitorWorldMap does not wait on Leaflet.
 */

import L from 'leaflet'
import type { MapCountry } from './visitor-world-map'

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

export type MountVisitorMapOpts = {
  countries: MapCountry[]
  lang: 'en' | 'sl'
  labelViews: string
}

/** Mount map into host; returns disposer. */
export async function mountVisitorMap(
  host: HTMLElement,
  { countries, lang, labelViews }: MountVisitorMapOpts,
): Promise<() => void> {
  const byCode = new Map(
    countries
      .filter((c) => c.country)
      .map((c) => [c.country.toUpperCase(), c.views] as const),
  )
  const max = Math.max(1, ...byCode.values())

  const map = L.map(host, {
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
  const geo: unknown = await geoRes.json()

  L.geoJSON(geo as unknown as GeoJSON.GeoJsonObject, {
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
  }).addTo(map)

  const t = window.setTimeout(() => map.invalidateSize(), 80)

  return () => {
    window.clearTimeout(t)
    map.remove()
  }
}
