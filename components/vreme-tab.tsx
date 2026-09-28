'use client'

import { useEffect, useId, useMemo, useState } from 'react'
import useSWR from 'swr'
import {
  ArrowDown,
  ArrowUp,
  Cloud,
  CloudRain,
  CloudSun,
  ChevronDown,
  Droplets,
  Eye,
  Fish,
  Gauge,
  Loader2,
  Moon,
  Navigation,
  RefreshCw,
  Sun,
  Sunrise,
  Sunset,
  Thermometer,
  Waves,
  Wind,
} from 'lucide-react'
import { getWeather, type WeatherHour, type WeatherData } from '@/app/actions/vreme'
import { LODGE, SEA_LIMITS } from '@/lib/lodge'
import { cn } from '@/lib/utils'

/* ------------------------------------------------------------------ *
 * Palette
 *
 * The source app hard-coded hexes because it had no design tokens. Here
 * structure uses this app's tokens (card / border / foreground / muted), and
 * only MEANING carries colour. Where a colour exists in two variants
 * (light surface / dark surface) they are NOT unified: a saturated colour on a
 * dark navy card drops below readable, and a pale one vanishes on white.
 * ------------------------------------------------------------------ */

// `windy` is the matching metricWind value for the embedded map, so the toggle
// moves the numbers AND the map — they can never show different units.
// PROVEN LIVE: metricWind=km/h and m/s both take effect in the embed.
const UNITS = [
  { id: 'km/h', factor: 1, dec: 0, windy: 'km/h' },
  { id: 'm/s', factor: 1 / 3.6, dec: 1, windy: 'm/s' },
] as const

type UnitId = (typeof UNITS)[number]['id']

/** Windy overlays worth having here. `waves` carries a caveat — see below. */
const OVERLAYS = [
  { id: 'wind', label: 'Wind' },
  { id: 'waves', label: 'Waves' },
  { id: 'rain', label: 'Rain' },
  { id: 'temp', label: 'Temperature' },
] as const

type OverlayId = (typeof OVERLAYS)[number]['id']
const UNIT_KEY = 'aam-weather-unit'

type SeaState = {
  key: 'favorable' | 'caution' | 'danger'
  label: string
  /** Text/icon colour, both surfaces. */
  tone: string
  /** Badge (border + tint + text), both surfaces. */
  badge: string
  /** Hour-row stripe. */
  stripe: string
  /**
   * Text/icon colour for the card header, which carries the app's base navy
   * (--panel-header, #1b4060). The saturated light-mode tones fall below
   * readable contrast there, so the lighter variant is used on that surface in
   * BOTH modes. Do not merge with `tone`.
   */
  toneOnHeader: string
  /** Badge on the navy header, same reasoning as `toneOnHeader`. */
  badgeOnHeader: string
  /**
   * Set only when the state was raised by something the numbers beside it do
   * NOT show — currently a short wave period. Without it a "Caution" badge next
   * to 4 km/h of wind and 0.2 m of wave reads as a bug.
   */
  reason?: string
}

const SEA_STATES: Record<SeaState['key'], Omit<SeaState, 'key' | 'label'>> = {
  favorable: {
    tone: 'text-[#1f7a4d] dark:text-[#8fae92]',
    badge:
      'border-[#1f7a4d]/35 bg-[#1f7a4d]/10 text-[#1f7a4d] dark:border-[#8fae92]/40 dark:bg-[#8fae92]/15 dark:text-[#8fae92]',
    stripe: 'bg-[#2f7f45] dark:bg-[#8fae92]',
    // The established sage, same as the dark-card variant: on the base navy
    // header it measures 4.4:1, so no one-off brighter tint is needed.
    toneOnHeader: 'text-[#8fae92]',
    badgeOnHeader: 'border-[#8fae92]/40 bg-[#8fae92]/15 text-[#8fae92]',
  },
  caution: {
    tone: 'text-[#8f6d3a] dark:text-[#e0b877]',
    badge:
      'border-[#8f6d3a]/35 bg-[#8f6d3a]/10 text-[#8f6d3a] dark:border-[#e0b877]/40 dark:bg-[#e0b877]/15 dark:text-[#e0b877]',
    stripe: 'bg-[#a8761a] dark:bg-[#e0b877]',
    toneOnHeader: 'text-[#e0b877]',
    badgeOnHeader: 'border-[#e0b877]/40 bg-[#e0b877]/15 text-[#e0b877]',
  },
  danger: {
    tone: 'text-[#a11b31] dark:text-[#f0a8b4]',
    badge:
      'border-[#a11b31]/35 bg-[#a11b31]/10 text-[#a11b31] dark:border-[#f0a8b4]/40 dark:bg-[#f0a8b4]/15 dark:text-[#f0a8b4]',
    stripe: 'bg-[#b0203a] dark:bg-[#f0a8b4]',
    toneOnHeader: 'text-[#f0a8b4]',
    badgeOnHeader: 'border-[#f0a8b4]/40 bg-[#f0a8b4]/15 text-[#f0a8b4]',
  },
}

const TIDE_RISING = 'text-[#1f6f96] dark:text-[#9ecbdd]'
const TIDE_FALLING = 'text-[#8f6d3a] dark:text-[#e0b877]'
/** On the steel blue header the saturated pair goes dim — use these there only. */
const TIDE_RISING_ON_HEADER = 'text-[#9ecbdd]'
const TIDE_FALLING_ON_HEADER = 'text-[#e0b877]'
/** Tide curve: large area, so the quieter blue reads better than the saturated one. */
const TIDE_CURVE = 'text-[#3f6b7d] dark:text-[#7fa8b8]'

const METRIC_ICONS = {
  waves: 'text-[#264b5e] dark:text-[#7fa8b8]',
  tide: TIDE_RISING,
  temp: 'text-[#c4744a] dark:text-[#e09b74]',
  rain: 'text-[#1f6f96] dark:text-[#9ecbdd]',
  sky: 'text-[#3f6b7d] dark:text-[#a8c2ce]',
  // Fishing card. SST reuses the warm temperature tone because it IS a
  // temperature; current and visibility share the quiet blue.
  sst: 'text-[#c4744a] dark:text-[#e09b74]',
  swell: 'text-[#264b5e] dark:text-[#7fa8b8]',
  current: 'text-[#1f6f96] dark:text-[#9ecbdd]',
  pressure: 'text-[#8f6d3a] dark:text-[#e0b877]',
  visibility: 'text-[#3f6b7d] dark:text-[#a8c2ce]',
  sun: 'text-[#8f6d3a] dark:text-[#e0b877]',
  moon: 'text-[#3f6b7d] dark:text-[#a8c2ce]',
} as const

