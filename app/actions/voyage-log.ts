'use server'

import { and, asc, desc, eq } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'

import { isAdmin } from '@/lib/admin-auth'
import { db } from '@/lib/db'
import {
  captains,
  complianceAudit,
  trips,
  tripPositions,
  voyageEvents,
  voyageLogs,
} from '@/lib/db/schema'
import { newId } from '@/lib/fleet'
import { boatName } from '@/lib/boats'

async function requireAdmin() {
  if (!(await isAdmin())) throw new Error('Not authorised')
}

export type VoyageEvent = {
  id: string
  type: string
  at: string
  lat: number | null
  lon: number | null
  description: string | null
  captain: string | null
  actionTaken: string | null
}

export type VoyageLogRow = {
  tripId: string
  logId: string | null
  boat: string
  boatLabel: string
  entryNumber: number | null
  purpose: string
  status: string // trip status: active | completed
  captainName: string | null
  crew: string[]
  date: string | null // departure day
  startedAt: string | null
  endedAt: string | null
  departureLocation: string | null
  departureLat: number | null
  departureLon: number | null
  arrivalLocation: string | null
  arrivalLat: number | null
  arrivalLon: number | null
  destination: string | null
  guests: number
  crewCount: number
  passengerCount: number
  engineHoursStart: number | null
  engineHoursEnd: number | null
  distanceNm: number | null
  officialStatus: string
  officialAuthorityType: string | null
  officialAuthorityOffice: string | null
  officialOfficer: string | null
  officialDate: string | null
  officialReference: string | null
  officialNotes: string | null
  unscheduled: UnscheduledEntry | null
  approvedBy: string | null
  approvedAt: string | null
  locked: boolean
  notes: string | null
  events: VoyageEvent[]
}

export type UnscheduledEntry = {
  date?: string | null
  time?: string | null
  originalDestination?: string | null
  actualPort?: string | null
  lat?: number | null
  lon?: number | null
  reason?: string | null
  reasonNotes?: string | null
  authorityNotified?: string | null
  authorityOfficer?: string | null
  authorityTime?: string | null
  authorityReference?: string | null
  authorityNotes?: string | null
}

function toIso(v: Date | string | null): string | null {
  if (!v) return null
  return v instanceof Date ? v.toISOString() : String(v)
}

/**
 * The voyage logbook for one boat. Every trip is a logbook entry — the trip
 * row is the source of truth for the operational facts, and the voyage_logs
 * row (if any) carries the compliance extras. We derive the combined view on
 * read and only persist a voyage_logs row once the captain actually edits or
 * approves it, so there are no empty stub rows lying around.
 */
