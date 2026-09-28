'use client'

import { Anchor, ExternalLink, Loader2, Ship } from 'lucide-react'
import dynamic from 'next/dynamic'
import { useState } from 'react'
import useSWR from 'swr'

// Single source of fleet truth. The earlier `getFleetState` inferred a boat's
// state from bookings alone and knew nothing about positions, so keeping both
// would have let two answers to "where is the boat" drift apart.
import { getFleetOverview, type BoatCard } from '@/app/actions/fleet'
import { BOATS, tripLabel } from '@/lib/boats'
import { NO_SIGNAL_MIN } from '@/lib/fleet'
import { LODGE } from '@/lib/lodge'
import { cn } from '@/lib/utils'

type BoatState = BoatCard['state']

// Leaflet touches `window` at import time, so it must never render on the
// server.
const FleetMapCanvas = dynamic(() => import('./fleet-map-canvas'), {
  ssr: false,
  loading: () => (
    <div className="flex h-[420px] w-full items-center justify-center bg-secondary/40">
      <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" aria-hidden />
    </div>
  ),
})

/**
 * Colours reuse the established palette: blue = out working, amber = leaving
 * today, quiet = alongside. Both a light and a dark variant, because these sit
 * on the sand/dark card body rather than on the navy header.
 */
const STATE_STYLE: Record<
  BoatState,
  { label: string; dot: string; tone: string; chip: string }
> = {
  'at-sea': {
    label: 'At sea',
    dot: 'bg-[#1f6f96] dark:bg-[#9ecbdd]',
    tone: 'text-[#1f6f96] dark:text-[#9ecbdd]',
    chip: 'border-[#1f6f96]/35 bg-[#1f6f96]/10 text-[#1f6f96] dark:border-[#9ecbdd]/35 dark:bg-[#9ecbdd]/10 dark:text-[#9ecbdd]',
  },
  departing: {
    label: 'Departing today',
    dot: 'bg-[#8f6d3a] dark:bg-[#e0b877]',
    tone: 'text-[#8f6d3a] dark:text-[#e0b877]',
    chip: 'border-[#8f6d3a]/35 bg-[#8f6d3a]/10 text-[#8f6d3a] dark:border-[#e0b877]/35 dark:bg-[#e0b877]/10 dark:text-[#e0b877]',
  },
  'at-base': {
    label: 'At base',
    dot: 'bg-muted-foreground/50',
    tone: 'text-muted-foreground',
    chip: 'border-border bg-secondary/60 text-muted-foreground',
  },
}

function shortDate(d: string) {
  const t = Date.parse(`${d}T00:00:00Z`)
  return Number.isNaN(t)
    ? d
    : new Date(t).toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'short',
        timeZone: 'UTC',
      })
}

