// Shared, synchronous schedule helpers (server actions import the types, the
// client imports the maths). Kept out of the 'use server' file on purpose.

export type ShiftColor = 'gold' | 'blue' | 'green' | 'coral' | 'violet'

export type ScheduleShift = {
  code: string
  label: string
  hours: number
  color: ShiftColor
}

export type ScheduleGroup = {
  id: string
  name: string
  shifts: ScheduleShift[]
  memberIds: string[]
}

export type ScheduleCell = { staffId: string; date: string; shift: string }

export const OFF = 'OFF'

export const DEFAULT_SHIFTS: ScheduleShift[] = [
  { code: 'S1', label: 'Morning 6-12:30', hours: 6.5, color: 'gold' },
  { code: 'S2', label: 'Afternoon 12-18:30', hours: 6.5, color: 'blue' },
]

export const SHIFT_COLORS: ShiftColor[] = ['gold', 'blue', 'green', 'coral', 'violet']

export const SHIFT_CLASSES: Record<ShiftColor, string> = {
  gold: 'border-[#c59b5b]/40 bg-[#c59b5b]/15 text-[#c59b5b]',
  blue: 'border-[#7fa8b8]/40 bg-[#7fa8b8]/15 text-[#7fa8b8]',
  green: 'border-[#8fae92]/40 bg-[#8fae92]/15 text-[#8fae92]',
  coral: 'border-[#cc8e77]/40 bg-[#cc8e77]/15 text-[#cc8e77]',
  violet: 'border-[#a08bc4]/40 bg-[#a08bc4]/15 text-[#a08bc4]',
}

export function daysInMonth(month: string): number {
  const [y, m] = month.split('-').map(Number)
  return new Date(y, m, 0).getDate()
}

export function monthDates(month: string): string[] {
  const n = daysInMonth(month)
  return Array.from({ length: n }, (_, i) => `${month}-${String(i + 1).padStart(2, '0')}`)
}

export function weekday(iso: string): number {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d).getDay()
}

// --- Madagascar public holidays (fixed + Easter-based) ---------------------

const FIXED_HOLIDAYS: Record<string, string> = {
  '1-1': "Jour de l'An",
  '3-8': 'Journée de la Femme',
  '3-29': 'Fête des Martyrs',
  '5-1': 'Fête du Travail',
  '6-26': "Fête de l'Indépendance",
  '8-15': 'Assomption',
  '11-1': 'Toussaint',
  '12-25': 'Noël',
}

function easterSunday(year: number): Date {
  const a = year % 19
  const b = Math.floor(year / 100)
  const c = year % 100
  const d = Math.floor(b / 4)
  const e = b % 4
  const f = Math.floor((b + 8) / 25)
  const g = Math.floor((b - f + 1) / 3)
  const h = (19 * a + b - d - g + 15) % 30
  const i = Math.floor(c / 4)
  const k = c % 4
  const l = (32 + 2 * e + 2 * i - h - k) % 7
  const m = Math.floor((a + 11 * h + 22 * l) / 451)
  const month = Math.floor((h + l - 7 * m + 114) / 31)
  const day = ((h + l - 7 * m + 114) % 31) + 1
  return new Date(year, month - 1, day)
}

const holidayCache = new Map<number, Map<string, string>>()

function holidayMap(year: number): Map<string, string> {
  const cached = holidayCache.get(year)
  if (cached) return cached
  const map = new Map(Object.entries(FIXED_HOLIDAYS))
  const easter = easterSunday(year)
  const movable: [number, string][] = [
    [0, 'Pâques'],
    [1, 'Lundi de Pâques'],
    [39, 'Ascension'],
    [49, 'Pentecôte'],
    [50, 'Lundi de Pentecôte'],
  ]
  for (const [add, name] of movable) {
    const d = new Date(easter.getFullYear(), easter.getMonth(), easter.getDate() + add)
    const key = `${d.getMonth() + 1}-${d.getDate()}`
    if (!map.has(key)) map.set(key, name)
  }
  holidayCache.set(year, map)
  return map
}

export function holidayName(iso: string): string | null {
  const [y, m, d] = iso.split('-').map(Number)
  return holidayMap(y).get(`${m}-${d}`) ?? null
}

// --- Generator ---------------------------------------------------------------

/**
 * 6 days on + 1 day off per person, with the day off staggered so people are
 * not all off together. The working shift rotates weekly, so over time
 * everyone works every shift. Leave days are always OFF.
 */
export function generateMonth(
  month: string,
  memberIds: string[],
  shifts: ScheduleShift[],
  isOnLeave: (staffId: string, iso: string) => boolean,
): ScheduleCell[] {
  const cells: ScheduleCell[] = []
  if (shifts.length === 0) return cells
  const [y, m] = month.split('-').map(Number)
  for (const iso of monthDates(month)) {
    const d = Number(iso.slice(8, 10))
    const globalDay = Math.floor(Date.UTC(y, m - 1, d) / 86_400_000)
    const week = Math.floor(globalDay / 7)
    memberIds.forEach((staffId, idx) => {
      let shift: string
      if (isOnLeave(staffId, iso)) shift = OFF
      else if ((globalDay + idx) % 7 === 6) shift = OFF
      else shift = shifts[(idx + week) % shifts.length].code
      cells.push({ staffId, date: iso, shift })
    })
  }
  return cells
}

export type HoursSummary = {
  staffId: string
  shifts: number
  total: number
  sunday: number
  holiday: number
}

export function summarizeHours(
  memberIds: string[],
  cells: ScheduleCell[],
  shifts: ScheduleShift[],
): HoursSummary[] {
  const hoursOf = new Map(shifts.map((s) => [s.code, s.hours]))
  return memberIds.map((staffId) => {
    const own = cells.filter((c) => c.staffId === staffId && c.shift !== OFF)
    let total = 0
    let sunday = 0
    let holiday = 0
    for (const c of own) {
      const h = hoursOf.get(c.shift) ?? 0
      total += h
      if (holidayName(c.date)) holiday += h
      else if (weekday(c.date) === 0) sunday += h
    }
    return { staffId, shifts: own.length, total, sunday, holiday }
  })
}
