'use client'

import {
  AlertTriangle,
  Anchor,
  ArrowRight,
  CheckCircle2,
  ChevronDown,
  ClipboardList,
  Clock,
  Loader2,
  Map,
  Ship,
  Sunset,
  Users,
  Wind,
} from 'lucide-react'
import Link from 'next/link'
import { useState } from 'react'
import useSWR from 'swr'

import {
  acknowledgeAlert,
  getFleetOverview,
  type FleetAlert,
  type TripGuest,
} from '@/app/actions/fleet'
import { NO_SIGNAL_MIN } from '@/lib/fleet'
import { countryName, flagUrl } from '@/lib/flags'
import { useT } from '@/lib/i18n/context'
import { cn } from '@/lib/utils'

/**
 * Severity colours reuse the palette already established across the admin:
 * bordeaux for critical, amber for warning, sky for info. Each has a light
 * variant because these chips sit on the card body, not on the navy header.
 */
const SEVERITY: Record<
  FleetAlert['severity'],
  { chip: string; icon: string; label: string }
> = {
  critical: {
    chip: 'border-[#b0203a]/40 bg-[#b0203a]/10 text-[#b0203a] dark:border-[#f0a8b4]/40 dark:bg-[#f0a8b4]/10 dark:text-[#f0a8b4]',
    icon: 'text-[#b0203a] dark:text-[#f0a8b4]',
    label: 'Critical',
  },
  warning: {
    chip: 'border-[#8f6d3a]/40 bg-[#8f6d3a]/10 text-[#8f6d3a] dark:border-[#e0b877]/40 dark:bg-[#e0b877]/10 dark:text-[#e0b877]',
    icon: 'text-[#8f6d3a] dark:text-[#e0b877]',
    label: 'Warning',
  },
  info: {
    chip: 'border-[#1f6f96]/40 bg-[#1f6f96]/10 text-[#1f6f96] dark:border-[#9ecbdd]/40 dark:bg-[#9ecbdd]/10 dark:text-[#9ecbdd]',
    icon: 'text-[#1f6f96] dark:text-[#9ecbdd]',
    label: 'Info',
  },
}