export function BoatPanel({ boat }: { boat: BoatCard }) {
  const s = STATE_STYLE[boat.state]
  const t = boat.activeTrip

  return (
    <div className="flex flex-col gap-2 rounded-xl border border-border bg-secondary/40 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="flex items-center gap-2 text-sm font-semibold tracking-[0.06em] text-foreground">
            <Ship className={cn('h-4 w-4 flex-shrink-0', s.tone)} aria-hidden />
            {boat.name}
          </p>
          <p className="mt-0.5 text-[11px] text-muted-foreground">{boat.specs}</p>
        </div>
        <span
          className={cn(
            'flex flex-shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-[9px] font-semibold uppercase tracking-[0.14em]',
            s.chip,
          )}
        >
          <span className={cn('h-1.5 w-1.5 rounded-full', s.dot)} aria-hidden />
          {s.label}
        </span>
      </div>

      {/* An open trip wins over a booking: the trip is what IS happening, the
          booking only what was ordered. */}
      {t ? (
        <div className="flex flex-col gap-1 border-t border-border pt-2 text-xs">
          <p className="text-foreground">
            {t.purposeLabel}
            {t.destination ? ` · ${t.destination}` : ''}
          </p>
          <p className="text-muted-foreground">
            <span className="tabular-nums">Out {t.elapsed}</span>
            {' · '}
            {t.guests} {t.guests === 1 ? 'guest' : 'guests'}
            {t.captainName ? ` · ${t.captainName}` : ''}
          </p>
          {t.position ? (
            <p className={cn('tabular-nums', s.tone)}>
              {t.position.speedKn != null
                ? `${t.position.speedKn.toFixed(1)} kn`
                : 'Position held'}
              {t.distanceNm != null ? ` · ${t.distanceNm.toFixed(1)} nm run` : ''}
              {/* Age matters more than the coordinates: a 40-minute-old fix
                  must not read as a live one. */}
              {t.position.ageMin > 5 && (
                <span className="text-muted-foreground">
                  {' · '}
                  {t.position.ageMin} min ago
                </span>
              )}
            </p>
          ) : (
            <p className="text-muted-foreground">
              No position yet — Captain Mode not reporting
            </p>
          )}
        </div>
      ) : boat.today ? (
        <div className="flex flex-col gap-1 border-t border-border pt-2 text-xs">
          <p className="text-foreground">
            {boat.today.label}
            {boat.today.status === 'pending' && (
              <span className="ml-1.5 text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                · request not confirmed
              </span>
            )}
          </p>
          <p className="text-muted-foreground">
            {boat.today.departureTime ? (
              <span className="tabular-nums">Departs {boat.today.departureTime}</span>
            ) : (
              // Without a departure time we cannot say the boat has left.
              'Departure time not set'
            )}
            {' · '}
            {boat.today.guests} {boat.today.guests === 1 ? 'guest' : 'guests'}
            {boat.today.guestName ? ` · ${boat.today.guestName}` : ''}
          </p>
        </div>
      ) : (
        <div className="border-t border-border pt-2 text-xs text-muted-foreground">
          No trip today
          {boat.next && (
            <>
              {' · next '}
              <span className="text-foreground">
                {shortDate(boat.next.date)} {boat.next.label.toLowerCase()}
              </span>
            </>
          )}
        </div>
      )}
    </div>
  )
}

