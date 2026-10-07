'use client'

/**
 * GA-style interactive choropleth shell.
 * Leaflet lives in ./visitor-world-map-engine so this next/dynamic entry
 * can mount immediately (replace "…") without waiting on the Leaflet chunk.
 */

import { useEffect, useRef, useState } from 'react'

export type MapCountry = { country: string; views: number }

type Props = {
  countries: MapCountry[]
  lang: 'en' | 'sl'
  labelViews: string
}

export default function VisitorWorldMap({ countries, lang, labelViews }: Props) {
  const hostRef = useRef<HTMLDivElement | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const host = hostRef.current
    if (!host) return

    let cancelled = false
    let dispose: (() => void) | undefined

    void import('./visitor-world-map-engine')
      .then(({ mountVisitorMap }) => {
        if (cancelled || !hostRef.current) return
        return mountVisitorMap(hostRef.current, {
          countries,
          lang,
          labelViews,
        })
      })
      .then((d) => {
        if (cancelled) {
          d?.()
          return
        }
        dispose = d
      })
      .catch((err: unknown) => {
        console.error('[analytics map]', err)
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Map failed to load')
        }
      })

    return () => {
      cancelled = true
      dispose?.()
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