export async function getVoyageLogs(boat: string): Promise<VoyageLogRow[]> {
  await requireAdmin()

  const [tripRows, capRows, logRows, eventRows, posRows] = await Promise.all([
    db
      .select()
      .from(trips)
      .where(eq(trips.boat, boat))
      .orderBy(desc(trips.startedAt)),
    db.select().from(captains),
    db.select().from(voyageLogs).where(eq(voyageLogs.boat, boat)),
    db.select().from(voyageEvents).where(eq(voyageEvents.boat, boat)),
    // Only need first/last fix per trip; pull all and reduce in memory (small).
    db
      .select({
        tripId: tripPositions.tripId,
        lat: tripPositions.lat,
        lon: tripPositions.lon,
        recordedAt: tripPositions.recordedAt,
      })
      .from(tripPositions)
      .orderBy(asc(tripPositions.recordedAt)),
  ])

  const capName = (id: string | null) =>
    id ? (capRows.find((c) => c.id === id)?.name ?? null) : null
  const logByTrip = new Map(logRows.map((l) => [l.tripId, l]))
  const firstFix = new Map<string, { lat: number; lon: number }>()
  const lastFix = new Map<string, { lat: number; lon: number }>()
  for (const p of posRows) {
    if (!firstFix.has(p.tripId)) firstFix.set(p.tripId, { lat: p.lat, lon: p.lon })
    lastFix.set(p.tripId, { lat: p.lat, lon: p.lon })
  }
  const eventsByTrip = new Map<string, VoyageEvent[]>()
  for (const e of eventRows) {
    const list = eventsByTrip.get(e.tripId) ?? []
    list.push({
      id: e.id,
      type: e.type,
      at: toIso(e.at)!,
      lat: e.lat,
      lon: e.lon,
      description: e.description,
      captain: e.captain,
      actionTaken: e.actionTaken,
    })
    eventsByTrip.set(e.tripId, list)
  }

  return tripRows.map((t) => {
    const log = logByTrip.get(t.id)
    const crew = Array.isArray(t.crew) ? (t.crew as string[]) : []
    const dep = firstFix.get(t.id)
    const arr = lastFix.get(t.id)
    return {
      tripId: t.id,
      logId: log?.id ?? null,
      boat: t.boat,
      boatLabel: boatName(t.boat),
      entryNumber: log?.entryNumber ?? null,
      purpose: t.purpose,
      status: t.status,
      captainName: capName(t.captainId),
      crew,
      date: toIso(t.startedAt)?.slice(0, 10) ?? null,
      startedAt: toIso(t.startedAt),
      endedAt: toIso(t.endedAt),
      departureLocation: log?.departureLocation ?? null,
      departureLat: log?.departureLat ?? dep?.lat ?? null,
      departureLon: log?.departureLon ?? dep?.lon ?? null,
      arrivalLocation: log?.arrivalLocation ?? null,
      arrivalLat: log?.arrivalLat ?? arr?.lat ?? null,
      arrivalLon: log?.arrivalLon ?? arr?.lon ?? null,
      destination: t.destination,
      guests: t.guests ?? 0,
      crewCount: log?.crewCount ?? crew.length,
      passengerCount: log?.passengerCount ?? t.guests ?? 0,
      engineHoursStart: t.engineHoursStart,
      engineHoursEnd: t.engineHoursEnd,
      distanceNm: t.distanceNm,
      officialStatus: log?.officialStatus ?? 'not-required',
      officialAuthorityType: log?.officialAuthorityType ?? null,
      officialAuthorityOffice: log?.officialAuthorityOffice ?? null,
      officialOfficer: log?.officialOfficer ?? null,
      officialDate: log?.officialDate ?? null,
      officialReference: log?.officialReference ?? null,
      officialNotes: log?.officialNotes ?? null,
      unscheduled: (log?.unscheduled as UnscheduledEntry | null) ?? null,
      approvedBy: log?.approvedBy ?? null,
      approvedAt: toIso(log?.approvedAt ?? null),
      locked: log?.locked ?? false,
      notes: log?.notes ?? null,
      events: (eventsByTrip.get(t.id) ?? []).sort((a, b) =>
        a.at < b.at ? -1 : 1,
      ),
    }
  })
}

// Ensure a voyage_logs row exists for a trip and return its id. Assigns the
// next sequential entry number for the boat the first time the row is created,
// so PDF page/entry numbering stays stable.
async function ensureLog(tripId: string): Promise<{
  id: string
  locked: boolean
}> {
  const [existing] = await db
    .select()
    .from(voyageLogs)
    .where(eq(voyageLogs.tripId, tripId))
    .limit(1)
  if (existing) return { id: existing.id, locked: existing.locked }

  const [trip] = await db
    .select()
    .from(trips)
    .where(eq(trips.id, tripId))
    .limit(1)
  if (!trip) throw new Error('Trip not found')

  const boatLogs = await db
    .select({ n: voyageLogs.entryNumber })
    .from(voyageLogs)
    .where(eq(voyageLogs.boat, trip.boat))
  const nextEntry =
    boatLogs.reduce((max, r) => Math.max(max, r.n ?? 0), 0) + 1

  const id = newId('vlog')
  await db.insert(voyageLogs).values({
    id,
    tripId,
    boat: trip.boat,
    entryNumber: nextEntry,
  })
  return { id, locked: false }
}

function assertUnlocked(locked: boolean) {
  if (locked) {
    throw new Error(
      'This logbook entry is approved and locked. Make a correction instead.',
    )
  }
}

export type VoyageLogInput = {
  tripId: string
  departureLocation?: string | null
  arrivalLocation?: string | null
  crewCount?: number | null
  passengerCount?: number | null
  notes?: string | null
}

