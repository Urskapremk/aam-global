'use server'

import { LODGE, SEA_LIMITS } from '@/lib/lodge'

/**
 * Weather station data (Open-Meteo — no API key, no registration).
 *
 * Four sources are fetched in ONE Promise.all. Three of them carry
 * .catch(() => null): the marine source, the model comparison and the ensemble
 * are enrichments — if any of them is unreachable the forecast must still
 * render. Do not "simplify" that away.
 *
 * Windy is deliberately not used: their data API is a separate product
 * (~EUR 990/year) and the free tier intentionally returns distorted values.
 */

export type WeatherHour = {
  time: string
  wind: number | null
  gusts: number | null
  direction: number | null
  waves: number | null
  wavePeriod: number | null
  tide: number | null
  temp: number | null
  rainProb: number | null
  code: number | null
  /** Sea surface temperature, °C. Tuna and billfish follow temperature breaks. */
  sst: number | null
  /** Swell kept SEPARATE from wind waves — they behave differently at sea. */
  swell: number | null
  swellPeriod: number | null
  swellDir: number | null
  windWave: number | null
  /** Surface current, km/h and degrees — matters for trolling and for fuel. */
  currentVel: number | null
  currentDir: number | null
  /** Pressure, hPa. A falling barometer is when the fish feed. */
  pressure: number | null
  /** Visibility, metres from the source. */
  visibility: number | null
  /** Ensemble: share of members above the caution / danger gust limit (0-1). */
  pCaution?: number
  pDanger?: number
  /** Ensemble spread of gusts, km/h. */
  enLo?: number
  enHi?: number
}

export type TideTurn = {
  time: string
  height: number
  kind: 'high' | 'low'
}

export type ModelReading = {
  id: string
  label: string
  gusts: number
  primary?: boolean
}

/** Sun and moon for one day, used for departure planning. */
export type SkyDay = {
  /** YYYY-MM-DD */
  date: string
  /** Bare local "YYYY-MM-DDTHH:MM" from the source. */
  sunrise: string | null
  sunset: string | null
  /** 0 = new, 0.5 = full, 1 = new again. */
  moonPhase: number
  /** Illuminated fraction, 0-1. */
  moonIllum: number
  moonLabel: string
}

export type WeatherData = {
  /** "Now" as reported by the model, in lodge local time. Never use new Date(). */
  nowLocal: string
  current: {
    wind: number | null
    gusts: number | null
    direction: number | null
    temp: number | null
    rain: number | null
    code: number | null
    waves: number | null
    wavePeriod: number | null
    sst: number | null
    swell: number | null
    swellPeriod: number | null
    swellDir: number | null
    currentVel: number | null
    currentDir: number | null
    pressure: number | null
    visibility: number | null
    /** hPa change over the last 3 h. Negative = falling. */
    pressureTrend: number | null
  }
  hours: WeatherHour[]
  tides: TideTurn[]
  models: ModelReading[]
  sky: SkyDay[]
}

const AIR_HOURLY = [
  'temperature_2m',
  'wind_speed_10m',
  'wind_gusts_10m',
  'wind_direction_10m',
  'precipitation_probability',
  'weather_code',
  'pressure_msl',
  'visibility',
].join(',')

const MARINE_HOURLY = [
  'wave_height',
  'wave_period',
  'sea_level_height_msl',
  'sea_surface_temperature',
  'swell_wave_height',
  'swell_wave_period',
  'swell_wave_direction',
  'wind_wave_height',
  'ocean_current_velocity',
  'ocean_current_direction',
].join(',')

const REVALIDATE = 900 // 15 min — the models themselves refresh hourly.

async function getJson(url: string) {
  const res = await fetch(url, {
    next: { revalidate: REVALIDATE },
    signal: AbortSignal.timeout(12000),
  })
  if (!res.ok) throw new Error(`Open-Meteo ${res.status}`)
  return res.json()
}

