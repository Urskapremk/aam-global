import { NextResponse } from 'next/server'
import { pool } from '@/lib/db'
import { ensureSitePageViewsTable } from '@/lib/site-analytics'

export const runtime = 'nodejs'

/**
 * Lightweight page-view collector for the public site.
 * Geo comes from Vercel edge headers on the visitor's request
 * (x-vercel-ip-country / region / city). Empty locally / off-Vercel.
 */
export async function POST(request: Request) {
  let path = '/'
  let referrer = ''
  try {
    const body = (await request.json()) as {
      path?: unknown
      referrer?: unknown
    }
    if (typeof body.path === 'string' && body.path.startsWith('/')) {
      path = body.path.slice(0, 500)
    }
    if (typeof body.referrer === 'string') {
      referrer = body.referrer.slice(0, 500)
    }
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 })
  }

  // Skip admin / API noise if a beacon somehow fires there.
  if (
    path.startsWith('/admin') ||
    path.startsWith('/api') ||
    path.startsWith('/_next')
  ) {
    return NextResponse.json({ ok: true, skipped: true })
  }

  const country = (
    request.headers.get('x-vercel-ip-country') ||
    request.headers.get('x-vercel-ip-country-code') ||
    ''
  )
    .toUpperCase()
    .slice(0, 8)
  const region = (request.headers.get('x-vercel-ip-country-region') || '').slice(
    0,
    64,
  )
  const city = decodeHeader(request.headers.get('x-vercel-ip-city')).slice(
    0,
    128,
  )

  try {
    await ensureSitePageViewsTable()
    await pool.query(
      `INSERT INTO site_page_views (path, country, region, city, referrer)
       VALUES ($1, $2, $3, $4, $5)`,
      [path, country, region, city, referrer],
    )
  } catch (err) {
    console.error('[analytics] collect failed', err)
    // Don't break the visitor experience.
    return NextResponse.json({ ok: false }, { status: 204 })
  }

  return NextResponse.json({ ok: true })
}

function decodeHeader(value: string | null): string {
  if (!value) return ''
  try {
    return decodeURIComponent(value)
  } catch {
    return value
  }
}