export async function saveVoyageLog(
  input: VoyageLogInput,
): Promise<{ ok: true }> {
  await requireAdmin()
  const { id, locked } = await ensureLog(input.tripId)
  assertUnlocked(locked)
  await db
    .update(voyageLogs)
    .set({
      departureLocation: input.departureLocation?.trim() || null,
      arrivalLocation: input.arrivalLocation?.trim() || null,
      crewCount: input.crewCount ?? null,
      passengerCount: input.passengerCount ?? null,
      notes: input.notes?.trim() || null,
      updatedAt: new Date(),
    })
    .where(eq(voyageLogs.id, id))
  revalidatePath('/admin/compliance/logbook')
  return { ok: true }
}

export async function addVoyageEvent(input: {
  tripId: string
  boat: string
  type: string
  at?: string | null
  lat?: number | null
  lon?: number | null
  description?: string | null
  captain?: string | null
  actionTaken?: string | null
}): Promise<{ ok: true }> {
  await requireAdmin()
  const { id, locked } = await ensureLog(input.tripId)
  assertUnlocked(locked)
  await db.insert(voyageEvents).values({
    id: newId('vevt'),
    voyageLogId: id,
    tripId: input.tripId,
    boat: input.boat,
    type: input.type,
    at: input.at ? new Date(input.at) : new Date(),
    lat: input.lat ?? null,
    lon: input.lon ?? null,
    description: input.description?.trim() || null,
    captain: input.captain?.trim() || null,
    actionTaken: input.actionTaken?.trim() || null,
  })
  revalidatePath('/admin/compliance/logbook')
  return { ok: true }
}

export async function saveOfficialValidation(input: {
  tripId: string
  status: string
  authorityType?: string | null
  authorityOffice?: string | null
  officer?: string | null
  date?: string | null
  reference?: string | null
  notes?: string | null
  fileUrl?: string | null
}): Promise<{ ok: true }> {
  await requireAdmin()
  const { id, locked } = await ensureLog(input.tripId)
  assertUnlocked(locked)
  await db
    .update(voyageLogs)
    .set({
      officialStatus: input.status,
      officialAuthorityType: input.authorityType?.trim() || null,
      officialAuthorityOffice: input.authorityOffice?.trim() || null,
      officialOfficer: input.officer?.trim() || null,
      officialDate: input.date || null,
      officialReference: input.reference?.trim() || null,
      officialNotes: input.notes?.trim() || null,
      officialFileUrl: input.fileUrl?.trim() || null,
      updatedAt: new Date(),
    })
    .where(eq(voyageLogs.id, id))
  revalidatePath('/admin/compliance/logbook')
  return { ok: true }
}

export async function recordUnscheduledEntry(input: {
  tripId: string
  entry: UnscheduledEntry
}): Promise<{ ok: true }> {
  await requireAdmin()
  const { id, locked } = await ensureLog(input.tripId)
  assertUnlocked(locked)
  await db
    .update(voyageLogs)
    .set({ unscheduled: input.entry, updatedAt: new Date() })
    .where(eq(voyageLogs.id, id))
  revalidatePath('/admin/compliance/logbook')
  return { ok: true }
}

/**
 * Captain review + lock. Records who approved, when, and an incrementing
 * approval version, then locks the entry read-only. A locked entry can only be
 * changed through a formal correction (audit trail), never edited in place.
 */
export async function approveVoyageLog(input: {
  tripId: string
  captain: string
}): Promise<{ ok: true }> {
  await requireAdmin()
  const { id } = await ensureLog(input.tripId)
  const [current] = await db
    .select()
    .from(voyageLogs)
    .where(eq(voyageLogs.id, id))
    .limit(1)
  const version = (current?.approvalVersion ?? 0) + 1
  const now = new Date()
  await db
    .update(voyageLogs)
    .set({
      approvedBy: input.captain,
      approvedAt: now,
      approvalVersion: version,
      locked: true,
      updatedAt: now,
    })
    .where(eq(voyageLogs.id, id))
  await db.insert(complianceAudit).values({
    id: newId('aud'),
    recordType: 'voyage-log',
    recordId: id,
    action: 'approve',
    newValue: `v${version}`,
    userName: input.captain,
  })
  revalidatePath('/admin/compliance/logbook')
  return { ok: true }
}