/** Shift a bare local time string ("YYYY-MM-DDTHH:MM") by whole/partial hours. */
function shiftHours(t: string, hours: number): string {
  // Parse the bare local string AS UTC and print it back as UTC, so the
  // arithmetic can never drag the value into another timezone.
  const ms = Date.parse(t.length === 16 ? `${t}:00Z` : `${t}Z`)
  return new Date(ms + hours * 3600_000).toISOString().slice(0, 16)
}

/**
 * Find local maxima/minima of the hourly sea level and refine the moment with a
 * parabola through three points. Raw hourly samples would place every high
 * water on a whole hour — up to 30 minutes off, which is the difference between
 * catching the water and dragging the boat.
 */
function tideTurns(times: string[], levels: (number | null)[]): TideTurn[] {
  const out: TideTurn[] = []
  for (let i = 1; i < levels.length - 1; i++) {
    const a = levels[i - 1]
    const b = levels[i]
    const c = levels[i + 1]
    if (a == null || b == null || c == null) continue
    const isHigh = b >= a && b >= c && (b > a || b > c)
    const isLow = b <= a && b <= c && (b < a || b < c)
    if (!isHigh && !isLow) continue

    const denom = a - 2 * b + c
    let offset = denom === 0 ? 0 : 0.5 * (a - c) / denom
    offset = Math.max(-0.5, Math.min(0.5, offset))
    const height = b - 0.25 * (a - c) * offset

    out.push({
      time: shiftHours(times[i], offset),
      height: Math.round(height * 100) / 100,
      kind: isHigh ? 'high' : 'low',
    })
  }
  return out
}

/**
 * Moon phase from the date alone — pure astronomy, no external source, so it
 * cannot fail or rate-limit. Counted from a known new moon (2000-01-06 18:14
 * UTC) over the synodic month. Accurate to well under a day, which is all a
 * fishing/tide judgement needs.
 */
function moonFor(date: string): { phase: number; illum: number; label: string } {
  const NEW_MOON = Date.UTC(2000, 0, 6, 18, 14)
  const SYNODIC = 29.530588853 * 86400_000
  // Midday of the day, so the label describes the day as a whole.
  const ms = Date.parse(`${date}T12:00:00Z`)
  let phase = ((ms - NEW_MOON) % SYNODIC) / SYNODIC
  if (phase < 0) phase += 1

  const illum = (1 - Math.cos(2 * Math.PI * phase)) / 2
  // Spring tides (biggest range) sit at new and full moon — the label has to
  // name those two, because that is what changes the water.
  const label =
    phase < 0.03 || phase > 0.97
      ? 'New moon'
      : phase < 0.22
        ? 'Waxing crescent'
        : phase < 0.28
          ? 'First quarter'
          : phase < 0.47
            ? 'Waxing gibbous'
            : phase < 0.53
              ? 'Full moon'
              : phase < 0.72
                ? 'Waning gibbous'
                : phase < 0.78
                  ? 'Last quarter'
                  : 'Waning crescent'

  return { phase, illum, label }
}