/**
 * Sea state from GUSTS, wave height and wave PERIOD, judged in km/h (the
 * canonical unit). Both the badge and the ensemble probability read SEA_LIMITS,
 * so the printed percentage always describes the same limit the badge uses.
 *
 * Period is the third factor because a short, steep sea beats the hull and the
 * guests even when significant wave height looks harmless — the one thing wind
 * and height alone cannot show. It can only raise the state to CAUTION, never
 * to unfavorable: chop is uncomfortable, not dangerous.
 */
function seaState(
  gusts: number | null,
  waves: number | null,
  period?: number | null,
): SeaState {
  const g = gusts ?? 0
  const w = waves ?? 0
  if (g >= SEA_LIMITS.dangerGusts || w >= SEA_LIMITS.dangerWaves) {
    return { key: 'danger', label: 'Unfavorable', ...SEA_STATES.danger }
  }
  if (g >= SEA_LIMITS.cautionGusts || w >= SEA_LIMITS.cautionWaves) {
    return { key: 'caution', label: 'Caution', ...SEA_STATES.caution }
  }
  // Needs something to chop: a glassy 0.1 m sea with a 3 s period is calm.
  if (
    period != null &&
    period < SEA_LIMITS.choppyPeriod &&
    w >= SEA_LIMITS.choppyWaves
  ) {
    return {
      key: 'caution',
      label: 'Caution',
      ...SEA_STATES.caution,
      reason: `${dec(period)} s period — short and choppy`,
    }
  }
  return { key: 'favorable', label: 'Favorable', ...SEA_STATES.favorable }
}

/**
 * Bite outlook, shown as NAMED FACTORS rather than one opaque score, so the
 * skipper can see WHY and overrule it. Every factor is a measurement we already
 * hold — nothing here is invented.
 */
type BiteFactor = { label: string; detail: string; good: boolean }

function biteFactors(args: {
  pressureTrend: number | null
  minsToTurn: number | null
  moonPhase: number | null
  nowLocal: string
  sunrise: string | null
  sunset: string | null
}): BiteFactor[] {
  const { pressureTrend, minsToTurn, moonPhase, nowLocal, sunrise, sunset } = args
  const out: BiteFactor[] = []

  if (pressureTrend != null) {
    const falling = pressureTrend <= -0.7
    out.push({
      label: 'Barometer',
      detail: `${pressureTrend > 0 ? '+' : ''}${dec(pressureTrend)} hPa / 3 h`,
      // A falling barometer ahead of a change is the classic feeding window.
      good: falling,
    })
  }

  if (minsToTurn != null) {
    // Water MOVES hardest mid-tide and slackens at the turn, so the good window
    // is being a little away from the turn, not on top of it.
    const running = minsToTurn > 45 && minsToTurn < 300
    out.push({
      label: 'Tide flow',
      detail:
        minsToTurn <= 45
          ? 'slack water at the turn'
          : `water running, turn in ${Math.floor(minsToTurn / 60)} h ${minsToTurn % 60} min`,
      good: running,
    })
  }

  if (moonPhase != null) {
    // Spring tides sit at new and full moon: the biggest range, the strongest
    // flow. Neaps (the quarters) move the least water.
    const d = Math.min(moonPhase, Math.abs(moonPhase - 0.5), 1 - moonPhase)
    const spring = d < 0.12
    out.push({
      label: 'Moon',
      detail: spring ? 'spring tides — big water movement' : 'neap tides — weaker flow',
      good: spring,
    })
  }

  const mins = (t: string | null) =>
    t ? Number(t.slice(11, 13)) * 60 + Number(t.slice(14, 16)) : null
  const nowM = mins(nowLocal)
  const riseM = mins(sunrise)
  const setM = mins(sunset)
  if (nowM != null && riseM != null && setM != null) {
    // Within 90 min of first or last light.
    const near = (m: number) => Math.abs(nowM - m) <= 90
    const golden = near(riseM) || near(setM)
    out.push({
      label: 'Light',
      detail: golden
        ? 'golden hour — first/last light'
        : nowM < riseM || nowM > setM
          ? 'dark'
          : 'full daylight',
      good: golden,
    })
  }

  return out
}

/** Colour of the ensemble risk figure. Danger is checked FIRST and at a low
 *  threshold — 1 member in 20 is already worth a second thought. */
function riskTone(pC: number, pD: number): string {
  if (pD >= 0.05) return 'text-[#b0203a] dark:text-[#f0a8b4]'
  if (pC >= 0.5) return 'text-[#a8761a] dark:text-[#e0b877]'
  return 'text-muted-foreground'
}

/* ------------------------------------------------------------------ *
 * Small helpers
 * ------------------------------------------------------------------ */

const dec = (v: number, places = 1) => v.toFixed(places)

const COMPASS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW']
function compass(deg: number | null): string {
  if (deg == null) return '—'
  return COMPASS[Math.round(((deg % 360) / 45)) % 8]
}

function weatherText(code: number | null): string {
  if (code == null) return '—'
  if (code === 0) return 'Clear'
  if (code <= 2) return 'Partly cloudy'
  if (code === 3) return 'Overcast'
  if (code <= 48) return 'Fog'
  if (code <= 57) return 'Drizzle'
  if (code <= 67) return 'Rain'
  if (code <= 77) return 'Showers'
  if (code <= 82) return 'Heavy showers'
  if (code <= 86) return 'Squalls'
  return 'Thunderstorm'
}

function SkyIcon({ code, className }: { code: number | null; className?: string }) {
  const Icon =
    code == null
      ? Cloud
      : code === 0
        ? Sun
        : code <= 2
          ? CloudSun
          : code === 3
            ? Cloud
            : CloudRain
  return <Icon className={className} strokeWidth={1.75} aria-hidden />
}

const dayOf = (t: string) => t.slice(0, 10)

/** Bare-date arithmetic in UTC on both sides, so the day cannot slip. */
function addDays(day: string, n: number): string {
  const ms = Date.parse(`${day}T00:00:00Z`)
  return new Date(ms + n * 86400_000).toISOString().slice(0, 10)
}

