'use client'

import {
  ChevronLeft,
  ChevronRight,
  Fish,
  Loader2,
  Ship,
  Users,
} from 'lucide-react'
import { useState } from 'react'
import useSWR from 'swr'

import { getMonthlyReport, getReportMonths } from '@/app/actions/reports'
import { getFxRates } from '@/app/actions/fuel'
import { fxHint } from '@/lib/currency'

const nf = new Intl.NumberFormat('en-GB')
const eur = (n: number) => `€${nf.format(Math.round(n))}`
const ar = (n: number) => `${nf.format(Math.round(n))} Ar`

/** A single headline number, or an honest "Not recorded" when the metric has
 *  no data for the month — never a 0 that would read as "we did nothing". */
function Stat({
  label,
  value,
  sub,
  missing,
}: {
  label: string
  value?: string | number
  sub?: string
  missing?: string
}) {
  return (
    <div className="rounded-xl border border-border bg-background/40 p-4">
      <p className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
        {label}
      </p>
      {missing ? (
        <>
          <p className="mt-1.5 text-base font-medium text-muted-foreground/70">
            Not recorded
          </p>
          <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground/60">
            {missing}
          </p>
        </>
      ) : (
        <>
          <p className="mt-1 text-2xl font-medium tabular-nums text-foreground">
            {value}
          </p>
          {sub && (
            <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground">
              {sub}
            </p>
          )}
        </>
      )}
    </div>
  )
}

function SectionCard({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <section className="overflow-hidden rounded-2xl border border-border bg-card">
      <header className="bg-panel-header px-5 py-3">
        <h2 className="font-serif text-lg text-panel-header-foreground">{title}</h2>
      </header>
      <div className="p-5">{children}</div>
    </section>
  )
}

/** A labelled count list (by boat, by purpose, species). */
function Breakdown({
  rows,
}: {
  rows: { key: string; label: string; count: number }[]
}) {
  if (!rows.length) {
    return <p className="text-sm text-muted-foreground">Nothing this month.</p>
  }
  const max = Math.max(...rows.map((r) => r.count))
  return (
    <ul className="space-y-2">
      {rows.map((r) => (
        <li key={r.key} className="flex items-center gap-3">
          <span className="w-28 flex-shrink-0 truncate text-sm text-foreground">
            {r.label}
          </span>
          <span className="relative h-2 flex-1 overflow-hidden rounded-full bg-background/60">
            <span
              className="absolute inset-y-0 left-0 rounded-full bg-accent"
              style={{ width: `${(r.count / max) * 100}%` }}
            />
          </span>
          <span className="w-8 flex-shrink-0 text-right text-sm font-medium tabular-nums text-foreground">
            {r.count}
          </span>
        </li>
      ))}
    </ul>
  )
}

