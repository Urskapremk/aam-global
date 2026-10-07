import 'server-only'

import { pool } from '@/lib/db'

let tableReady: Promise<void> | null = null

/** Create the page-views table once (same pattern as shop column ensures). */
export function ensureSitePageViewsTable() {
  tableReady ??= (async () => {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS site_page_views (
        id serial PRIMARY KEY,
        path text NOT NULL,
        country text NOT NULL DEFAULT '',
        region text NOT NULL DEFAULT '',
        city text NOT NULL DEFAULT '',
        referrer text NOT NULL DEFAULT '',
        "createdAt" timestamp NOT NULL DEFAULT now()
      )
    `)
    await pool.query(
      `CREATE INDEX IF NOT EXISTS site_page_views_created_at_idx ON site_page_views ("createdAt")`,
    )
    await pool.query(
      `CREATE INDEX IF NOT EXISTS site_page_views_country_idx ON site_page_views (country)`,
    )
    await pool.query(
      `CREATE INDEX IF NOT EXISTS site_page_views_path_idx ON site_page_views (path)`,
    )
  })().catch((e) => {
    tableReady = null
    throw e
  })
  return tableReady
}

export type AnalyticsRange = '7d' | '30d' | '90d' | '365d' | 'all'

export function rangeToSince(range: AnalyticsRange): Date | null {
  if (range === 'all') return null
  const days =
    range === '7d' ? 7 : range === '90d' ? 90 : range === '365d' ? 365 : 30
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000)
}

export function countryLabel(code: string, lang: 'en' | 'sl' = 'en'): string {
  if (!code) return lang === 'sl' ? 'Neznano / lokalno' : 'Unknown / local'
  try {
    const dn = new Intl.DisplayNames([lang === 'sl' ? 'sl' : 'en'], {
      type: 'region',
    })
    return dn.of(code.toUpperCase()) ?? code.toUpperCase()
  } catch {
    return code.toUpperCase()
  }
}

export type AnalyticsSummary = {
  range: AnalyticsRange
  pageViews: number
  uniqueCountries: number
  /** All countries with views (for map + lists). */
  topCountries: { country: string; views: number }[]
  topPages: { path: string; views: number }[]
  topReferrers: { referrer: string; views: number }[]
  byDay: { day: string; views: number }[]
  /** Oldest recorded view in this range (ISO), if any. */
  firstSeen: string | null
  lastSeen: string | null
}

export type PageViewRow = {
  id: number
  path: string
  country: string
  region: string
  city: string
  referrer: string
  createdAt: string
}

function sinceClause(since: Date | null): { sql: string; params: unknown[] } {
  if (!since) return { sql: '', params: [] }
  return { sql: `WHERE "createdAt" >= $1`, params: [since] }
}

export async function querySiteAnalytics(
  range: AnalyticsRange,
): Promise<AnalyticsSummary> {
  await ensureSitePageViewsTable()
  const since = rangeToSince(range)
  const { sql: where, params } = sinceClause(since)

  const [totals, countries, pages, referrers, days, span] = await Promise.all([
    pool.query<{ page_views: string; countries: string }>(
      `SELECT COUNT(*)::text AS page_views,
              COUNT(DISTINCT NULLIF(country, ''))::text AS countries
         FROM site_page_views
         ${where}`,
      params,
    ),
    pool.query<{ country: string; views: string }>(
      `SELECT COALESCE(NULLIF(country, ''), '') AS country, COUNT(*)::text AS views
         FROM site_page_views
         ${where}
        GROUP BY 1
        ORDER BY COUNT(*) DESC`,
      params,
    ),
    pool.query<{ path: string; views: string }>(
      `SELECT path, COUNT(*)::text AS views
         FROM site_page_views
         ${where}
        GROUP BY path
        ORDER BY COUNT(*) DESC
        LIMIT 25`,
      params,
    ),
    pool.query<{ referrer: string; views: string }>(
      `SELECT CASE
                WHEN referrer = '' OR referrer IS NULL THEN ''
                ELSE regexp_replace(referrer, '^https?://([^/]+).*$', '\\1')
              END AS referrer,
              COUNT(*)::text AS views
         FROM site_page_views
         ${where}
        GROUP BY 1
        ORDER BY COUNT(*) DESC
        LIMIT 15`,
      params,
    ),
    pool.query<{ day: string; views: string }>(
      `SELECT to_char(date_trunc('day', "createdAt"), 'YYYY-MM-DD') AS day,
              COUNT(*)::text AS views
         FROM site_page_views
         ${where}
        GROUP BY 1
        ORDER BY 1 ASC`,
      params,
    ),
    pool.query<{ first_seen: Date | null; last_seen: Date | null }>(
      `SELECT MIN("createdAt") AS first_seen, MAX("createdAt") AS last_seen
         FROM site_page_views
         ${where}`,
      params,
    ),
  ])

  return {
    range,
    pageViews: Number(totals.rows[0]?.page_views ?? 0),
    uniqueCountries: Number(totals.rows[0]?.countries ?? 0),
    topCountries: countries.rows.map((r) => ({
      country: r.country,
      views: Number(r.views),
    })),
    topPages: pages.rows.map((r) => ({
      path: r.path,
      views: Number(r.views),
    })),
    topReferrers: referrers.rows.map((r) => ({
      referrer: r.referrer,
      views: Number(r.views),
    })),
    byDay: days.rows.map((r) => ({
      day: r.day,
      views: Number(r.views),
    })),
    firstSeen: span.rows[0]?.first_seen
      ? new Date(span.rows[0].first_seen).toISOString()
      : null,
    lastSeen: span.rows[0]?.last_seen
      ? new Date(span.rows[0].last_seen).toISOString()
      : null,
  }
}

export async function queryPageViewHistory(
  range: AnalyticsRange,
  opts: { limit?: number; offset?: number } = {},
): Promise<{ rows: PageViewRow[]; total: number }> {
  await ensureSitePageViewsTable()
  const since = rangeToSince(range)
  const limit = Math.min(Math.max(opts.limit ?? 50, 1), 200)
  const offset = Math.max(opts.offset ?? 0, 0)

  const params: unknown[] = []
  let where = ''
  if (since) {
    params.push(since)
    where = `WHERE "createdAt" >= $${params.length}`
  }
  params.push(limit)
  const limitIdx = params.length
  params.push(offset)
  const offsetIdx = params.length

  const [list, count] = await Promise.all([
    pool.query<{
      id: number
      path: string
      country: string
      region: string
      city: string
      referrer: string
      createdAt: Date
    }>(
      `SELECT id, path, country, region, city, referrer, "createdAt"
         FROM site_page_views
         ${where}
        ORDER BY "createdAt" DESC, id DESC
        LIMIT $${limitIdx} OFFSET $${offsetIdx}`,
      params,
    ),
    pool.query<{ total: string }>(
      `SELECT COUNT(*)::text AS total FROM site_page_views ${where}`,
      since ? [since] : [],
    ),
  ])

  return {
    total: Number(count.rows[0]?.total ?? 0),
    rows: list.rows.map((r) => ({
      id: r.id,
      path: r.path,
      country: r.country,
      region: r.region,
      city: r.city,
      referrer: r.referrer,
      createdAt: new Date(r.createdAt).toISOString(),
    })),
  }
}