const DAY_NAMES = ['Today', 'Tomorrow', 'Day after']

function relDay(day: string, base: string): string {
  const i = Math.round(
    (Date.parse(`${day}T00:00:00Z`) - Date.parse(`${base}T00:00:00Z`)) / 86400_000,
  )
  if (i >= 0 && i < DAY_NAMES.length) return DAY_NAMES[i]
  return new Date(`${day}T00:00:00Z`).toLocaleDateString('en-GB', {
    weekday: 'long',
    timeZone: 'UTC',
  })
}

function shortDate(day: string): string {
  return new Date(`${day}T00:00:00Z`).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    timeZone: 'UTC',
  })
}

const fmtHour = (t: string) => t.slice(11, 16)

function maxOf(hours: WeatherHour[], pick: (h: WeatherHour) => number | null): number | null {
  const vals = hours.map(pick).filter((v): v is number => v != null)
  return vals.length ? Math.max(...vals) : null
}

function minOf(hours: WeatherHour[], pick: (h: WeatherHour) => number | null): number | null {
  const vals = hours.map(pick).filter((v): v is number => v != null)
  return vals.length ? Math.min(...vals) : null
}

/** "in 1 h 24 min" between two bare local strings. */
function countdown(target: string, now: string): string {
  const mins = Math.round(
    (Date.parse(`${target}:00Z`) - Date.parse(`${now.slice(0, 16)}:00Z`)) / 60000,
  )
  if (mins <= 0) return 'now'
  if (mins < 60) return `in ${mins} min`
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return m ? `in ${h} h ${m} min` : `in ${h} h`
}

/* ------------------------------------------------------------------ *
 * Windsock — colour says the sea state, speed says the gust strength
 * ------------------------------------------------------------------ */

function Windsock({
  gusts,
  tone,
  hint,
}: {
  gusts: number | null
  tone: string
  hint: string
}) {
  // Continuous, not banded: 3.6 s in a calm down to 1.2 s in a blow. gusts is
  // ALWAYS km/h, so switching the display to m/s cannot change the motion.
  const duration = `${Math.min(3.6, Math.max(1.2, 3.6 - (gusts ?? 0) / 18)).toFixed(2)}s`
  return (
    <svg
      viewBox="0 0 30 22"
      width={48}
      height={35}
      className={cn('shrink-0', tone)}
      aria-hidden
    >
      <title>{hint}</title>
      {/* mast */}
      <line x1="4" y1="2" x2="4" y2="21" stroke="currentColor" strokeOpacity={0.45} strokeWidth={1.1} />
      {/* the sock: wide throat tapering to almost a point */}
      <g className="animate-windsock" style={{ animationDuration: duration }}>
        <path d="M7 4.2 L26.8 8.4 L26.8 9.4 L7 10.8 Z" fill="currentColor" fillOpacity={0.85} />
        {/* three bands following the taper */}
        <path d="M12 5.24 L13 5.45 L13 10.14 L12 10.21 Z" fill="currentColor" fillOpacity={0.35} />
        <path d="M17.5 6.4 L18.5 6.61 L18.5 9.75 L17.5 9.82 Z" fill="currentColor" fillOpacity={0.35} />
        <path d="M22.5 7.46 L23.5 7.67 L23.5 9.4 L22.5 9.47 Z" fill="currentColor" fillOpacity={0.35} />
        {/* lashings to the mast head */}
        <line x1="4" y1="2" x2="7" y2="4.2" stroke="currentColor" strokeOpacity={0.55} strokeWidth={0.7} />
        <line x1="4" y1="2" x2="7" y2="10.8" stroke="currentColor" strokeOpacity={0.55} strokeWidth={0.7} />
        {/* throat ring drawn LAST so it sits above the fabric */}
        <ellipse
          cx="7"
          cy="7.5"
          rx="1.3"
          ry="3.3"
          fill="none"
          stroke="currentColor"
          strokeWidth={1}
        />
      </g>
    </svg>
  )
}

/* ------------------------------------------------------------------ *
 * Metric tile
 * ------------------------------------------------------------------ */

