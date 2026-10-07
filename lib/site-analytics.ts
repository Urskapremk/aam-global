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

export type AnalyticsRange = '7d' | '30d' | '90d'

export function rangeToSince(range: AnalyticsRange): Date {
  const days = range === '7d' ? 7 : range === '90d' ? 90 : 30
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
  topCountries: { country: string; views: number }[]
  topPages: { path: string; views: number }[]
  topReferrers: { referrer: string; views: number }[]
  byDay: { day: string; views: number }[]
}

export async function querySiteAnalytics(
  range: AnalyticsRange,
): Promise<AnalyticsSummary> {
  await ensureSitePageViewsTable()
  const since = rangeToSince(range)

  const [totals, countries, pages, referrers, days] = await Promise.all([
    pool.query<{ page_views: string; countries: string }>(
      `SELECT COUNT(*)::text AS page_views,
              COUNT(DISTINCT NULLIF(country, ''))::text AS countries
         FROM site_page_views
        WHERE "createdAt" >= $1`,
      [since],
    ),
    pool.query<{ country: string; views: string }>(
      `SELECT COALESCE(NULLIF(country, ''), '') AS country, COUNT(*)::text AS views
         FROM site_page_views
        WHERE "createdAt" >= $1
        GROUP BY 1
        ORDER BY COUNT(*) DESC
        LIMIT 15`,
      [since],
    ),
    pool.query<{ path: string; views: string }>(
      `SELECT path, COUNT(*)::text AS views
         FROM site_page_views
        WHERE "createdAt" >= $1
        GROUP BY path
        ORDER BY COUNT(*) DESC
        LIMIT 15`,
      [since],
    ),
    pool.query<{ referrer: string; views: string }>(
      `SELECT CASE
                WHEN referrer = '' OR referrer IS NULL THEN ''
                ELSE regexp_replace(referrer, '^https?://([^/]+).*$', '\\1')
              END AS referrer,
              COUNT(*)::text AS views
         FROM site_page_views
        WHERE "createdAt" >= $1
        GROUP BY 1
        ORDER BY COUNT(*) DESC
        LIMIT 10`,
      [since],
    ),
    pool.query<{ day: string; views: string }>(
      `SELECT to_char(date_trunc('day', "createdAt"), 'YYYY-MM-DD') AS day,
              COUNT(*)::text AS views
         FROM site_page_views
        WHERE "createdAt" >= $1
        GROUP BY 1
        ORDER BY 1 ASC`,
      [since],
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
  }
}
