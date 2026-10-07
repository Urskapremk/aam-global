'use server'

import { isAdmin } from '@/lib/admin-auth'
import {
  queryPageViewHistory,
  querySiteAnalytics,
  type AnalyticsRange,
  type AnalyticsSummary,
  type PageViewRow,
} from '@/lib/site-analytics'

export async function getSiteAnalytics(
  range: AnalyticsRange = '30d',
): Promise<AnalyticsSummary | null> {
  if (!(await isAdmin())) return null
  return querySiteAnalytics(range)
}

export async function getPageViewHistory(
  range: AnalyticsRange = 'all',
  offset = 0,
): Promise<{ rows: PageViewRow[]; total: number } | null> {
  if (!(await isAdmin())) return null
  return queryPageViewHistory(range, { limit: 50, offset })
}