function Metric({
  icon: Icon,
  iconColor,
  label,
  value,
  note,
}: {
  icon: typeof Wind
  iconColor?: string
  label: string
  value: string
  note?: string
}) {
  return (
    <div>
      <p className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
        <Icon
          className={cn('h-3 w-3', iconColor)}
          strokeWidth={iconColor ? 2.5 : undefined}
          aria-hidden
        />
        {label}
      </p>
      <p className="mt-1.5 font-serif text-xl font-medium tabular-nums text-foreground">
        {value}
      </p>
      {note && <p className="mt-0.5 text-xs text-muted-foreground">{note}</p>}
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * Main
 * ------------------------------------------------------------------ */

export default function VremeTab() {
  const { data, error, isLoading, isValidating, mutate } = useSWR<WeatherData>(
    'weather',
    () => getWeather(),
    { refreshInterval: 900_000, revalidateOnFocus: true },
  )

  const [unit, setUnit] = useState<UnitId>('km/h')
  const [openDays, setOpenDays] = useState<Record<string, boolean>>({})
  const [tideOpen, setTideOpen] = useState(false)
  const [modelsOpen, setModelsOpen] = useState(false)
  const [overlay, setOverlay] = useState<OverlayId>('wind')

  useEffect(() => {
    try {
      const saved = localStorage.getItem(UNIT_KEY)
      if (saved === 'm/s' || saved === 'km/h') setUnit(saved)
    } catch {
      /* private mode throws */
    }
  }, [])

  function pickUnit(u: UnitId) {
    setUnit(u)
    try {
      localStorage.setItem(UNIT_KEY, u)
    } catch {
      /* ignore */
    }
  }

  const u = UNITS.find((x) => x.id === unit)!
  const windText = (v: number | null) => (v == null ? '—' : dec(v * u.factor, u.dec))

  const nowLocal = data?.nowLocal ?? ''

  const nowHour = useMemo(() => {
    if (!data) return null
    const key = `${nowLocal.slice(0, 13)}:00`
    return data.hours.find((h) => h.time === key) ?? null
  }, [data, nowLocal])

  /** Sun and moon for the lodge's TODAY, matched by date key from the model. */
  const todaySky = useMemo(() => {
    if (!data || !nowLocal) return null
    return data.sky.find((d) => d.date === dayOf(nowLocal)) ?? null
  }, [data, nowLocal])

  /** Three days from date keys. Today is hourly; the next two are 3-hourly,
   *  pinned to whole markers (00, 03, 06 …) so all days read alike. */
  const byDay = useMemo(() => {
    if (!data || !nowLocal) return []
    const base = dayOf(nowLocal)
    return [0, 1, 2].map((i) => {
      const day = addDays(base, i)
      const hours = data.hours.filter((h) => {
        if (dayOf(h.time) !== day) return false
        if (i === 0) return h.time >= nowLocal.slice(0, 13)
        return Number(h.time.slice(11, 13)) % 3 === 0
      })
      return { day, hours, i }
    })
  }, [data, nowLocal])

  const tide = useMemo(() => {
    if (!data || !nowLocal) return null
    const upcoming = data.tides.find((t) => t.time > nowLocal.slice(0, 16)) ?? null
    const curve = data.hours.filter(
      (h) => h.tide != null && h.time >= shiftLocal(nowLocal, -3) && h.time <= shiftLocal(nowLocal, 24),
    )
    // Only turns still ahead of us — a high water that has already passed is
    // noise in the list. The curve is what carries the recent past.
    const list = data.tides.filter((t) => t.time > nowLocal.slice(0, 16)).slice(0, 6)
    return { upcoming, curve, list }
  }, [data, nowLocal])

  /** Bite factors. Minutes to the next turn come from the SAME tide list the
   *  tide card uses, so the two can never disagree. */
  const bite = useMemo(() => {
    if (!data || !nowLocal) return []
    const minsToTurn = tide?.upcoming
      ? Math.round(
          (Date.parse(`${tide.upcoming.time}:00Z`) -
            Date.parse(`${nowLocal.slice(0, 16)}:00Z`)) /
            60_000,
        )
      : null
    return biteFactors({
      pressureTrend: data.current.pressureTrend,
      minsToTurn: minsToTurn != null && minsToTurn >= 0 ? minsToTurn : null,
      moonPhase: todaySky?.moonPhase ?? null,
      nowLocal,
      sunrise: todaySky?.sunrise ?? null,
      sunset: todaySky?.sunset ?? null,
    })
  }, [data, nowLocal, tide, todaySky])

  const biteFavor = bite.filter((f) => f.good).length

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center rounded-2xl border border-border bg-card">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="rounded-2xl border border-border bg-card p-8 text-center">
        <p className="text-muted-foreground">
          The forecast is unavailable right now.
        </p>
        <button
          type="button"
          onClick={() => mutate()}
          className="mt-4 inline-flex cursor-pointer items-center gap-2 rounded-lg border border-border px-4 py-2.5 text-sm font-medium text-foreground transition-colors hover:border-accent hover:text-accent"
        >
          <RefreshCw className="h-4 w-4" strokeWidth={1.75} />
          Try again
        </button>
      </div>
    )
  }

  const state = seaState(
    data.current.gusts,
    data.current.waves,
    data.current.wavePeriod,
  )
  const modelGusts = data.models.map((m) => m.gusts)
  const mLo = modelGusts.length ? Math.min(...modelGusts) : null
  const mHi = modelGusts.length ? Math.max(...modelGusts) : null
  const spread = mLo != null && mHi != null ? mHi - mLo : null
  // The verdict is on the spread in km/h, so switching to m/s cannot move it.
  // These only ever render on the navy header, so they use the lighter
  // variants on both surfaces (same reasoning as SeaState.toneOnHeader).
  const agreement =
    spread == null
      ? null
      : spread < 8
        ? { text: 'models agree', tone: 'text-[#8fae92]' }
        : spread < 18
          ? { text: 'minor differences', tone: 'text-[#e0b877]' }
          : { text: 'models disagree', tone: 'text-[#f0a8b4]' }

  return (
    <div className="space-y-6">
      {/* Page head */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="flex items-center gap-3 text-[11px] font-medium uppercase tracking-[0.3em] text-accent">
            <span className="h-px w-8 bg-accent" />
            Weather
          </p>
          <h1 className="mt-2 font-serif text-3xl font-medium text-foreground lg:text-4xl">
            {LODGE.name}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Wind, sea and tide for go / no-go decisions
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex overflow-hidden rounded-lg border border-border">
            {UNITS.map((x) => (
              <button
                key={x.id}
                type="button"
                onClick={() => pickUnit(x.id)}
                className={cn(
                  'min-h-11 cursor-pointer px-4 text-xs font-semibold uppercase tracking-wider transition-colors',
                  unit === x.id
                    ? 'bg-accent text-accent-foreground'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {x.id}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => mutate()}
            aria-label="Refresh"
            className="inline-flex h-11 w-11 cursor-pointer items-center justify-center rounded-lg border border-border text-muted-foreground transition-colors hover:border-accent hover:text-accent"
          >
            <RefreshCw
              className={cn('h-4 w-4', isValidating && 'animate-spin')}
              strokeWidth={1.75}
            />
          </button>
        </div>
      </div>

      {/* ---------------- NOW ---------------- */}
      <section className="overflow-hidden rounded-2xl border border-border bg-card">
        <div className="flex flex-wrap items-start gap-6 bg-panel-header p-5">
          <div className="min-w-0">
            <p className="text-[10px] font-medium uppercase tracking-[0.22em] text-panel-header-foreground/55">
              Now
            </p>
            <p className="mt-1 flex items-baseline gap-2">
              <span className="font-serif text-5xl font-medium tabular-nums leading-none text-panel-header-foreground">
                {windText(data.current.wind)}
              </span>
              <span className="text-sm text-panel-header-foreground/60">{unit}</span>
              <Wind
                className="h-4 w-4 text-panel-header-foreground/50"
                strokeWidth={1.75}
                aria-hidden
              />
            </p>
            <p className="mt-3 flex items-center gap-2.5 text-sm text-panel-header-foreground/70">
              <span>{compass(data.current.direction)}</span>
              {/* Light gold: the saturated light-mode gold sinks into the navy. */}
              <span className="h-px w-3 bg-[#c59b5b]/50" />
              <span>
                gusts{' '}
                <span className="font-medium tabular-nums text-panel-header-foreground">
                  {windText(data.current.gusts)} {unit}
                </span>
              </span>
            </p>
          </div>

          <div className="ml-auto flex flex-shrink-0 flex-col items-center gap-2">
            <span
              className={cn(
                'whitespace-nowrap rounded-full border px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em]',
                state.badgeOnHeader,
              )}
            >
              {state.label}
            </span>
            {/* Names the cause when it is not the wind or the wave height beside
                it — otherwise this badge looks wrong next to calm numbers. */}
            {state.reason && (
              <span
                className={cn(
                  'max-w-[8rem] text-center text-[10px] leading-tight',
                  state.toneOnHeader,
                )}
              >
                {state.reason}
              </span>
            )}
            <Windsock
              gusts={data.current.gusts}
              tone={state.toneOnHeader}
              hint={`Gusts ${windText(data.current.gusts)} ${unit} — ${state.label}${state.reason ? ` (${state.reason})` : ''}`}
            />
          </div>

          {/* Model comparison — wraps onto its own row under both columns */}
          {data.models.length > 0 && (
            <div className="w-full border-t border-panel-header-foreground/15 pt-3">
              <button
                type="button"
                onClick={() => setModelsOpen((v) => !v)}
                aria-expanded={modelsOpen}
                className="flex min-h-11 w-full cursor-pointer flex-wrap items-center gap-x-2 gap-y-1 text-left"
              >
                <span className="text-[10px] font-medium uppercase tracking-[0.18em] text-panel-header-foreground/55">
                  Models
                </span>
                <span className="whitespace-nowrap text-xs tabular-nums text-panel-header-foreground">
                  {windText(mLo)}–{windText(mHi)} {unit}
                </span>
                {agreement && (
                  <span className={cn('text-xs', agreement.tone)}>{agreement.text}</span>
                )}
                <ChevronDown
                  className={cn(
                    'ml-auto h-4 w-4 text-panel-header-foreground/50 transition-transform',
                    modelsOpen && 'rotate-180',
                  )}
                  strokeWidth={1.75}
                />
              </button>

              <div className={cn('mt-3 space-y-1.5', !modelsOpen && 'hidden')}>
                {data.models.map((m) => (
                  <div key={m.id} className="flex items-center gap-3">
                    <span
                      className={cn(
                        'w-28 shrink-0 text-xs',
                        m.primary
                          ? 'font-medium text-panel-header-foreground'
                          : 'text-panel-header-foreground/60',
                      )}
                    >
                      {m.label}
                    </span>
                    <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-panel-header-foreground/15">
                      <span
                        className="block h-full rounded-full bg-[#7fa8b8]"
                        style={{
                          width: `${Math.max(4, (m.gusts / (mHi || 1)) * 100)}%`,
                          opacity: m.primary ? 1 : 0.6,
                        }}
                      />
                    </span>
                    <span className="w-16 shrink-0 text-right text-xs tabular-nums text-panel-header-foreground">
                      {windText(m.gusts)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Measurements */}
        <div className="grid grid-cols-2 gap-5 p-5 sm:grid-cols-3 lg:grid-cols-5">
          <Metric
            icon={Waves}
            iconColor={METRIC_ICONS.waves}
            label="Waves"
            value={data.current.waves != null ? `${dec(data.current.waves)} m` : '—'}
            note={
              data.current.wavePeriod != null
                ? `period ${dec(data.current.wavePeriod)} s`
                : undefined
            }
          />
          {tide?.upcoming && nowHour?.tide != null && (
            <Metric
              icon={tide.upcoming.kind === 'high' ? ArrowUp : ArrowDown}
              iconColor={tide.upcoming.kind === 'high' ? TIDE_RISING : TIDE_FALLING}
              label="Tide"
              value={`${nowHour.tide > 0 ? '+' : ''}${dec(nowHour.tide, 2)} m`}
              note={`${tide.upcoming.kind === 'high' ? 'high' : 'low'} water ${fmtHour(tide.upcoming.time)}`}
            />
          )}
          <Metric
            icon={Thermometer}
            iconColor={METRIC_ICONS.temp}
            label="Temperature"
            value={data.current.temp != null ? `${dec(data.current.temp, 0)} °C` : '—'}
          />
          <Metric
            icon={Droplets}
            iconColor={METRIC_ICONS.rain}
            label="Rain"
            value={data.current.rain != null ? `${dec(data.current.rain)} mm` : '—'}
          />
          <Metric
            icon={Moon}
            iconColor={METRIC_ICONS.sky}
            label="Sky"
            value={weatherText(data.current.code)}
          />
        </div>
      </section>

      {/* ---------------- FISHING ---------------- */}
      <section className="overflow-hidden rounded-2xl border border-border bg-card">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 bg-panel-header p-5">
          <div>
            <p className="flex items-center gap-2 text-[10px] font-medium uppercase tracking-[0.22em] text-panel-header-foreground/55">
              <Fish className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
              Fishing
            </p>
            <p className="mt-1 text-xs uppercase tracking-[0.12em] text-panel-header-foreground/40">
              Sea temperature, swell, current
              <span className="hidden sm:inline"> and the bite window</span>
            </p>
          </div>

          {/* Bite outlook: named factors, never a single opaque score, so the
              skipper can see which one he disagrees with. */}
          {bite.length > 0 && (
            <div className="ml-auto flex flex-wrap items-center gap-2">
              <span className="text-[10px] font-medium uppercase tracking-[0.18em] text-panel-header-foreground/45">
                {biteFavor} of {bite.length} favour
              </span>
              <span className="flex gap-1" aria-hidden>
                {bite.map((f) => (
                  <span
                    key={f.label}
                    className={cn(
                      'h-1.5 w-6 rounded-full',
                      f.good ? 'bg-[#8fae92]' : 'bg-panel-header-foreground/20',
                    )}
                  />
                ))}
              </span>
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 gap-5 p-5 sm:grid-cols-3 lg:grid-cols-4">
          <Metric
            icon={Thermometer}
            iconColor={METRIC_ICONS.sst}
            label="Sea temp"
            value={data.current.sst != null ? `${dec(data.current.sst)} °C` : '—'}
            note="surface"
          />
          <Metric
            icon={Waves}
            iconColor={METRIC_ICONS.swell}
            label="Swell"
            value={data.current.swell != null ? `${dec(data.current.swell)} m` : '—'}
            note={
              data.current.swellPeriod != null
                ? `${dec(data.current.swellPeriod)} s from ${compass(data.current.swellDir)}`
                : undefined
            }
          />
          <Metric
            icon={Navigation}
            iconColor={METRIC_ICONS.current}
            label="Current"
            value={
              data.current.currentVel != null
                ? `${dec(data.current.currentVel)} km/h`
                : '—'
            }
            note={
              data.current.currentDir != null
                ? `towards ${compass(data.current.currentDir)}`
                : undefined
            }
          />
          <Metric
            icon={Gauge}
            iconColor={METRIC_ICONS.pressure}
            label="Pressure"
            value={
              data.current.pressure != null
                ? `${dec(data.current.pressure, 0)} hPa`
                : '—'
            }
            note={
              data.current.pressureTrend != null
                ? `${data.current.pressureTrend > 0 ? '+' : ''}${dec(data.current.pressureTrend)} / 3 h ${
                    data.current.pressureTrend <= -0.7
                      ? '— falling'
                      : data.current.pressureTrend >= 0.7
                        ? '— rising'
                        : '— steady'
                  }`
                : undefined
            }
          />
          <Metric
            icon={Eye}
            iconColor={METRIC_ICONS.visibility}
            label="Visibility"
            value={
              data.current.visibility != null
                ? `${dec(data.current.visibility / 1000, 1)} km`
                : '—'
            }
          />
          {todaySky?.sunrise && (
            <Metric
              icon={Sunrise}
              iconColor={METRIC_ICONS.sun}
              label="Sunrise"
              value={fmtHour(todaySky.sunrise)}
            />
          )}
          {todaySky?.sunset && (
            <Metric
              icon={Sunset}
              iconColor={METRIC_ICONS.sun}
              label="Sunset"
              value={fmtHour(todaySky.sunset)}
            />
          )}
          {todaySky && (
            <Metric
              icon={Moon}
              iconColor={METRIC_ICONS.moon}
              label="Moon"
              value={`${Math.round(todaySky.moonIllum * 100)} %`}
              note={todaySky.moonLabel}
            />
          )}
        </div>

        {bite.length > 0 && (
          <div className="border-t border-border px-5 pb-5 pt-4">
            <ul className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:gap-x-6">
              {bite.map((f) => (
                <li key={f.label} className="flex items-baseline gap-2 text-xs">
                  <span
                    className={cn(
                      'mt-1 h-1.5 w-1.5 flex-shrink-0 rounded-full',
                      f.good
                        ? 'bg-[#2f7f45] dark:bg-[#8fae92]'
                        : 'bg-muted-foreground/40',
                    )}
                    aria-hidden
                  />
                  <span className="text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
                    {f.label}
                  </span>
                  <span
                    className={cn(
                      f.good ? 'text-foreground' : 'text-muted-foreground',
                    )}
                  >
                    {f.detail}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      {/* Fleet used to sit here. It now has its own page at /admin/fleet,
          reachable from the sidebar — this page was ~4000 px tall, so anything
          added to it was effectively invisible. */}

      {/* ---------------- TIDE ---------------- */}
      {tide && tide.list.length > 0 && (
        <section className="overflow-hidden rounded-2xl border border-border bg-card">
          <button
            type="button"
            onClick={() => setTideOpen((v) => !v)}
            aria-expanded={tideOpen}
            title={
              tide.upcoming
                ? `Show tide — ${tide.upcoming.kind === 'high' ? 'high' : 'low'} water at ${fmtHour(tide.upcoming.time)}`
                : 'Show tide'
            }
            className="flex w-full cursor-pointer items-center gap-3 bg-panel-header p-5 text-left transition-colors hover:bg-panel-header-hover"
          >
            <span className="text-[10px] font-medium uppercase tracking-[0.22em] text-panel-header-foreground/55">
              Tide
            </span>

            {tideOpen ? (
              nowHour?.tide != null && (
                <span className="text-sm text-panel-header-foreground/70">
                  Now{' '}
                  <span className="font-medium tabular-nums text-panel-header-foreground">
                    {nowHour.tide > 0 ? '+' : ''}
                    {dec(nowHour.tide, 2)} m
                  </span>
                </span>
              )
            ) : (
              tide.upcoming && (
                <span className="flex items-center gap-2 text-sm text-panel-header-foreground/70">
                  {tide.upcoming.kind === 'high' ? (
                    <ArrowUp
                      className={cn('h-3.5 w-3.5', TIDE_RISING_ON_HEADER)}
                      strokeWidth={2.5}
                      aria-hidden
                    />
                  ) : (
                    <ArrowDown
                      className={cn('h-3.5 w-3.5', TIDE_FALLING_ON_HEADER)}
                      strokeWidth={2.5}
                      aria-hidden
                    />
                  )}
                  <span className="font-medium tabular-nums text-panel-header-foreground">
                    {fmtHour(tide.upcoming.time)}
                  </span>
                  <span className="hidden sm:inline">
                    {tide.upcoming.kind === 'high' ? 'high water' : 'low water'}
                  </span>
                  <span className="text-xs">{countdown(tide.upcoming.time, nowLocal)}</span>
                </span>
              )
            )}

            <ChevronDown
              className={cn(
                'ml-auto h-4 w-4 text-panel-header-foreground/50 transition-transform',
                tideOpen && 'rotate-180',
              )}
              strokeWidth={1.75}
            />
          </button>

          <div className={cn('p-5', !tideOpen && 'hidden')}>
            <TideCurve curve={tide.curve} nowLocal={nowLocal} />
            <div className="mt-5 grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-3">
              {tide.list.map((t) => (
                <div key={t.time} className="flex items-center gap-2.5">
                  {t.kind === 'high' ? (
                    <ArrowUp className={cn('h-3.5 w-3.5 shrink-0', TIDE_RISING)} strokeWidth={2.5} aria-hidden />
                  ) : (
                    <ArrowDown className={cn('h-3.5 w-3.5 shrink-0', TIDE_FALLING)} strokeWidth={2.5} aria-hidden />
                  )}
                  <div className="min-w-0">
                    <p className="text-sm font-medium tabular-nums text-foreground">
                      {fmtHour(t.time)}{' '}
                      <span className="font-normal text-muted-foreground">
                        {t.height > 0 ? '+' : ''}
                        {dec(t.height, 2)} m
                      </span>
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {t.kind === 'high' ? 'High water' : 'Low water'} ·{' '}
                      {relDay(dayOf(t.time), dayOf(nowLocal)).toLowerCase()}
                    </p>
                  </div>
                </div>
              ))}
            </div>
            <p className="mt-4 text-xs text-muted-foreground">
              Heights are relative to mean sea level (not depths).
            </p>
          </div>
        </section>
      )}

      {/* ---------------- HOURLY ---------------- */}
      <section className="overflow-hidden rounded-2xl border border-border bg-card">
        <div className="bg-panel-header p-5">
          <p className="text-[10px] font-medium uppercase tracking-[0.22em] text-panel-header-foreground/55">
            Hourly forecast
          </p>
          <p className="mt-1 text-xs uppercase tracking-[0.12em] text-panel-header-foreground/40">
            Today by the hour
            <span className="hidden sm:inline">, then 3-hour steps</span>
          </p>
        </div>

        <div className="divide-y divide-border">
          {byDay.map(({ day, hours, i }) => {
            const open = openDays[day] ?? i === 0
            const dayGusts = maxOf(hours, (h) => h.gusts)
            // Period uses the day's SHORTEST value — the choppiest hour is the
            // one that decides whether the day is comfortable.
            const dayState = seaState(
              dayGusts,
              maxOf(hours, (h) => h.waves),
              minOf(hours, (h) => h.wavePeriod),
            )
            // The column is drawn only on days that have something to say;
            // a permanently reserved one would waste 38 px on a phone.
            const dayShowRisk = hours.some((h) => (h.pCaution ?? 0) >= 0.1)

            return (
              <div key={day}>
                <button
                  type="button"
                  onClick={() => setOpenDays((p) => ({ ...p, [day]: !open }))}
                  aria-expanded={open}
                  className="flex w-full cursor-pointer items-center gap-3 p-4 text-left transition-colors hover:bg-secondary/50"
                >
                  <div className="min-w-0">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-foreground">
                      {relDay(day, dayOf(nowLocal))}
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">{shortDate(day)}</p>
                  </div>

                  {!open && dayGusts != null && (
                    <span className="ml-auto flex items-center gap-2 text-xs text-muted-foreground">
                      <span className={cn('h-2 w-2 rounded-full', dayState.stripe)} />
                      <span className="hidden sm:inline">gusts</span>
                      <span>
                        to{' '}
                        <span className="font-medium tabular-nums text-foreground">
                          {windText(dayGusts)} {unit}
                        </span>
                      </span>
                    </span>
                  )}

                  <ChevronDown
                    className={cn(
                      'h-4 w-4 shrink-0 text-muted-foreground transition-transform',
                      open ? 'rotate-180' : '',
                      open && 'ml-auto',
                    )}
                    strokeWidth={1.75}
                  />
                </button>

                <div className={cn('pb-2', !open && 'hidden')}>
                  {hours.length === 0 ? (
                    <p className="px-4 pb-3 text-sm text-muted-foreground">
                      No hours left today — look at tomorrow.
                    </p>
                  ) : (
                    hours.map((h) => {
                      const s = seaState(h.gusts, h.waves, h.wavePeriod)
                      const pC = h.pCaution ?? 0
                      const pD = h.pDanger ?? 0
                      return (
                        <div
                          key={h.time}
                          className="flex items-center gap-3 px-4 py-2 text-sm"
                        >
                          <span className={cn('h-8 w-[3px] shrink-0 rounded-full', s.stripe)} />
                          <span className="w-12 shrink-0 tabular-nums text-foreground">
                            {fmtHour(h.time)}
                          </span>
                          <span className="w-24 shrink-0 tabular-nums text-muted-foreground">
                            {windText(h.wind)}
                            <span className="text-muted-foreground/60"> / </span>
                            <span className="text-foreground">{windText(h.gusts)}</span>
                          </span>
                          <span className="w-16 shrink-0 tabular-nums text-muted-foreground">
                            {h.waves != null ? `${dec(h.waves)} m` : '—'}
                          </span>
                          <span className="w-12 shrink-0 tabular-nums text-muted-foreground">
                            {h.rainProb != null ? `${h.rainProb}%` : '—'}
                          </span>
                          {dayShowRisk && (
                            <span
                              className={cn(
                                'w-12 shrink-0 tabular-nums',
                                riskTone(pC, pD),
                              )}
                              title={
                                h.enLo != null
                                  ? `${Math.round(pC * 100)}% above ${SEA_LIMITS.cautionGusts} km/h · ${Math.round(pD * 100)}% above ${SEA_LIMITS.dangerGusts} km/h · members ${Math.round(h.enLo)}–${Math.round(h.enHi ?? 0)} km/h`
                                  : undefined
                              }
                            >
                              {pC >= 0.1 ? `${Math.round(pC * 100)}%` : ''}
                            </span>
                          )}
                          <SkyIcon
                            code={h.code}
                            className={cn('ml-auto h-4 w-4 shrink-0', METRIC_ICONS.sky)}
                          />
                        </div>
                      )
                    })
                  )}
                </div>
              </div>
            )
          })}
        </div>

        {/* Legend */}
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-border px-4 py-3 text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
          <span>Time</span>
          <span>Wind / gusts</span>
          <span>Waves</span>
          <span>Rain</span>
          <span>Risk above {SEA_LIMITS.cautionGusts} km/h</span>
          <span>Sky</span>
        </div>
      </section>

      {/* ---------------- WINDY MAP ---------------- */}
      <section className="overflow-hidden rounded-2xl border border-border bg-card">
        <div className="bg-panel-header p-5">
          <p className="text-[10px] font-medium uppercase tracking-[0.22em] text-panel-header-foreground/55">
            Windy map
          </p>
          <p className="mt-1 text-xs uppercase tracking-[0.12em] text-panel-header-foreground/40">
            Live wind and sea around {LODGE.name}
          </p>
        </div>

        {/* Layer picker */}
        <div className="flex flex-wrap gap-2 border-b border-border p-4">
          {OVERLAYS.map((o) => {
            const active = overlay === o.id
            return (
              <button
                key={o.id}
                type="button"
                onClick={() => setOverlay(o.id)}
                aria-pressed={active}
                className={cn(
                  'min-h-11 cursor-pointer rounded-full border px-4 text-[11px] font-semibold uppercase tracking-[0.14em] transition-colors',
                  active
                    ? 'border-accent bg-accent/15 text-accent'
                    : 'border-border bg-secondary/60 text-muted-foreground hover:bg-secondary',
                )}
              >
                {o.label}
              </button>
            )
          })}
        </div>

        {/* key={} forces a real reload — without it the overlay/unit change
            does not take effect inside the iframe. */}
        <iframe
          key={`${overlay}-${unit}`}
          title={`Windy map — ${overlay}`}
          src={
            'https://embed.windy.com/embed2.html' +
            `?lat=${LODGE.latitude}&lon=${LODGE.longitude}` +
            `&detailLat=${LODGE.latitude}&detailLon=${LODGE.longitude}` +
            '&width=100%25&height=100%25&zoom=9&level=surface' +
            `&overlay=${overlay}` +
            '&menu=&message=&marker=true&calendar=now&pressure=&type=map' +
            '&location=coordinates&detail=' +
            // Metric units. metricWaves is DELIBERATELY absent: it has no
            // effect, the wave legend stays in feet — hence the note below.
            `&metricWind=${encodeURIComponent(u.windy)}` +
            '&metricTemp=%C2%B0C&metricRain=mm&radarRange=-1'
          }
          className="h-[420px] w-full border-0"
          loading="lazy"
        />

        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-t border-border px-4 py-3 text-xs text-muted-foreground">
          <span>
            {overlay === 'waves'
              ? 'Windy’s wave legend is in feet (1 m ≈ 3.3 ft).'
              : 'Map data: Windy.com'}
          </span>
          <a
            href={`https://www.windy.com/${LODGE.latitude}/${LODGE.longitude}?${overlay},${LODGE.latitude},${LODGE.longitude},9`}
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-accent underline-offset-4 hover:underline"
          >
            Open in Windy
          </a>
        </div>
      </section>

      <p className="text-xs text-muted-foreground">
        Source: Open-Meteo — ECMWF, GFS, ICON and Météo-France models, plus the
        51-member ECMWF ensemble. Updated every 15 minutes.
      </p>
    </div>
  )
}

/** Shift a bare local time string by hours (UTC on both sides). */
function shiftLocal(t: string, hours: number): string {
  const ms = Date.parse(`${t.slice(0, 16)}:00Z`)
  return new Date(ms + hours * 3600_000).toISOString().slice(0, 16)
}

/* ------------------------------------------------------------------ *
 * Tide curve
 * ------------------------------------------------------------------ */

/**
 * Hourly samples joined with a Catmull-Rom spline (expressed as cubic beziers)
 * instead of straight segments, so high and low water read as round turns
 * rather than corners. Control points are clamped to the drawing band because
 * a spline can otherwise overshoot past a crest.
 */
function smoothPath(pts: { x: number; y: number }[], top: number, bottom: number) {
  const clamp = (v: number) => Math.min(bottom, Math.max(top, v))
  const n = (v: number) => Number(v.toFixed(2))
  let d = `M ${n(pts[0].x)} ${n(pts[0].y)}`

  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i]
    const p1 = pts[i]
    const p2 = pts[i + 1]
    const p3 = pts[i + 2] ?? p2
    const c1x = p1.x + (p2.x - p0.x) / 6
    const c1y = clamp(p1.y + (p2.y - p0.y) / 6)
    const c2x = p2.x - (p3.x - p1.x) / 6
    const c2y = clamp(p2.y - (p3.y - p1.y) / 6)
    d += ` C ${n(c1x)} ${n(c1y)}, ${n(c2x)} ${n(c2y)}, ${n(p2.x)} ${n(p2.y)}`
  }

  return d
}

function TideCurve({ curve, nowLocal }: { curve: WeatherHour[]; nowLocal: string }) {
  // Must run before the early return below — hooks cannot be conditional.
  const gradientId = useId()

  if (curve.length < 3) return null

  const vals = curve.map((h) => h.tide as number)
  const lo = Math.min(...vals)
  const hi = Math.max(...vals)
  const span = hi - lo || 1

  const pts = curve.map((h, i) => ({
    x: (i / (curve.length - 1)) * 100,
    y: 38 - (((h.tide as number) - lo) / span) * 34,
  }))

  const line = smoothPath(pts, 3, 39)
  const area = `${line} L 100 40 L 0 40 Z`

  const nowKey = `${nowLocal.slice(0, 13)}:00`
  const nowIdx = curve.findIndex((h) => h.time === nowKey)
  const now = nowIdx >= 0 ? pts[nowIdx] : null

  const first = curve[0]
  const last = curve[curve.length - 1]
  const lastIsOtherDay = dayOf(last.time) !== dayOf(first.time)

  return (
    <div>
      <div className={cn('relative', TIDE_CURVE)}>
        <svg viewBox="0 0 100 40" preserveAspectRatio="none" className="h-14 w-full sm:h-24" aria-hidden>
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="currentColor" stopOpacity={0.34} />
              <stop offset="100%" stopColor="currentColor" stopOpacity={0.02} />
            </linearGradient>
          </defs>

          <path d={area} fill={`url(#${gradientId})`} />

          {/* `non-scaling-stroke` is essential here: preserveAspectRatio="none"
              stretches the box ~10x horizontally, which turned this hairline
              into a 6px band of near-square dashes. */}
          {now && (
            <line
              x1={now.x}
              y1="0"
              x2={now.x}
              y2="40"
              stroke="currentColor"
              strokeOpacity={0.35}
              strokeWidth={1}
              strokeDasharray="1.5 3"
              vectorEffect="non-scaling-stroke"
            />
          )}

          <path
            d={line}
            fill="none"
            stroke="currentColor"
            strokeWidth={1.6}
            strokeLinecap="round"
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
          />
        </svg>

        {/* Marks the water level right now. Deliberately an HTML element, not an
            SVG circle — the non-uniform scale would flatten a circle into a
            wide ellipse. */}
        {now && (
          <span
            className="pointer-events-none absolute h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-current ring-2 ring-card"
            style={{ left: `${now.x}%`, top: `${(now.y / 40) * 100}%` }}
          />
        )}
      </div>
      <div className="mt-1.5 flex justify-between text-[10px] tabular-nums text-muted-foreground">
        <span>{fmtHour(first.time)}</span>
        <span>
          {fmtHour(last.time)}
          {lastIsOtherDay && <span className="ml-1 uppercase tracking-wider">tomorrow</span>}
        </span>
      </div>
    </div>
  )
}
