/**
 * Shared fleet-operations helpers.
 *
 * A plain module, not an action file: a file with "use server" may only export
 * async functions, so constants and sync helpers exported from there break the
 * page at runtime. Both app/actions/fleet.ts and the position ingest route
 * (app/api/fleet/position/route.ts) import from here.
 */

import { LODGE } from '@/lib/lodge'

/** Why a boat went out. Drives the icon and colour on the trip cards. */
export const TRIP_PURPOSES = [
  { id: 'excursion', label: 'Excursion' },
  { id: 'fishing', label: 'Fishing' },
  { id: 'transfer', label: 'Guest transfer' },
  { id: 'supply', label: 'Supply run' },
  { id: 'maintenance', label: 'Maintenance / test' },
  { id: 'other', label: 'Other' },
] as const

export type TripPurpose = (typeof TRIP_PURPOSES)[number]['id']

export function purposeLabel(id: string): string {
  return TRIP_PURPOSES.find((p) => p.id === id)?.label ?? id
}

/**
 * Minutes without a GPS fix before a boat counts as out of contact.
 *
 * 30 is deliberately not lower: the phone buffers positions when it loses
 * signal and uploads them in a batch, and mobile coverage around the islands
 * drops out for several minutes at a time. A 10-minute limit would cry wolf on
 * every normal trip, and an alert that is usually wrong gets ignored.
 */
export const NO_SIGNAL_MIN = 30

/** Ids follow the project's existing shape, e.g. res-1782052633737-7a27ec69. */
export function newId(prefix: string): string {
  const rand = Math.random().toString(16).slice(2, 14)
  return `${prefix}-${Date.now()}-${rand}`
}

/**
 * Great-circle distance in nautical miles.
 *
 * Used to total a trip's distance from its own track. Straight-line between
 * consecutive fixes, which slightly UNDER-reads a curving course — acceptable,
 * because the alternative (no distance at all) tells the office nothing, and
 * over-reading would inflate the engine-hour and fuel figures derived from it.
 */
export function haversineNm(
  a: { lat: number; lon: number },
  b: { lat: number; lon: number },
): number {
  const R = 3440.065 // Earth radius in nautical miles
  const toRad = (d: number) => (d * Math.PI) / 180
  const dLat = toRad(b.lat - a.lat)
  const dLon = toRad(b.lon - a.lon)
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLon / 2) ** 2
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)))
}

/** Total track length in nautical miles. */
export function trackDistanceNm(
  points: { lat: number; lon: number }[],
): number {
  let sum = 0
  for (let i = 1; i < points.length; i++) {
    sum += haversineNm(points[i - 1], points[i])
  }
  return sum
}

/**
 * Lodge-local "now". Madagascar is UTC+3 all year (no DST).
 *
 * Everything that judges time — has the boat left, is it after dark, how long
 * since the last fix — must use THIS and never `new Date()` on its own, or the
 * answer would depend on the clock of whoever is looking at the screen.
 */
export function lodgeNow(): {
  today: string
  hhmm: string
  nowLocal: string
  /** Real instant, for durations against timestamptz columns. */
  instant: Date
} {
  const now = new Date()
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: LODGE.timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(now)

  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '00'
  const today = `${get('year')}-${get('month')}-${get('day')}`
  // Intl returns "24" for midnight in some runtimes.
  const hh = get('hour') === '24' ? '00' : get('hour')
  const hhmm = `${hh}:${get('minute')}`

  return { today, hhmm, nowLocal: `${today}T${hhmm}`, instant: now }
}

/** Lodge-local HH:MM for any instant (e.g. a stored timestamp). */
export function lodgeTime(at: Date | string | null | undefined): string {
  if (!at) return ''
  const d = at instanceof Date ? at : new Date(at)
  if (Number.isNaN(d.getTime())) return ''
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: LODGE.timezone,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(d)
}

/** "2 h 14 min" / "6 min" — for trip length and time since last fix. */
export function humanDuration(minutes: number): string {
  const m = Math.max(0, Math.round(minutes))
  if (m < 60) return `${m} min`
  const h = Math.floor(m / 60)
  const rest = m % 60
  return rest ? `${h} h ${rest} min` : `${h} h`
}

/**
 * Sunrise / sunset for the lodge, as lodge-local HH:MM.
 *
 * Computed rather than fetched: the "boat still out after dark" alert must work
 * even when the weather API is unreachable, and that is exactly the situation
 * where you least want the safety check to go quiet. NOAA low-precision
 * algorithm — good to about a minute, far tighter than this decision needs.
 */
export function sunTimes(dateISO: string): { sunrise: string; sunset: string } {
  const [y, m, d] = dateISO.split('-').map(Number)
  const dayMs = Date.UTC(y, (m || 1) - 1, d || 1)
  const n = Math.floor(dayMs / 86400000) - 10957 // days since 2000-01-01
  const lat = LODGE.latitude
  const lon = LODGE.longitude
  const rad = Math.PI / 180

  const meanLong = (280.46 + 0.9856474 * n) % 360
  const meanAnom = ((357.528 + 0.9856003 * n) % 360) * rad
  const ecLong =
    (meanLong +
      1.915 * Math.sin(meanAnom) +
      0.02 * Math.sin(2 * meanAnom)) *
    rad
  const obliq = 23.439 * rad
  const decl = Math.asin(Math.sin(obliq) * Math.sin(ecLong))

  // Equation of time, in minutes.
  const eot =
    4 *
    ((meanLong -
      0.0057183 -
      (Math.atan2(
        Math.cos(obliq) * Math.sin(ecLong),
        Math.cos(ecLong),
      ) /
        rad +
        360) %
        360) %
      360)
  const eotAdj = eot > 20 ? eot - 1440 : eot < -20 ? eot + 1440 : eot

  const cosH =
    (Math.cos(90.833 * rad) - Math.sin(lat * rad) * Math.sin(decl)) /
    (Math.cos(lat * rad) * Math.cos(decl))

  // No sunrise/sunset at this latitude today (never happens at 13°S, but the
  // maths must not return NaN and silently disable the after-dark alert).
  if (cosH > 1 || cosH < -1) return { sunrise: '06:00', sunset: '18:00' }

  const H = Math.acos(cosH) / rad
  const noonUTC = 720 - 4 * lon - eotAdj // minutes UTC
  const offsetMin = 180 // Indian/Antananarivo = UTC+3, fixed

  const fmt = (utcMinutes: number) => {
    const local = ((utcMinutes + offsetMin) % 1440 + 1440) % 1440
    const hh = String(Math.floor(local / 60)).padStart(2, '0')
    const mm = String(Math.round(local % 60)).padStart(2, '0')
    return `${hh}:${mm}`
  }

  return { sunrise: fmt(noonUTC - 4 * H), sunset: fmt(noonUTC + 4 * H) }
}