export async function getWeather(): Promise<WeatherData> {
  const { latitude: lat, longitude: lon, timezone: tz } = LODGE
  const base = `latitude=${lat}&longitude=${lon}&timezone=${encodeURIComponent(tz)}`

  const airUrl =
    `https://api.open-meteo.com/v1/forecast?${base}` +
    `&current=temperature_2m,wind_speed_10m,wind_gusts_10m,wind_direction_10m,precipitation,weather_code` +
    `&hourly=${AIR_HOURLY}&daily=sunrise,sunset&forecast_days=4`

  const marineUrl =
    `https://marine-api.open-meteo.com/v1/marine?${base}` +
    `&hourly=${MARINE_HOURLY}&forecast_days=4`

  // Model comparison. best_match MUST be in the list and shown as "Our reading",
  // otherwise the card's big number can fall outside the printed range and the
  // panel reads as a contradiction. ecmwf_ifs04 is left out — it returns null.
  const modelsUrl =
    `https://api.open-meteo.com/v1/forecast?${base}` +
    `&hourly=wind_gusts_10m&forecast_days=2` +
    `&models=best_match,ecmwf_ifs025,gfs_seamless,icon_seamless,meteofrance_seamless`

  // 51-member ECMWF ensemble: control run + member01..member50. All 51 count as
  // a single opinion and give us a probability instead of one number.
  const ensembleUrl =
    `https://ensemble-api.open-meteo.com/v1/ensemble?${base}` +
    `&models=ecmwf_ifs025&hourly=wind_gusts_10m&forecast_days=4`

  const [air, marine, models, ensemble] = await Promise.all([
    getJson(airUrl),
    getJson(marineUrl).catch(() => null),
    getJson(modelsUrl).catch(() => null),
    getJson(ensembleUrl).catch(() => null),
  ])

  const times: string[] = air?.hourly?.time ?? []
  const nowLocal: string = air?.current?.time ?? times[0] ?? ''

  // Marine data lives on a separate host with its own time array — key the
  // lookup by TIMESTAMP, never by index.
  type MarineHour = {
    h: number | null
    p: number | null
    t: number | null
    sst: number | null
    swell: number | null
    swellP: number | null
    swellD: number | null
    windWave: number | null
    curV: number | null
    curD: number | null
  }
  const wave = new Map<string, MarineHour>()
  const mTimes: string[] = marine?.hourly?.time ?? []
  const mh = marine?.hourly
  mTimes.forEach((t, i) => {
    wave.set(t, {
      h: mh?.wave_height?.[i] ?? null,
      p: mh?.wave_period?.[i] ?? null,
      t: mh?.sea_level_height_msl?.[i] ?? null,
      sst: mh?.sea_surface_temperature?.[i] ?? null,
      swell: mh?.swell_wave_height?.[i] ?? null,
      swellP: mh?.swell_wave_period?.[i] ?? null,
      swellD: mh?.swell_wave_direction?.[i] ?? null,
      windWave: mh?.wind_wave_height?.[i] ?? null,
      curV: mh?.ocean_current_velocity?.[i] ?? null,
      curD: mh?.ocean_current_direction?.[i] ?? null,
    })
  })

  // Ensemble: same rule — separate host, own time array, key by timestamp.
  const ens = new Map<string, { pC: number; pD: number; lo: number; hi: number }>()
  if (ensemble?.hourly) {
    const eTimes: string[] = ensemble.hourly.time ?? []
    const memberKeys = Object.keys(ensemble.hourly).filter((k) =>
      k.startsWith('wind_gusts_10m'),
    )
    eTimes.forEach((t, i) => {
      const vals: number[] = []
      for (const k of memberKeys) {
        const v = ensemble.hourly[k]?.[i]
        if (typeof v === 'number') vals.push(v)
      }
      // Too small a sample cannot carry a percentage.
      if (vals.length < 10) return
      // Read from SEA_LIMITS so the percentage can never describe a limit the
      // badge does not use.
      const pC = vals.filter((v) => v >= SEA_LIMITS.cautionGusts).length / vals.length
      const pD = vals.filter((v) => v >= SEA_LIMITS.dangerGusts).length / vals.length
      ens.set(t, {
        pC,
        pD,
        lo: Math.min(...vals),
        hi: Math.max(...vals),
      })
    })
  }

  const hours: WeatherHour[] = times.map((t, i) => {
    const w = wave.get(t)
    const e = ens.get(t)
    return {
      time: t,
      wind: air.hourly.wind_speed_10m?.[i] ?? null,
      gusts: air.hourly.wind_gusts_10m?.[i] ?? null,
      direction: air.hourly.wind_direction_10m?.[i] ?? null,
      waves: w?.h ?? null,
      wavePeriod: w?.p ?? null,
      tide: w?.t ?? null,
      temp: air.hourly.temperature_2m?.[i] ?? null,
      rainProb: air.hourly.precipitation_probability?.[i] ?? null,
      code: air.hourly.weather_code?.[i] ?? null,
      sst: w?.sst ?? null,
      swell: w?.swell ?? null,
      swellPeriod: w?.swellP ?? null,
      swellDir: w?.swellD ?? null,
      windWave: w?.windWave ?? null,
      currentVel: w?.curV ?? null,
      currentDir: w?.curD ?? null,
      pressure: air.hourly.pressure_msl?.[i] ?? null,
      visibility: air.hourly.visibility?.[i] ?? null,
      pCaution: e ? e.pC : undefined,
      pDanger: e ? e.pD : undefined,
      enLo: e ? e.lo : undefined,
      enHi: e ? e.hi : undefined,
    }
  })

  // Tide curve runs from 3 h back to 24 h ahead — the past is what tells you
  // whether the water is coming in or going out.
  const tides = tideTurns(mTimes, marine?.hourly?.sea_level_height_msl ?? [])

  // Model comparison for the CURRENT hour only. Pick the hour by string slicing
  // (never new Date(), which would shift the hour).
  const modelList: ModelReading[] = []
  if (models?.hourly) {
    const mdlTimes: string[] = models.hourly.time ?? []
    const wanted = `${nowLocal.slice(0, 13)}:00`
    const idx = mdlTimes.indexOf(wanted)
    if (idx !== -1) {
      const defs: { key: string; label: string; primary?: boolean }[] = [
        { key: 'best_match', label: 'Our reading', primary: true },
        { key: 'ecmwf_ifs025', label: 'ECMWF' },
        { key: 'gfs_seamless', label: 'GFS' },
        { key: 'icon_seamless', label: 'ICON' },
        { key: 'meteofrance_seamless', label: 'Météo-France' },
      ]
      for (const d of defs) {
        const v = models.hourly[`wind_gusts_10m_${d.key}`]?.[idx]
        if (typeof v === 'number') {
          modelList.push({
            id: d.key,
            label: d.label,
            gusts: v,
            primary: d.primary,
          })
        }
      }
    }
  }

  const nowKey = `${nowLocal.slice(0, 13)}:00`
  const nowWave = wave.get(nowKey)

  // Sun times come from the source (they depend on latitude and date), the moon
  // is computed locally.
  const sky: SkyDay[] = (air?.daily?.time ?? []).map((d: string, i: number) => {
    const m = moonFor(d)
    return {
      date: d,
      sunrise: air.daily.sunrise?.[i] ?? null,
      sunset: air.daily.sunset?.[i] ?? null,
      moonPhase: m.phase,
      moonIllum: m.illum,
      moonLabel: m.label,
    }
  })

  // Pressure trend over the last 3 h. The DIRECTION is the useful part, so it
  // is measured against the reading 3 h back, not against the daily mean.
  const nowIdx = times.indexOf(nowKey)
  const pNow = nowIdx >= 0 ? air.hourly.pressure_msl?.[nowIdx] : null
  const pThen = nowIdx >= 3 ? air.hourly.pressure_msl?.[nowIdx - 3] : null
  const pressureTrend =
    typeof pNow === 'number' && typeof pThen === 'number'
      ? Math.round((pNow - pThen) * 10) / 10
      : null

  return {
    nowLocal,
    current: {
      wind: air?.current?.wind_speed_10m ?? null,
      gusts: air?.current?.wind_gusts_10m ?? null,
      direction: air?.current?.wind_direction_10m ?? null,
      temp: air?.current?.temperature_2m ?? null,
      rain: air?.current?.precipitation ?? null,
      code: air?.current?.weather_code ?? null,
      waves: nowWave?.h ?? null,
      wavePeriod: nowWave?.p ?? null,
      sst: nowWave?.sst ?? null,
      swell: nowWave?.swell ?? null,
      swellPeriod: nowWave?.swellP ?? null,
      swellDir: nowWave?.swellD ?? null,
      currentVel: nowWave?.curV ?? null,
      currentDir: nowWave?.curD ?? null,
      pressure: typeof pNow === 'number' ? pNow : null,
      visibility: nowIdx >= 0 ? (air.hourly.visibility?.[nowIdx] ?? null) : null,
      pressureTrend,
    },
    hours,
    tides,
    models: modelList,
    sky,
  }
}
