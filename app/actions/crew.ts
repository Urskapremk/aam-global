'use server'

import { and, desc, eq, gte, lt } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'

import { db } from '@/lib/db'
import { captains, crewPayout, trips } from '@/lib/db/schema'
import { isAdmin } from '@/lib/admin-auth'

// Lodge clock is UTC+3 (Indian/Antananarivo). A payroll month must be the local
// calendar month the crew actually worked, not a UTC month that would push a
// late-evening trip into the wrong month. Same offset used across the app.
const LODGE_OFFSET_MS = 3 * 3600_000

function lodgeMonthKey(d: Date): string {
  return new Date(d.getTime() + LODGE_OFFSET_MS).toISOString().slice(0, 7)
}

function monthRangeUtc(month: string): { start: Date; end: Date } {
  const [y, m] = month.split('-').map(Number)
  return {
    start: new Date(Date.UTC(y, m - 1, 1) - LODGE_OFFSET_MS),
    end: new Date(Date.UTC(y, m, 1) - LODGE_OFFSET_MS),
  }
}

function newId(): string {
  return typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`
}

export type CrewRole = 'captain' | 'crew'

export type PayoutRow = {
  id: string
  personName: string
  role: CrewRole
  amountAr: number
  note: string | null
  loggedBy: string | null
  paidAt: string
}

// One worker's month: hours come from the trips they ran (a recorded fact),
// paid comes from the payout ledger (another recorded fact). The two are shown
// side by side but never divided into an implied rate — no agreed rate exists.
export type CrewMonthRow = {
  name: string
  role: CrewRole
  trips: number
  // Hours are only summed from trips that have both a start and an end. A trip
  // still running, or one never closed, contributes 0 rather than a guess.
  hours: number
  // How many of this person's trips lacked an end time, so the reader knows the
  // hours above are for fewer trips than the count suggests.
  tripsMissingTime: number
  paidAr: number
}

export type CrewMonth = {
  month: string
  rows: CrewMonthRow[]
  payouts: PayoutRow[]
  totalPaidAr: number
  availableMonths: string[]
}

function hoursBetween(start: Date | null, end: Date | null): number | null {
  if (!start || !end) return null
  const h = (end.getTime() - start.getTime()) / 3600_000
  return h > 0 ? h : null
}

/**
 * Payroll view for one lodge-local month.
 *
 * The unit of a person is their NAME: captains carry a name on their row, crew
 * are free-text names on a trip. So captain trips and crew trips are folded
 * into the same name-keyed map — a person who both captained and crewed shows
 * once, and their role is whichever they filled (captain wins as the senior
 * role if both appear, which is rare but must not double-list them).
 */
export async function getCrewMonth(month?: string): Promise<CrewMonth> {
  const key = month ?? lodgeMonthKey(new Date())
  const { start, end } = monthRangeUtc(key)

  const [captainRows, tripRows, payoutRows, allTripDates] = await Promise.all([
    db
      .select({ id: captains.id, name: captains.name })
      .from(captains),
    db
      .select({
        captainId: trips.captainId,
        crew: trips.crew,
        startedAt: trips.startedAt,
        endedAt: trips.endedAt,
      })
      .from(trips)
      .where(and(gte(trips.startedAt, start), lt(trips.startedAt, end))),
    db
      .select()
      .from(crewPayout)
      .where(and(gte(crewPayout.paidAt, start), lt(crewPayout.paidAt, end)))
      .orderBy(desc(crewPayout.paidAt)),
    // For the month switcher: every month that has either a trip or a payout.
    db.select({ at: trips.startedAt }).from(trips),
  ])

  const captainName = new Map(captainRows.map((c) => [c.id, c.name]))

  type Agg = {
    name: string
    role: CrewRole
    trips: number
    hours: number
    tripsMissingTime: number
  }
  const byName = new Map<string, Agg>()

  const bump = (name: string, role: CrewRole, hrs: number | null) => {
    const clean = name.trim()
    if (!clean) return
    const cur =
      byName.get(clean) ??
      ({ name: clean, role, trips: 0, hours: 0, tripsMissingTime: 0 } as Agg)
    // Captain is the senior label: if a name appears as both, keep 'captain'.
    if (role === 'captain') cur.role = 'captain'
    cur.trips += 1
    if (hrs == null) cur.tripsMissingTime += 1
    else cur.hours += hrs
    byName.set(clean, cur)
  }

  for (const t of tripRows) {
    const hrs = hoursBetween(t.startedAt, t.endedAt)
    const cap = t.captainId ? captainName.get(t.captainId) : null
    if (cap) bump(cap, 'captain', hrs)
    // crew is a jsonb string[] of free-text names; each shares the trip's hours.
    const crew = Array.isArray(t.crew) ? (t.crew as unknown[]) : []
    for (const member of crew) {
      if (typeof member === 'string') bump(member, 'crew', hrs)
    }
  }

  // Fold in what was paid this month, so a person who was paid but ran no trips
  // (e.g. a bonus, or paid for last month's work) still appears in the table.
  const paidByName = new Map<string, number>()
  for (const p of payoutRows) {
    paidByName.set(
      p.personName,
      (paidByName.get(p.personName) ?? 0) + p.amountAr,
    )
    if (!byName.has(p.personName)) {
      byName.set(p.personName, {
        name: p.personName,
        role: (p.role as CrewRole) ?? 'crew',
        trips: 0,
        hours: 0,
        tripsMissingTime: 0,
      })
    }
  }

  const rows: CrewMonthRow[] = [...byName.values()]
    .map((a) => ({
      name: a.name,
      role: a.role,
      trips: a.trips,
      hours: Math.round(a.hours * 10) / 10,
      tripsMissingTime: a.tripsMissingTime,
      paidAr: paidByName.get(a.name) ?? 0,
    }))
    // Captains first, then most trips, then by name — a stable, readable order.
    .sort(
      (x, y) =>
        (x.role === y.role ? 0 : x.role === 'captain' ? -1 : 1) ||
        y.trips - x.trips ||
        x.name.localeCompare(y.name),
    )

  const months = new Set<string>()
  months.add(lodgeMonthKey(new Date()))
  for (const r of allTripDates) if (r.at) months.add(lodgeMonthKey(new Date(r.at)))
  for (const p of payoutRows) months.add(lodgeMonthKey(new Date(p.paidAt)))
  months.add(key)

  return {
    month: key,
    rows,
    payouts: payoutRows.map((p) => ({
      id: p.id,
      personName: p.personName,
      role: (p.role as CrewRole) ?? 'crew',
      amountAr: p.amountAr,
      note: p.note,
      loggedBy: p.loggedBy,
      paidAt: p.paidAt.toISOString(),
    })),
    totalPaidAr: payoutRows.reduce((s, p) => s + p.amountAr, 0),
    availableMonths: [...months].sort().reverse(),
  }
}

// Names to offer in the payout form: every captain plus every crew name ever
// typed on a trip, so the office picks a known worker instead of re-typing.
export async function getKnownWorkers(): Promise<
  { name: string; role: CrewRole }[]
> {
  const [captainRows, tripRows] = await Promise.all([
    db.select({ name: captains.name }).from(captains),
    db.select({ crew: trips.crew }).from(trips),
  ])
  const map = new Map<string, CrewRole>()
  for (const c of captainRows) if (c.name.trim()) map.set(c.name.trim(), 'captain')
  for (const t of tripRows) {
    const crew = Array.isArray(t.crew) ? (t.crew as unknown[]) : []
    for (const m of crew) {
      if (typeof m === 'string' && m.trim() && !map.has(m.trim())) {
        map.set(m.trim(), 'crew')
      }
    }
  }
  return [...map.entries()]
    .map(([name, role]) => ({ name, role }))
    .sort((a, b) => a.name.localeCompare(b.name))
}

export async function logPayout(input: {
  personName: string
  role: CrewRole
  amountAr: number
  note?: string | null
  loggedBy?: string | null
  paidAt?: string | null
}): Promise<{ ok: true }> {
  if (!(await isAdmin())) throw new Error('Not authorised')
  const name = input.personName.trim()
  if (!name) throw new Error('Name required')
  if (!(input.amountAr > 0)) throw new Error('Amount must be greater than zero')

  await db.insert(crewPayout).values({
    id: newId(),
    personName: name,
    role: input.role === 'captain' ? 'captain' : 'crew',
    amountAr: input.amountAr,
    note: input.note?.trim() || null,
    loggedBy: input.loggedBy?.trim() || null,
    paidAt: input.paidAt ? new Date(input.paidAt) : new Date(),
  })
  revalidatePath('/admin/crew')
  return { ok: true }
}

export async function deletePayout(id: string): Promise<{ ok: true }> {
  if (!(await isAdmin())) throw new Error('Not authorised')
  await db.delete(crewPayout).where(eq(crewPayout.id, id))
  revalidatePath('/admin/crew')
  return { ok: true }
}
