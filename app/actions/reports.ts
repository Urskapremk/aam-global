'use server'

import { and, gte, lt } from 'drizzle-orm'

import { isAdmin } from '@/lib/admin-auth'
import { boatName, tripLabel } from '@/lib/boats'
import { db } from '@/lib/db'
import { boatBookings, catches, maintenanceLog, trips } from '@/lib/db/schema'

async function assertAdmin() {
  if (!(await isAdmin())) throw new Error('Not authorised')
}

// Madagascar is a fixed UTC+3 with no daylight saving. A month must be bucketed
// by the lodge's own calendar — a trip that left at 06:00 on the 1st must not
// land in the previous month because the server keeps UTC. This one constant,
// not a timezone library, is enough because the offset never changes.
const LODGE_OFFSET_MS = 3 * 3600_000

/** 'YYYY-MM' for the lodge-local month an instant falls in. */
function lodgeMonthKey(d: Date): string {
  return new Date(d.getTime() + LODGE_OFFSET_MS).toISOString().slice(0, 7)
}

/** The UTC instants that bound a lodge-local 'YYYY-MM' month. */
function monthRangeUtc(month: string): { start: Date; end: Date } {
  const [y, m] = month.split('-').map(Number)
  // Date.UTC(y, m-1, 1) is midnight UTC on the 1st; subtracting the offset
  // shifts it to the instant that reads as midnight on the 1st at the lodge.
  return {
    start: new Date(Date.UTC(y, m - 1, 1) - LODGE_OFFSET_MS),
    end: new Date(Date.UTC(y, m, 1) - LODGE_OFFSET_MS),
  }
}

function monthLabel(month: string): string {
  const [y, m] = month.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString('en-GB', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  })
}

export type MonthlyReport = {
  month: string
  label: string
  /**
   * Fewer than three completed trips is not enough to read as a trend. The flag
   * lets the UI show the real totals but refuse to dress them up as a pattern —
   * the same honesty as the maintenance page's "no baseline".
   */
  thin: boolean
  activity: {
    trips: number
    completed: number
    guests: number
    byBoat: { boat: string; name: string; count: number }[]
    byPurpose: { purpose: string; label: string; count: number }[]
    /** null, not 0, when no completed trip recorded its engine hours. */
    engineHours: number | null
    engineHoursTrips: number
    distanceNm: number | null
    distanceTrips: number
    /** Average tank percentage burned per trip. Percent, never litres: the
     *  boats have no metered tank, so a litre or fuel-cost figure would be
     *  invented. */
    fuelAvgPct: number | null
    fuelTrips: number
  }
  fishing: {
    total: number
    kept: number
    released: number
    topSpecies: { species: string; count: number }[]
    bestDay: { date: string; count: number } | null
  }
  revenue: {
    /** Sum of prices on bookings marked paid. */
    earnedEur: number
    /** Sum of prices on confirmed bookings, paid or not — the month's book. */
    bookedEur: number
    bookings: number
    confirmed: number
    /** Confirmed bookings with no price set. Revenue is understated by exactly
     *  these, so the UI must surface the count rather than imply €0. */
    pricesMissing: number
  }
  /** Kept in Ariary and NEVER folded into the EUR figures above: this app
   *  stores no exchange rate, so summing the two currencies would be a made-up
   *  number. The owner reads spend (Ar) and income (EUR) side by side. */
  costs: {
    maintenanceAr: number
    maintenanceItems: number
  }
}

function round1(n: number): number {
  return Math.round(n * 10) / 10
}

