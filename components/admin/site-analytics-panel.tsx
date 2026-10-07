'use client'

import { useEffect, useMemo, useState, useTransition } from 'react'
import { Globe2, Eye, MapPinned, ExternalLink } from 'lucide-react'
import { getSiteAnalytics } from '@/app/actions/site-analytics'
import { useLang, useT } from '@/lib/i18n/context'
import { cn } from '@/lib/utils'
import type { AnalyticsRange, AnalyticsSummary } from '@/lib/site-analytics'

const RANGES: AnalyticsRange[] = ['7d', '30d', '90d']

function countryName(code: string, lang: 'en' | 'sl'): string {
  if (!code) return lang === 'sl' ? 'Neznano / lokalno' : 'Unknown / local'
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

export function SiteAnalyticsPanel({
  initial,
}: {
  initial: AnalyticsSummary
}) {
  const t = useT()
  const lang = useLang()
  const [range, setRange] = useState<AnalyticsRange>(initial.range)
  const [data, setData] = useState(initial)
  const [pending, startTransition] = useTransition()

  useEffect(() => {
    if (range === data.range) return
    startTransition(async () => {
      const next = await getSiteAnalytics(range)
      if (next) setData(next)
    })
  }, [range, data.range])

  const maxCountry = useMemo(
    () => Math.max(1, ...data.topCountries.map((c) => c.views)),
    [data.topCountries],
  )
  const maxPage = useMemo(
    () => Math.max(1, ...data.topPages.map((p) => p.views)),
    [data.topPages],
  )
  const maxDay = useMemo(
    () => Math.max(1, ...data.byDay.map((d) => d.views)),
    [data.byDay],
  )

  return (
    <div className={cn('space-y-6', pending && 'opacity-70')}>
      <div className="flex flex-wrap items-center gap-2">
        {RANGES.map((r) => (
          <button
            key={r}
            type="button"
            onClick={() => setRange(r)}
            className={cn(
              'rounded-lg border px-3 py-2 text-sm font-medium transition-colors',
              range === r
                ? 'border-accent bg-accent/10 text-foreground'
                : 'border-border text-muted-foreground hover:text-foreground',
            )}
          >
            {t(r === '7d' ? 'Last 7 days' : r === '30d' ? 'Last 30 days' : 'Last 90 days')}
          </button>
        ))}
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard
          icon={Eye}
          label={t('Page views')}
          value={data.pageViews.toLocaleString(lang === 'sl' ? 'sl-SI' : 'en-GB')}
        />
        <StatCard
          icon={Globe2}
          label={t('Countries')}
          value={String(data.uniqueCountries)}
        />
        <StatCard
          icon={MapPinned}
          label={t('Top country')}
          value={
            data.topCountries[0]
              ? countryName(data.topCountries[0].country, lang)
              : '—'
          }
        />
      </div>

      {data.pageViews === 0 && (
        <div className="rounded-2xl border border-dashed border-border bg-card p-8 text-sm text-muted-foreground">
          <p className="font-medium text-foreground">{t('No traffic recorded yet')}</p>
          <p className="mt-2">
            {t(
              'Views are collected when visitors open public pages on the live site (Vercel). Local/dev visits usually have no country.',
            )}
          </p>
          <p className="mt-3">
            <a
              href="https://vercel.com/docs/analytics"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-accent hover:underline"
            >
              {t('Also see Vercel Web Analytics')}
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          </p>
        </div>
      )}

      {data.byDay.length > 0 && (
        <section className="rounded-2xl border border-border bg-card p-5">
          <h2 className="font-serif text-xl text-foreground">{t('Daily page views')}</h2>
          <div className="mt-4 flex h-36 items-end gap-1">
            {data.byDay.map((d) => (
              <div
                key={d.day}
                className="group relative flex flex-1 flex-col items-center justify-end"
                title={`${d.day}: ${d.views}`}
              >
                <div
                  className="w-full min-h-[4px] rounded-t bg-accent/80 transition-colors group-hover:bg-accent"
                  style={{ height: `${Math.max(4, (d.views / maxDay) * 100)}%` }}
                />
              </div>
            ))}
          </div>
          <div className="mt-2 flex justify-between text-[11px] text-muted-foreground">
            <span>{data.byDay[0]?.day}</span>
            <span>{data.byDay[data.byDay.length - 1]?.day}</span>
          </div>
        </section>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <RankList
          title={t('Where visitors view from')}
          empty={t('No country data yet')}
          rows={data.topCountries.map((c) => ({
            key: c.country || 'local',
            label: countryName(c.country, lang),
            sub: c.country ? c.country.toUpperCase() : undefined,
            views: c.views,
            max: maxCountry,
          }))}
        />
        <RankList
          title={t('Top pages')}
          empty={t('No pages yet')}
          rows={data.topPages.map((p) => ({
            key: p.path,
            label: p.path,
            views: p.views,
            max: maxPage,
          }))}
        />
      </div>

      {data.topReferrers.some((r) => r.referrer) && (
        <section className="rounded-2xl border border-border bg-card p-5">
          <h2 className="font-serif text-xl text-foreground">{t('Top referrers')}</h2>
          <ul className="mt-4 divide-y divide-border">
            {data.topReferrers
              .filter((r) => r.referrer)
              .map((r) => (
                <li
                  key={r.referrer}
                  className="flex items-center justify-between gap-3 py-2.5 text-sm"
                >
                  <span className="truncate text-foreground">{r.referrer}</span>
                  <span className="tabular-nums text-muted-foreground">
                    {r.views}
                  </span>
                </li>
              ))}
          </ul>
        </section>
      )}
    </div>
  )
}

function StatCard({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Eye
  label: string
  value: string
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">
        <Icon className="h-3.5 w-3.5 text-accent" strokeWidth={1.5} />
        {label}
      </div>
      <p className="mt-2 font-serif text-3xl text-foreground">{value}</p>
    </div>
  )
}

function RankList({
  title,
  empty,
  rows,
}: {
  title: string
  empty: string
  rows: {
    key: string
    label: string
    sub?: string
    views: number
    max: number
  }[]
}) {
  return (
    <section className="rounded-2xl border border-border bg-card p-5">
      <h2 className="font-serif text-xl text-foreground">{title}</h2>
      {rows.length === 0 ? (
        <p className="mt-4 text-sm text-muted-foreground">{empty}</p>
      ) : (
        <ul className="mt-4 flex flex-col gap-3">
          {rows.map((r) => (
            <li key={r.key}>
              <div className="mb-1 flex items-baseline justify-between gap-2 text-sm">
                <span className="truncate font-medium text-foreground">
                  {r.label}
                  {r.sub ? (
                    <span className="ml-2 text-xs font-normal text-muted-foreground">
                      {r.sub}
                    </span>
                  ) : null}
                </span>
                <span className="tabular-nums text-muted-foreground">{r.views}</span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-secondary">
                <div
                  className="h-full rounded-full bg-accent/80"
                  style={{ width: `${(r.views / r.max) * 100}%` }}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
