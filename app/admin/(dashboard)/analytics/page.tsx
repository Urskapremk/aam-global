import { SiteAnalyticsPanel } from '@/components/admin/site-analytics-panel'
import {
  queryPageViewHistory,
  querySiteAnalytics,
} from '@/lib/site-analytics'
import { getLang } from '@/lib/i18n/server'
import { translate } from '@/lib/i18n/translations'

export default async function AdminAnalyticsPage() {
  const lang = await getLang()
  const t = (s: string) => translate(lang, s)
  const [initial, initialHistory] = await Promise.all([
    querySiteAnalytics('all'),
    queryPageViewHistory('all', { limit: 50, offset: 0 }),
  ])

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="flex items-center gap-3 text-[11px] font-medium uppercase tracking-[0.3em] text-accent">
            <span className="h-px w-8 bg-accent" />
            {t('Website')}
          </p>
          <h1 className="mt-2 font-serif text-3xl font-medium text-foreground lg:text-4xl">
            {t('Analytics')}
          </h1>
          <p className="mt-1 max-w-xl text-sm text-muted-foreground">
            {t(
              'Where people view the public site from — interactive map, trends, and full view history.',
            )}
          </p>
        </div>
      </div>

      <SiteAnalyticsPanel initial={initial} initialHistory={initialHistory} />
    </div>
  )
}