export function ReportTab() {
  const months = useSWR('report-months', () => getReportMonths())
  const [month, setMonth] = useState<string | null>(null)

  // Default to the newest month once the list loads, without an effect: the
  // chosen month wins as soon as the captain picks one.
  const list = months.data ?? []
  const active = month ?? list[0] ?? null

  const report = useSWR(active ? ['report', active] : null, () =>
    getMonthlyReport(active as string),
  )
  // Live EUR + Rand reference for the Ariary spend. Shared 'fx-rates' key.
  const fx = useSWR('fx-rates', () => getFxRates())
  const rates = fx.data

  const idx = active ? list.indexOf(active) : -1
  // The list is newest-first, so "older" is a higher index, "newer" is lower.
  const older = idx >= 0 && idx < list.length - 1 ? list[idx + 1] : null
  const newer = idx > 0 ? list[idx - 1] : null

  const r = report.data

  return (
    <div className="space-y-6">
      {/* Month switcher */}
      <div className="flex items-center justify-between gap-3 rounded-2xl border border-border bg-card px-4 py-3">
        <button
          type="button"
          disabled={!older}
          onClick={() => older && setMonth(older)}
          className="flex h-10 w-10 items-center justify-center rounded-full border border-border text-foreground transition disabled:cursor-not-allowed disabled:opacity-30 enabled:hover:bg-background/60 enabled:cursor-pointer"
          aria-label="Previous month"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
        <div className="text-center">
          <p className="text-[10px] uppercase tracking-[0.22em] text-accent">
            Owner report
          </p>
          <p className="mt-0.5 font-serif text-xl text-foreground">
            {r?.label ?? (active ? active : '—')}
          </p>
        </div>
        <button
          type="button"
          disabled={!newer}
          onClick={() => newer && setMonth(newer)}
          className="flex h-10 w-10 items-center justify-center rounded-full border border-border text-foreground transition disabled:cursor-not-allowed disabled:opacity-30 enabled:hover:bg-background/60 enabled:cursor-pointer"
          aria-label="Next month"
        >
          <ChevronRight className="h-5 w-5" />
        </button>
      </div>

      {report.isLoading || !r ? (
        <div className="flex items-center justify-center rounded-2xl border border-border bg-card py-16 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      ) : (
        <>
          {/* Thin-data honesty: real numbers, but no pretending it's a trend. */}
          {r.thin && (
            <p
              className="rounded-xl border px-4 py-3 text-sm"
              style={{
                borderColor: 'color-mix(in oklch, var(--accent) 40%, transparent)',
                backgroundColor: 'color-mix(in oklch, var(--accent) 8%, transparent)',
                color: 'var(--foreground)',
              }}
            >
              Only {r.activity.completed}{' '}
              {r.activity.completed === 1 ? 'trip' : 'trips'} completed this month
              — enough to log, too few to read as a trend.
            </p>
          )}

          <SectionCard title="Activity">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
              <Stat
                label="Trips"
                value={r.activity.completed}
                sub={
                  r.activity.trips > r.activity.completed
                    ? `${r.activity.trips - r.activity.completed} still open`
                    : 'all completed'
                }
              />
              <Stat label="Guests carried" value={r.activity.guests} />
              <Stat
                label="Engine hours"
                value={r.activity.engineHours ?? undefined}
                sub={
                  r.activity.engineHours != null
                    ? `over ${r.activity.engineHoursTrips} ${
                        r.activity.engineHoursTrips === 1 ? 'trip' : 'trips'
                      }`
                    : undefined
                }
                missing={
                  r.activity.engineHours == null
                    ? 'no trip logged start/end hours'
                    : undefined
                }
              />
              <Stat
                label="Distance"
                value={
                  r.activity.distanceNm != null
                    ? `${r.activity.distanceNm} nm`
                    : undefined
                }
                missing={
                  r.activity.distanceNm == null ? 'no track recorded' : undefined
                }
              />
              <Stat
                label="Fuel / trip"
                value={
                  r.activity.fuelAvgPct != null
                    ? `${r.activity.fuelAvgPct}%`
                    : undefined
                }
                sub={
                  r.activity.fuelAvgPct != null
                    ? 'avg tank burned (not litres)'
                    : undefined
                }
                missing={
                  r.activity.fuelAvgPct == null
                    ? 'no fuel levels logged'
                    : undefined
                }
              />
            </div>

            <div className="mt-5 grid gap-6 sm:grid-cols-2">
              <div>
                <p className="mb-3 flex items-center gap-2 text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                  <Ship className="h-3.5 w-3.5" /> By boat
                </p>
                <Breakdown
                  rows={r.activity.byBoat.map((b) => ({
                    key: b.boat,
                    label: b.name,
                    count: b.count,
                  }))}
                />
              </div>
              <div>
                <p className="mb-3 flex items-center gap-2 text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                  <Users className="h-3.5 w-3.5" /> By purpose
                </p>
                <Breakdown
                  rows={r.activity.byPurpose.map((p) => ({
                    key: p.purpose,
                    label: p.label,
                    count: p.count,
                  }))}
                />
              </div>
            </div>
          </SectionCard>

          <SectionCard title="Fishing">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Stat label="Fish landed" value={r.fishing.total} />
              <Stat label="Kept" value={r.fishing.kept} />
              <Stat label="Released" value={r.fishing.released} />
              <Stat
                label="Best day"
                value={
                  r.fishing.bestDay
                    ? new Date(r.fishing.bestDay.date).toLocaleDateString('en-GB', {
                        day: 'numeric',
                        month: 'short',
                      })
                    : undefined
                }
                sub={
                  r.fishing.bestDay
                    ? `${r.fishing.bestDay.count} fish`
                    : undefined
                }
                missing={r.fishing.bestDay ? undefined : 'no catches'}
              />
            </div>
            <div className="mt-5">
              <p className="mb-3 flex items-center gap-2 text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                <Fish className="h-3.5 w-3.5" /> Top species
              </p>
              <Breakdown
                rows={r.fishing.topSpecies.map((s) => ({
                  key: s.species,
                  label: s.species,
                  count: s.count,
                }))}
              />
            </div>
          </SectionCard>

          {/* Income and spend sit side by side but are NEVER summed: income is
              billed in EUR and spend in Ar, and netting one against the other
              is a business decision the owner has not asked for. Two currencies,
              two columns, stated plainly. The Ar spend does carry an EUR + Rand
              reference line so its size is legible to a EUR-thinking reader. */}
          <SectionCard title="Money">
            <div className="grid gap-6 sm:grid-cols-2">
              <div className="rounded-xl border border-border bg-background/40 p-4">
                <p className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                  Income · EUR
                </p>
                <p className="mt-1 text-2xl font-medium tabular-nums text-foreground">
                  {eur(r.revenue.earnedEur)}
                </p>
                <p className="mt-0.5 text-[11px] text-muted-foreground">
                  received · {eur(r.revenue.bookedEur)} booked across{' '}
                  {r.revenue.confirmed} confirmed{' '}
                  {r.revenue.confirmed === 1 ? 'trip' : 'trips'}
                </p>
                {r.revenue.pricesMissing > 0 && (
                  <p
                    className="mt-2 rounded-lg px-2.5 py-1.5 text-[11px] leading-snug"
                    style={{
                      backgroundColor:
                        'color-mix(in oklch, var(--accent) 10%, transparent)',
                      color: 'var(--foreground)',
                    }}
                  >
                    {r.revenue.pricesMissing} confirmed{' '}
                    {r.revenue.pricesMissing === 1 ? 'trip has' : 'trips have'} no
                    price set — income above is understated by that much.
                  </p>
                )}
              </div>
              <div className="rounded-xl border border-border bg-background/40 p-4">
                <p className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                  Maintenance spend · Ar
                </p>
                <p className="mt-1 text-2xl font-medium tabular-nums text-foreground">
                  {ar(r.costs.maintenanceAr)}
                </p>
                {r.costs.maintenanceAr > 0 &&
                  fxHint(r.costs.maintenanceAr, rates, 'en') && (
                    <p className="mt-0.5 text-[11px] tabular-nums text-muted-foreground">
                      {fxHint(r.costs.maintenanceAr, rates, 'en')}
                    </p>
                  )}
                <p className="mt-0.5 text-[11px] text-muted-foreground">
                  {r.costs.maintenanceItems}{' '}
                  {r.costs.maintenanceItems === 1 ? 'job' : 'jobs'} with a cost
                  logged
                </p>
              </div>
            </div>
          </SectionCard>
        </>
      )}
    </div>
  )
}
