'use client'

import { useEffect, useRef } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'

/**
 * Sends a page-view beacon for public routes. Geo is resolved server-side
 * from Vercel IP headers on /api/analytics/collect.
 */
export function AnalyticsBeacon() {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const lastKey = useRef('')

  useEffect(() => {
    if (!pathname || pathname.startsWith('/admin')) return
    const qs = searchParams?.toString()
    const path = qs ? `${pathname}?${qs}` : pathname
    const key = path
    if (key === lastKey.current) return
    lastKey.current = key

    const payload = JSON.stringify({
      path: pathname,
      referrer: typeof document !== 'undefined' ? document.referrer : '',
    })

    try {
      if (typeof navigator !== 'undefined' && navigator.sendBeacon) {
        const blob = new Blob([payload], { type: 'application/json' })
        navigator.sendBeacon('/api/analytics/collect', blob)
        return
      }
    } catch {
      /* fall through */
    }

    void fetch('/api/analytics/collect', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: payload,
      keepalive: true,
    }).catch(() => {})
  }, [pathname, searchParams])

  return null
}
