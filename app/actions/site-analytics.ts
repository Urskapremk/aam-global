'use server'

import { isAdmin } from '@/lib/admin-auth'
import {
  querySiteAnalytics,
  type AnalyticsRange,
  type AnalyticsSummary,
} from '@/lib/site-analytics'

export async function getSiteAnalytics(
  range: AnalyticsRange = '30d',
): Promise<AnalyticsSummary | null> {
  if (!(await isAdmin())) return null
  return querySiteAnalytics(range)
}