export async function getMonthlyReport(month: string): Promise<MonthlyReport> {
  await assertAdmin()
  const { start, end } = monthRangeUtc(month)

  const [tripRows, catchRows, logRows, bookingRows] = await Promise.all([
    db
      .select()
      .from(trips)
      .where(and(gte(trips.startedAt, start), lt(trips.startedAt, end))),
    db
      .select()
      .from(catches)
      .where(and(gte(catches.caughtAt, start), lt(catches.caughtAt, end))),
    db
      .select()
      .from(maintenanceLog)
      .where(and(gte(maintenanceLog.doneAt, start), lt(maintenanceLog.doneAt, end))),
    // Bookings carry a text calendar date (the day of the trip), which is
    // already lodge-local — bucket by its 'YYYY-MM' prefix, not by createdAt.
    db.select().from(boatBookings),
  ])

  // --- Activity ------------------------------------------------------------
  const completed = tripRows.filter((t) => t.status === 'completed')

  const boatCount = new Map<string, number>()
  const purposeCount = new Map<string, number>()
  for (const t of tripRows) {
    boatCount.set(t.boat, (boatCount.get(t.boat) ?? 0) + 1)
    purposeCount.set(t.purpose, (purposeCount.get(t.purpose) ?? 0) + 1)
  }

  let engineHours = 0
  let engineHoursTrips = 0
  let distanceNm = 0
  let distanceTrips = 0
  let fuelSum = 0
  let fuelTrips = 0
  let guests = 0
  for (const t of completed) {
    guests += t.guests ?? 0
    if (t.engineHoursStart != null && t.engineHoursEnd != null) {
      const d = t.engineHoursEnd - t.engineHoursStart
      if (d >= 0) {
        engineHours += d
        engineHoursTrips++
      }
    }
    if (t.distanceNm != null) {
      distanceNm += t.distanceNm
      distanceTrips++
    }
    if (t.fuelStartPct != null && t.fuelEndPct != null) {
      const burned = t.fuelStartPct - t.fuelEndPct
      if (burned >= 0) {
        fuelSum += burned
        fuelTrips++
      }
    }
  }

  // --- Fishing -------------------------------------------------------------
  const kept = catchRows.filter((c) => !c.released).length
  const released = catchRows.length - kept

  const speciesCount = new Map<string, number>()
  const dayCount = new Map<string, number>()
  for (const c of catchRows) {
    speciesCount.set(c.species, (speciesCount.get(c.species) ?? 0) + 1)
    // Lodge-local calendar day, so "best day" is the day the crew fished, not a
    // UTC day that could split an evening bite across two dates.
    const dayKey = new Date(new Date(c.caughtAt).getTime() + LODGE_OFFSET_MS)
      .toISOString()
      .slice(0, 10)
    dayCount.set(dayKey, (dayCount.get(dayKey) ?? 0) + 1)
  }
  const topSpecies = [...speciesCount.entries()]
    .map(([species, count]) => ({ species, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5)
  let bestDay: { date: string; count: number } | null = null
  for (const [date, count] of dayCount) {
    if (!bestDay || count > bestDay.count) bestDay = { date, count }
  }

  // --- Revenue (bucket bookings by their trip date) ------------------------
  const monthBookings = bookingRows.filter((b) => (b.date ?? '').startsWith(month))
  const confirmed = monthBookings.filter(
    (b) => b.status === 'confirmed',
  )
  let earnedEur = 0
  let bookedEur = 0
  let pricesMissing = 0
  for (const b of confirmed) {
    if (b.priceEur == null) {
      pricesMissing++
      continue
    }
    bookedEur += b.priceEur
    if (b.paymentStatus === 'paid') earnedEur += b.priceEur
  }

  // --- Costs ---------------------------------------------------------------
  let maintenanceAr = 0
  let maintenanceItems = 0
  for (const l of logRows) {
    if (l.costAr != null) {
      maintenanceAr += l.costAr
      maintenanceItems++
    }
  }

  return {
    month,
    label: monthLabel(month),
    thin: completed.length < 3,
    activity: {
      trips: tripRows.length,
      completed: completed.length,
      guests,
      byBoat: [...boatCount.entries()]
        .map(([boat, count]) => ({ boat, name: boatName(boat), count }))
        .sort((a, b) => b.count - a.count),
      byPurpose: [...purposeCount.entries()]
        .map(([purpose, count]) => ({ purpose, label: tripLabel(purpose), count }))
        .sort((a, b) => b.count - a.count),
      engineHours: engineHoursTrips > 0 ? round1(engineHours) : null,
      engineHoursTrips,
      distanceNm: distanceTrips > 0 ? round1(distanceNm) : null,
      distanceTrips,
      fuelAvgPct: fuelTrips > 0 ? Math.round(fuelSum / fuelTrips) : null,
      fuelTrips,
    },
    fishing: {
      total: catchRows.length,
      kept,
      released,
      topSpecies,
      bestDay,
    },
    revenue: {
      earnedEur,
      bookedEur,
      bookings: monthBookings.length,
      confirmed: confirmed.length,
      pricesMissing,
    },
    costs: { maintenanceAr, maintenanceItems },
  }
}

/**
 * Months that have any data, newest first, always including the current lodge
 * month so the page opens on something even before the first trip of the month.
 */
export async function getReportMonths(): Promise<string[]> {
  await assertAdmin()

  const [tripRows, catchRows, logRows, bookingRows] = await Promise.all([
    db.select({ at: trips.startedAt }).from(trips),
    db.select({ at: catches.caughtAt }).from(catches),
    db.select({ at: maintenanceLog.doneAt }).from(maintenanceLog),
    db.select({ date: boatBookings.date }).from(boatBookings),
  ])

  const months = new Set<string>()
  months.add(lodgeMonthKey(new Date()))
  for (const r of tripRows) if (r.at) months.add(lodgeMonthKey(new Date(r.at)))
  for (const r of catchRows) if (r.at) months.add(lodgeMonthKey(new Date(r.at)))
  for (const r of logRows) if (r.at) months.add(lodgeMonthKey(new Date(r.at)))
  for (const r of bookingRows) if (r.date) months.add(r.date.slice(0, 7))

  return [...months].sort().reverse()
}