export function FlotaTab() {
  const { data, error, isLoading } = useSWR('fleet-overview', getFleetOverview, {
    // 30s, not 60s: this now carries live positions, and a boat moving at 14 kn
    // covers about 400 m in half a minute.
    refreshInterval: 30_000,
    revalidateOnFocus: true,
  })
  const [nautical, setNautical] = useState(true)

  if (isLoading) {
    return (
      <section className="flex items-center justify-center rounded-2xl border border-border bg-card p-12">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" aria-hidden />
      </section>
    )
  }

  if (error || !data) {
    return (
      <section className="rounded-2xl border border-border bg-card p-6">
        <p className="text-sm text-muted-foreground">
          Fleet status is unavailable right now.
        </p>
      </section>
    )
  }

  const atSea = data.boats.filter((b) => b.state === 'at-sea').length

  return (
    <section className="overflow-hidden rounded-2xl border border-border bg-card">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 bg-panel-header p-5">
        <div>
          <p className="flex items-center gap-2 text-[10px] font-medium uppercase tracking-[0.22em] text-panel-header-foreground/55">
            <Anchor className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
            {/* Deliberately NOT "Fleet": the page head above already says that,
                and repeating it reads as a doubled title. */}
            Boats today
          </p>
          <p className="mt-1 text-xs uppercase tracking-[0.12em] text-panel-header-foreground/40">
            Home waters around {LODGE.name}
          </p>
        </div>
        <span className="ml-auto text-[10px] font-medium uppercase tracking-[0.18em] text-panel-header-foreground/45">
          {atSea > 0 ? `${atSea} at sea` : 'all alongside'}
        </span>
      </div>

      <div className="grid gap-4 p-5 sm:grid-cols-2">
        {data.boats.map((b) => (
          <BoatPanel key={b.id} boat={b} />
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2 border-y border-border p-4">
        <button
          type="button"
          onClick={() => setNautical((v) => !v)}
          aria-pressed={nautical}
          className={cn(
            'min-h-11 cursor-pointer rounded-full border px-4 text-[11px] font-semibold uppercase tracking-[0.14em] transition-colors',
            nautical
              ? 'border-accent bg-accent/15 text-accent'
              : 'border-border bg-secondary/60 text-muted-foreground hover:bg-secondary',
          )}
        >
          Navigation marks
        </button>
        <span className="text-[11px] text-muted-foreground">
          Buoys, lights and depths
        </span>
      </div>

      <FleetMapCanvas
        lat={data.base.lat}
        lon={data.base.lon}
        label={data.base.label}
        nautical={nautical}
        // One shared threshold with the alerts, so a red dot on the map and a
        // "no signal" alert can never disagree.
        noSignalMin={NO_SIGNAL_MIN}
        // Only boats with an actual fix reach the map. A boat without one is
        // absent rather than drawn at the base, which would be a false pin.
        boats={data.boats.flatMap((b) =>
          b.activeTrip?.position
            ? [
                {
                  id: b.id,
                  name: b.name,
                  lat: b.activeTrip.position.lat,
                  lon: b.activeTrip.position.lon,
                  headingDeg: b.activeTrip.position.headingDeg,
                  speedKn: b.activeTrip.position.speedKn,
                  ageMin: b.activeTrip.position.ageMin,
                  track: b.activeTrip.track,
                  destination: b.activeTrip.destination,
                  distanceNm: b.activeTrip.distanceNm,
                },
              ]
            : [],
        )}
      />

      {/* Boat profiles. Read from BOATS rather than re-typed: the same specs
          already drive the public site, and a second copy would eventually
          disagree with it. Hull and engines matter operationally — they decide
          which boat can take a charter out in a given sea. */}
      <div className="grid gap-px border-t border-border bg-border sm:grid-cols-2">
        {BOATS.map((b) => {
          const live = data.boats.find((x) => x.id === b.id)
          return (
            <article key={b.id} className="flex gap-3 bg-card p-4">
              <img
                src={b.image || '/placeholder.svg'}
                alt={`${b.name} — ${b.tagline}`}
                className="h-16 w-24 flex-shrink-0 rounded-lg object-cover"
              />
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground">{b.name}</p>
                <p className="text-xs text-muted-foreground">{b.specs}</p>
                <p className="mt-1 text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
                  {b.trips.map(tripLabel).join(' · ')}
                </p>
                {/* This month's usage, so a boat that has sat idle is visible
                    next to one that has been working. */}
                {live && live.tripsThisMonth > 0 && (
                  <p className="mt-1 text-[11px] tabular-nums text-muted-foreground">
                    {live.tripsThisMonth} trips · {live.hoursThisMonth.toFixed(1)}h
                    this month
                  </p>
                )}
              </div>
            </article>
          )
        })}
      </div>

      <div className="flex flex-col gap-2 border-t border-border px-4 py-3 text-xs text-muted-foreground">
        {/* Positions come from the captain's phone in Captain Mode, not from
            AIS — our boats carry no transmitter. So a boat only shows on the
            map while that screen is open, and this says so rather than letting
            an empty map read as broken. */}
        <p>
          Live positions come from Captain Mode on the captain&apos;s phone. A
          boat with no recent fix shows its last known position with the time —
          our boats carry no AIS transmitter. Charts: OpenStreetMap and
          OpenSeaMap.
        </p>
        <a
          href={`https://www.marinetraffic.com/en/ais/home/centerx:${LODGE.longitude}/centery:${LODGE.latitude}/zoom:9`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex min-h-11 w-fit items-center gap-1.5 font-medium text-accent underline-offset-4 hover:underline"
        >
          <ExternalLink className="h-3.5 w-3.5 flex-shrink-0" aria-hidden />
          Open commercial traffic on MarineTraffic
        </a>
      </div>
    </section>
  )
}