function Stat({
  label,
  value,
  hint,
  icon: Icon,
  tone,
  guests,
}: {
  label: string
  value: string
  hint?: string
  icon: typeof Ship
  tone?: string
  guests?: TripGuest[]
}) {
  return (
    <div className="flex flex-col gap-1 rounded-xl border border-border bg-secondary/40 p-4">
      <p className="flex items-center gap-2 text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
        <Icon
          className={cn('h-3.5 w-3.5 flex-shrink-0', tone)}
          strokeWidth={2.5}
          aria-hidden
        />
        {label}
      </p>
      <p className="text-2xl font-light tabular-nums text-foreground">{value}</p>
      {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
      {guests && guests.length > 0 && (
        <ul className="mt-1.5 flex flex-col gap-1.5 border-t border-border pt-1.5">
          {guests.map((g, i) => {
            const country = countryName(g.country)
            return (
              <li
                key={`${g.name}-${i}`}
                className="flex items-center gap-2 text-xs text-foreground"
                title={country ? `${g.name} — ${country}` : g.name}
              >
                {g.country ? (
                  <img
                    src={flagUrl(g.country) || '/placeholder.svg'}
                    alt={country}
                    width={20}
                    height={14}
                    className="h-3.5 w-5 flex-shrink-0 rounded-[2px] object-cover ring-1 ring-border"
                    crossOrigin="anonymous"
                  />
                ) : (
                  <span
                    aria-hidden
                    className="h-3.5 w-5 flex-shrink-0 rounded-[2px] bg-muted ring-1 ring-border"
                  />
                )}
                <span className="min-w-0 flex-1 truncate">{g.name}</span>
                {country && (
                  <span className="flex-shrink-0 text-[10px] uppercase tracking-[0.08em] text-muted-foreground">
                    {country}
                  </span>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

export function CommandCenter() {
  const tr = useT()
  // The navy header toggles the whole body; the alert badge stays visible in
  // the header so a problem is still flagged while collapsed.
  const [collapsed, setCollapsed] = useState(false)
  const { data, error, isLoading, mutate } = useSWR(
    'fleet-overview',
    getFleetOverview,
    {
      // Same 30s as the fleet map: this screen carries live positions.
      refreshInterval: 30_000,
      revalidateOnFocus: true,
    },
  )

  if (isLoading) {
    return (
      <section className="flex items-center justify-center rounded-2xl border border-border bg-card p-12">
        <Loader2
          className="h-5 w-5 animate-spin text-muted-foreground"
          aria-hidden
        />
      </section>
    )
  }

  if (error || !data) {
    return (
      <section className="rounded-2xl border border-border bg-card p-6">
        <p className="text-sm text-muted-foreground">
          {tr('Fleet status is unavailable right now.')}
        </p>
      </section>
    )
  }

  const atSea = data.boats.filter((b) => b.state === 'at-sea')
  const departing = data.boats.filter((b) => b.state === 'departing')
  // Pair each boat at sea with the captain of its active trip, so the "At sea"
  // card reads e.g. "ODYSSEY · Mike Schneider". A plain record is used because
  // `Map` here is the lucide icon, not the JS constructor.
  const captainByBoat: Record<string, string> = {}
  for (const t of data.activeTrips) {
    if (t.captainName) captainByBoat[t.boat] = t.captainName
  }
  const atSeaHint = atSea
    .map((b) => {
      const captain = captainByBoat[b.id]
      return captain ? `${b.name} · ${captain}` : b.name
    })
    .join(', ')
  const guestsAtSea = data.activeTrips.reduce((n, t) => n + t.guests, 0)
  const guestsListAtSea = data.activeTrips.flatMap((t) => t.guestNames)
  const critical = data.alerts.filter((a) => a.severity === 'critical').length

  // The whole alert is passed, not just its id: alerts are recomputed on every
  // read, so their ids are not stable between refreshes. What identifies an
  // acknowledgement is the kind plus the trip (or boat) it concerns.
  async function ack(a: FleetAlert) {
    await acknowledgeAlert({
      kind: a.kind,
      message: a.message,
      boat: a.boat,
      tripId: a.tripId,
    })
    mutate()
  }

  return (
    <section className="overflow-hidden rounded-2xl border border-border bg-card">
      <button
        type="button"
        onClick={() => setCollapsed((c) => !c)}
        aria-expanded={!collapsed}
        className="flex w-full flex-wrap items-center gap-x-4 gap-y-2 bg-panel-header p-5 text-left transition-colors hover:bg-panel-header-hover"
      >
        <div>
          <p className="flex items-center gap-2 text-[10px] font-medium uppercase tracking-[0.22em] text-panel-header-foreground/55">
            <Anchor className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
            {tr('On the water now')}
          </p>
          <p className="mt-1 text-xs uppercase tracking-[0.12em] text-panel-header-foreground/40">
            {data.today} · {tr('sunset')}{' '}
            <span className="tabular-nums">{data.sunset}</span>
          </p>
        </div>
        <span
          className={cn(
            'ml-auto flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.16em]',
            critical > 0
              ? 'border-[#f0a8b4]/45 bg-[#f0a8b4]/10 text-[#f0a8b4]'
              : data.alerts.length > 0
                ? 'border-[#e0b877]/45 bg-[#e0b877]/10 text-[#e0b877]'
                : 'border-[#8fae92]/45 bg-[#8fae92]/10 text-[#8fae92]',
          )}
        >
          {data.alerts.length === 0 ? (
            <>
              <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />
              {tr('All clear')}
            </>
          ) : (
            <>
              <AlertTriangle className="h-3.5 w-3.5" aria-hidden />
              {data.alerts.length}{' '}
              {tr(data.alerts.length === 1 ? 'alert' : 'alerts')}
            </>
          )}
        </span>
        <ChevronDown
          className={cn(
            'h-4 w-4 text-panel-header-foreground/60 transition-transform',
            collapsed && '-rotate-90',
          )}
          strokeWidth={2}
          aria-hidden
        />
      </button>

      {/* Everything below the header collapses as one unit. */}
      <div className={cn(collapsed && 'hidden')}>
      {/* Alerts first: the whole point of this screen is that a problem cannot
          be scrolled past. */}
      {data.alerts.length > 0 && (
        <ul className="divide-y divide-border border-b border-border">
          {data.alerts.map((a) => {
            const s = SEVERITY[a.severity]
            return (
              <li key={a.id} className="flex items-center gap-3 p-4">
                {/* Left: everything descriptive (icon + badge + message). */}
                <div className="flex min-w-0 flex-1 items-start gap-2.5">
                  <AlertTriangle
                    className={cn('mt-0.5 h-4 w-4 flex-shrink-0', s.icon)}
                    strokeWidth={2.5}
                    aria-hidden
                  />
                  <div className="min-w-0 flex-1">
                    <span
                      className={cn(
                        'inline-block rounded-full border px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.14em]',
                        s.chip,
                      )}
                    >
                      {tr(s.label)}
                    </span>
                    <p className="mt-1.5 text-sm text-foreground">
                      {a.message}
                    </p>
                  </div>
                </div>
                {/* Right: the action, fixed width so every button matches. */}
                <button
                  type="button"
                  onClick={() => ack(a)}
                  className="inline-flex min-h-11 w-24 flex-shrink-0 cursor-pointer items-center justify-center rounded-full border border-border px-3 text-center text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground transition-colors hover:bg-secondary"
                >
                  {tr('Acknowledge')}
                </button>
              </li>
            )
          })}
        </ul>
      )}

      <div className="grid gap-4 p-5 sm:grid-cols-2 lg:grid-cols-4">
        <Stat
          label={tr('At sea')}
          value={String(atSea.length)}
          hint={atSea.length > 0 ? atSeaHint : tr('All boats alongside')}
          icon={Ship}
          tone="text-[#1f6f96] dark:text-[#9ecbdd]"
        />
        <Stat
          label={tr('Guests out')}
          value={String(guestsAtSea)}
          hint={
            data.activeTrips.length > 0
              ? `${data.activeTrips.length} ${tr(data.activeTrips.length === 1 ? 'trip' : 'trips')} ${tr('running')}`
              : tr('No trips running')
          }
          icon={Users}
          tone="text-[#4f7a54] dark:text-[#8fae92]"
          guests={guestsListAtSea}
        />
        <Stat
          label={tr('Departing')}
          value={String(departing.length)}
          hint={
            data.departuresToday.length > 0
              ? `${data.departuresToday.length} ${tr('booked today')}`
              : tr('Nothing booked today')
          }
          icon={Clock}
          tone="text-[#8f6d3a] dark:text-[#e0b877]"
        />
        <Stat
          label={tr('Transfers today')}
          value={String(data.transfersToday.length)}
          hint={
            data.transfersToday.length > 0
              ? tr('Guest arrivals and departures')
              : tr('None scheduled')
          }
          icon={Sunset}
          tone="text-[#3f6b7d] dark:text-[#9ecbdd]"
        />
      </div>

      {/* Running trips, with the detail you would want on the radio. */}
      {data.activeTrips.length > 0 && (
        <div className="border-t border-border p-5">
          <p className="mb-3 text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
            {tr('Trips running')}
          </p>
          <ul className="flex flex-col gap-3">
            {data.activeTrips.map((t) => (
              <li
                key={t.id}
                className="flex flex-col gap-1 rounded-xl border border-border bg-secondary/40 p-4"
              >
                <div className="flex flex-wrap items-baseline gap-x-2">
                  <p className="font-serif text-lg text-foreground">
                    {t.boatLabel}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {tr(t.purposeLabel)}
                    {t.destination ? ` · ${t.destination}` : ''}
                  </p>
                </div>
                <p className="text-xs text-muted-foreground">
                  <span className="tabular-nums">
                    {tr('Left')} {t.startedTime} · {tr('out')} {t.elapsed}
                  </span>
                  {' · '}
                  {t.guests} {tr(t.guests === 1 ? 'guest' : 'guests')}
                  {t.captainName
                    ? ` · ${t.captainName}`
                    : ` · ${tr('no captain set')}`}
                </p>
                {t.position ? (
                  <p
                    className={cn(
                      'text-xs tabular-nums',
                      t.position.ageMin >= NO_SIGNAL_MIN
                        ? 'text-[#b0203a] dark:text-[#f0a8b4]'
                        : 'text-[#1f6f96] dark:text-[#9ecbdd]',
                    )}
                  >
                    {t.position.speedKn != null
                      ? `${t.position.speedKn.toFixed(1)} kn`
                      : tr('Position held')}
                    {t.distanceNm != null
                      ? ` · ${t.distanceNm.toFixed(1)} nm ${tr('run')}`
                      : ''}
                    {` · ${tr('fix')} `}
                    {t.position.ageMin === 0
                      ? tr('just now')
                      : `${t.position.ageMin} ${tr('min ago')}`}
                  </p>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    {tr('No position — Captain Mode not reporting')}
                  </p>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex flex-col gap-2.5 border-t border-border p-4">
        {[
          { href: '/admin/fleet', label: 'Fleet map', icon: Map },
          { href: '/admin/trips', label: 'Trip log', icon: ClipboardList },
          { href: '/admin/weather', label: 'Weather', icon: Wind },
        ].map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className="group relative flex w-full items-center gap-3 overflow-hidden rounded-full bg-panel-header px-3 py-2.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-panel-header-foreground ring-1 ring-inset ring-panel-header-foreground/10 shadow-[0_8px_24px_-14px_rgba(0,0,0,0.7)] transition-all duration-300 hover:ring-panel-header-foreground/25 hover:shadow-[0_0_22px_-4px_rgba(255,255,255,0.28)]"
          >
            {/* Glass sheen: a soft highlight across the top edge, like light
                catching a curved glass surface. */}
            <span
              aria-hidden
              className="pointer-events-none absolute inset-x-0 top-0 h-1/2 rounded-t-full bg-gradient-to-b from-panel-header-foreground/[0.14] to-transparent"
            />
            <span
              aria-hidden
              className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-panel-header-foreground/10 ring-1 ring-inset ring-panel-header-foreground/15 transition-colors group-hover:bg-panel-header-foreground/15"
            >
              <Icon className="h-4 w-4" strokeWidth={1.75} />
            </span>
            <span className="relative min-w-0 flex-1 truncate">{tr(label)}</span>
            <ArrowRight
              className="relative h-3.5 w-3.5 shrink-0 transition-transform duration-300 group-hover:translate-x-0.5"
              aria-hidden
            />
          </Link>
        ))}
      </div>
      </div>
    </section>
  )
}
