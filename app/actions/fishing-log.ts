'use server'

import { and, asc, desc, eq, gte, inArray, lte } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'

import { isAdmin } from '@/lib/admin-auth'
import { boatName } from '@/lib/boats'
import { newId } from '@/lib/fleet'
import { db } from '@/lib/db'
import {
  captains,
  catchDeclarations,
  catches,
  complianceAudit,
  fishingActivities,
  fishingBycatch,
  fishingLogs,
  protectedSpeciesIncidents,
  trips,
} from '@/lib/db/schema'

async function requireAdmin() {
  const ok = await isAdmin()
  if (!ok) throw new Error('Not authorized')
}

function audit(
  recordType: string,
  recordId: string,
  action: string,
  fields: Partial<{
    field: string
    previousValue: string | null
    newValue: string | null
    reason: string | null
    userName: string | null
  }> = {},
) {
  return db.insert(complianceAudit).values({
    id: newId('aud'),
    recordType,
    recordId,
    action,
    field: fields.field ?? null,
    previousValue: fields.previousValue ?? null,
    newValue: fields.newValue ?? null,
    reason: fields.reason ?? null,
    userName: fields.userName ?? null,
  })
}

export type FishingActivityRow = typeof fishingActivities.$inferSelect
export type BycatchRow = typeof fishingBycatch.$inferSelect
export type ProtectedRow = typeof protectedSpeciesIncidents.$inferSelect

export type FishingLogEntry = {
  tripId: string
  boat: string
  boatLabel: string
  captainName: string | null
  startedAt: string | null
  endedAt: string | null
  status: string
  log: typeof fishingLogs.$inferSelect | null
  activities: FishingActivityRow[]
  catches: {
    id: string
    species: string
    weightKg: number | null
    lengthCm: number | null
    released: boolean
    guestName: string | null
    method: string | null
  }[]
  bycatch: BycatchRow[]
  protected: ProtectedRow[]
  locked: boolean
  approvedBy: string | null
}

/**
 * All fishing trips for one boat, each with its compliance log, effort
 * activities, retained catches (from the existing `catches` table), bycatch,
 * discards and protected-species incidents assembled in one shape.
 */
export async function getFishingLog(boat: string): Promise<FishingLogEntry[]> {
  await requireAdmin()

  const tripRows = await db
    .select()
    .from(trips)
    .where(and(eq(trips.boat, boat), eq(trips.purpose, 'fishing')))
    .orderBy(desc(trips.startedAt))

  if (tripRows.length === 0) return []
  const tripIds = tripRows.map((t) => t.id)

  const [logs, acts, catchRows, bycatchRows, protectedRows, capRows] =
    await Promise.all([
      db.select().from(fishingLogs).where(inArray(fishingLogs.tripId, tripIds)),
      db
        .select()
        .from(fishingActivities)
        .where(inArray(fishingActivities.tripId, tripIds))
        .orderBy(asc(fishingActivities.startAt)),
      db.select().from(catches).where(inArray(catches.tripId, tripIds)),
      db
        .select()
        .from(fishingBycatch)
        .where(inArray(fishingBycatch.tripId, tripIds)),
      db
        .select()
        .from(protectedSpeciesIncidents)
        .where(inArray(protectedSpeciesIncidents.tripId, tripIds)),
      db.select().from(captains),
    ])

  const logByTrip = new Map(logs.map((l) => [l.tripId, l]))
  const capName = (id: string | null) =>
    id ? (capRows.find((c) => c.id === id)?.name ?? null) : null

  return tripRows.map((t) => {
    const log = logByTrip.get(t.id) ?? null
    return {
      tripId: t.id,
      boat: t.boat,
      boatLabel: boatName(t.boat),
      captainName: capName(t.captainId),
      startedAt: t.startedAt ? t.startedAt.toISOString() : null,
      endedAt: t.endedAt ? t.endedAt.toISOString() : null,
      status: t.status,
      log,
      activities: acts.filter((a) => a.tripId === t.id),
      catches: catchRows
        .filter((c) => c.tripId === t.id)
        .map((c) => ({
          id: c.id,
          species: c.species,
          weightKg: c.weightKg,
          lengthCm: c.lengthCm,
          released: c.released,
          guestName: c.guestName,
          method: c.method,
        })),
      bycatch: bycatchRows.filter((b) => b.tripId === t.id),
      protected: protectedRows.filter((p) => p.tripId === t.id),
      locked: log?.locked ?? false,
      approvedBy: log?.approvedBy ?? null,
    }
  })
}

async function ensureLog(tripId: string, boat: string) {
  const [existing] = await db
    .select()
    .from(fishingLogs)
    .where(eq(fishingLogs.tripId, tripId))
    .limit(1)
  if (existing) return existing
  const id = newId('flog')
  await db.insert(fishingLogs).values({ id, tripId, boat })
  const [created] = await db
    .select()
    .from(fishingLogs)
    .where(eq(fishingLogs.id, id))
    .limit(1)
  return created
}

async function assertUnlocked(tripId: string) {
  const [log] = await db
    .select({ locked: fishingLogs.locked })
    .from(fishingLogs)
    .where(eq(fishingLogs.tripId, tripId))
    .limit(1)
  if (log?.locked) throw new Error('This fishing log is approved and locked.')
}

export async function saveLandingRecord(
  tripId: string,
  boat: string,
  input: {
    authorizationNumber?: string | null
    landingDate?: string | null
    landingTime?: string | null
    landingLocation?: string | null
    landingLat?: number | null
    landingLon?: number | null
    landingRecipient?: string | null
    landingStorage?: string | null
    landingSale?: string | null
    landingNotes?: string | null
    notes?: string | null
  },
): Promise<{ ok: true }> {
  await requireAdmin()
  await assertUnlocked(tripId)
  const log = await ensureLog(tripId, boat)
  await db
    .update(fishingLogs)
    .set({
      authorizationNumber: input.authorizationNumber ?? log.authorizationNumber,
      landingDate: input.landingDate ?? log.landingDate,
      landingTime: input.landingTime ?? log.landingTime,
      landingLocation: input.landingLocation ?? log.landingLocation,
      landingLat: input.landingLat ?? log.landingLat,
      landingLon: input.landingLon ?? log.landingLon,
      landingRecipient: input.landingRecipient ?? log.landingRecipient,
      landingStorage: input.landingStorage ?? log.landingStorage,
      landingSale: input.landingSale ?? log.landingSale,
      landingNotes: input.landingNotes ?? log.landingNotes,
      notes: input.notes ?? log.notes,
      updatedAt: new Date(),
    })
    .where(eq(fishingLogs.id, log.id))
  await audit('fishing-log', tripId, 'update', { field: 'landing' })
  revalidatePath('/admin/compliance/fishing-log')
  return { ok: true }
}

export async function addFishingActivity(
  tripId: string,
  boat: string,
  input: {
    startAt?: string | null
    endAt?: string | null
    lat?: number | null
    lon?: number | null
    zone?: string | null
    depthM?: number | null
    method?: string | null
    gear?: string | null
    lines?: number | null
    hooks?: number | null
    rods?: number | null
    operations?: number | null
    trollingMinutes?: number | null
    effortNotes?: string | null
  },
  userName?: string,
): Promise<{ ok: true; id: string }> {
  await requireAdmin()
  await assertUnlocked(tripId)
  await ensureLog(tripId, boat)
  const id = newId('fact')
  await db.insert(fishingActivities).values({
    id,
    tripId,
    boat,
    startAt: input.startAt ? new Date(input.startAt) : null,
    endAt: input.endAt ? new Date(input.endAt) : null,
    lat: input.lat ?? null,
    lon: input.lon ?? null,
    // Seed the immutable original from the first GPS we get, so a later
    // captain correction always has something to compare against.
    latOriginal: input.lat ?? null,
    lonOriginal: input.lon ?? null,
    zone: input.zone ?? null,
    depthM: input.depthM ?? null,
    method: input.method ?? null,
    gear: input.gear ?? null,
    lines: input.lines ?? null,
    hooks: input.hooks ?? null,
    rods: input.rods ?? null,
    operations: input.operations ?? null,
    trollingMinutes: input.trollingMinutes ?? null,
    effortNotes: input.effortNotes ?? null,
    createdBy: userName ?? null,
  })
  await audit('fishing-log', tripId, 'create', {
    field: 'activity',
    newValue: id,
    userName: userName ?? null,
  })
  revalidatePath('/admin/compliance/fishing-log')
  return { ok: true, id }
}

/**
 * Correct an activity's GPS position. The original fix is preserved and the
 * change is only allowed with a reason, which is written to the audit trail —
 * the position is regulatory evidence, not a free-edit field.
 */
export async function amendActivityLocation(
  activityId: string,
  lat: number,
  lon: number,
  reason: string,
  userName?: string,
): Promise<{ ok: true }> {
  await requireAdmin()
  if (!reason.trim()) throw new Error('A reason is required to amend a location.')
  const [act] = await db
    .select()
    .from(fishingActivities)
    .where(eq(fishingActivities.id, activityId))
    .limit(1)
  if (!act) throw new Error('Activity not found.')
  await assertUnlocked(act.tripId)
  await db
    .update(fishingActivities)
    .set({
      lat,
      lon,
      // Keep the very first recorded fix as the immutable original.
      latOriginal: act.latOriginal ?? act.lat,
      lonOriginal: act.lonOriginal ?? act.lon,
      locationAmendedReason: reason.trim(),
    })
    .where(eq(fishingActivities.id, activityId))
  await audit('fishing-log', act.tripId, 'amend', {
    field: 'activity-location',
    previousValue: `${act.lat ?? '—'}, ${act.lon ?? '—'}`,
    newValue: `${lat}, ${lon}`,
    reason: reason.trim(),
    userName: userName ?? null,
  })
  revalidatePath('/admin/compliance/fishing-log')
  return { ok: true }
}

export async function addBycatch(
  tripId: string,
  boat: string,
  input: {
    kind: 'bycatch' | 'discard'
    species: string
    faoCode?: string | null
    numberCount?: number | null
    weightKg?: number | null
    fate?: string | null
    discardReason?: string | null
    condition?: string | null
    lat?: number | null
    lon?: number | null
    notes?: string | null
  },
  userName?: string,
): Promise<{ ok: true; id: string }> {
  await requireAdmin()
  await assertUnlocked(tripId)
  await ensureLog(tripId, boat)
  const id = newId('byc')
  await db.insert(fishingBycatch).values({
    id,
    tripId,
    boat,
    kind: input.kind,
    species: input.species.trim(),
    faoCode: input.faoCode?.trim() || null,
    numberCount: input.numberCount ?? null,
    weightKg: input.weightKg ?? null,
    fate: input.fate ?? null,
    discardReason: input.discardReason ?? null,
    condition: input.condition ?? null,
    lat: input.lat ?? null,
    lon: input.lon ?? null,
    notes: input.notes?.trim() || null,
    createdBy: userName ?? null,
  })
  await audit('fishing-log', tripId, 'create', {
    field: input.kind,
    newValue: input.species,
    userName: userName ?? null,
  })
  revalidatePath('/admin/compliance/fishing-log')
  return { ok: true, id }
}

export async function deleteBycatch(id: string): Promise<{ ok: true }> {
  await requireAdmin()
  const [row] = await db
    .select()
    .from(fishingBycatch)
    .where(eq(fishingBycatch.id, id))
    .limit(1)
  if (!row) return { ok: true }
  await assertUnlocked(row.tripId)
  await db.delete(fishingBycatch).where(eq(fishingBycatch.id, id))
  revalidatePath('/admin/compliance/fishing-log')
  return { ok: true }
}

export async function addProtectedIncident(
  tripId: string | null,
  boat: string,
  input: {
    species: string
    at?: string | null
    lat?: number | null
    lon?: number | null
    interactionType?: string | null
    outcome?: string | null
    condition?: string | null
    photoUrl?: string | null
    notes?: string | null
  },
  userName?: string,
): Promise<{ ok: true; id: string }> {
  await requireAdmin()
  if (tripId) await assertUnlocked(tripId)
  if (tripId) await ensureLog(tripId, boat)
  const id = newId('psi')
  await db.insert(protectedSpeciesIncidents).values({
    id,
    tripId,
    boat,
    species: input.species.trim(),
    at: input.at ? new Date(input.at) : null,
    lat: input.lat ?? null,
    lon: input.lon ?? null,
    interactionType: input.interactionType ?? null,
    outcome: input.outcome ?? null,
    condition: input.condition ?? null,
    photoUrl: input.photoUrl?.trim() || null,
    notes: input.notes?.trim() || null,
    createdBy: userName ?? null,
  })
  await audit('fishing-log', tripId ?? id, 'create', {
    field: 'protected-species',
    newValue: input.species,
    userName: userName ?? null,
  })
  revalidatePath('/admin/compliance/fishing-log')
  return { ok: true, id }
}

/** The captain confirms a protected-species incident — required before it counts. */
export async function confirmProtectedIncident(
  id: string,
  captain: string,
): Promise<{ ok: true }> {
  await requireAdmin()
  await db
    .update(protectedSpeciesIncidents)
    .set({
      captainConfirmed: true,
      confirmedBy: captain,
      confirmedAt: new Date(),
    })
    .where(eq(protectedSpeciesIncidents.id, id))
  await audit('fishing-log', id, 'approve', {
    field: 'protected-species-confirmed',
    newValue: captain,
    userName: captain,
  })
  revalidatePath('/admin/compliance/fishing-log')
  return { ok: true }
}

/**
 * Record a transshipment. Gated: the caller must pass `confirmed: true`, which
 * the UI only sends after showing the legal warning and getting an explicit
 * admin acknowledgement. Without it we refuse — a transshipment is never a
 * silent, normal event.
 */
export async function recordTransshipment(
  tripId: string,
  boat: string,
  input: {
    authorization?: string | null
    vessel?: string | null
    at?: string | null
    lat?: number | null
    lon?: number | null
    details?: string | null
    approvedBy: string
  },
  confirmed: boolean,
): Promise<{ ok: true }> {
  await requireAdmin()
  if (!confirmed || !input.approvedBy?.trim()) {
    throw new Error(
      'Transshipment requires explicit admin confirmation and authorization.',
    )
  }
  await assertUnlocked(tripId)
  const log = await ensureLog(tripId, boat)
  await db
    .update(fishingLogs)
    .set({
      transshipment: true,
      transshipmentAuthorization: input.authorization?.trim() || null,
      transshipmentVessel: input.vessel?.trim() || null,
      transshipmentAt: input.at ? new Date(input.at) : null,
      transshipmentLat: input.lat ?? null,
      transshipmentLon: input.lon ?? null,
      transshipmentDetails: input.details?.trim() || null,
      transshipmentApprovedBy: input.approvedBy.trim(),
      updatedAt: new Date(),
    })
    .where(eq(fishingLogs.id, log.id))
  await audit('fishing-log', tripId, 'update', {
    field: 'transshipment',
    newValue: 'recorded',
    reason: input.authorization ?? null,
    userName: input.approvedBy.trim(),
  })
  revalidatePath('/admin/compliance/fishing-log')
  return { ok: true }
}

export async function approveFishingLog(
  tripId: string,
  boat: string,
  captain: string,
): Promise<{ ok: true }> {
  await requireAdmin()
  const log = await ensureLog(tripId, boat)
  if (log.locked) return { ok: true }
  await db
    .update(fishingLogs)
    .set({
      approvedBy: captain,
      approvedAt: new Date(),
      locked: true,
      updatedAt: new Date(),
    })
    .where(eq(fishingLogs.id, log.id))
  await audit('fishing-log', tripId, 'approve', {
    newValue: captain,
    userName: captain,
  })
  await audit('fishing-log', tripId, 'lock', { userName: captain })
  revalidatePath('/admin/compliance/fishing-log')
  return { ok: true }
}

// --- Catch declarations ----------------------------------------------------

export type SpeciesTotal = {
  species: string
  numberCount: number
  weightKg: number
  released: number
}

export type DeclarationTotals = {
  catchBySpecies: SpeciesTotal[]
  bycatchCount: number
  discardCount: number
  activities: number
  tripCount: number
}

export type DeclarationRow = typeof catchDeclarations.$inferSelect

export async function listDeclarations(boat: string): Promise<DeclarationRow[]> {
  await requireAdmin()
  return db
    .select()
    .from(catchDeclarations)
    .where(eq(catchDeclarations.boat, boat))
    .orderBy(desc(catchDeclarations.createdAt))
}

/**
 * Build a frozen totals snapshot for a reporting period. We aggregate the
 * retained catches, bycatch and discards across every fishing trip in the
 * window so the declaration carries its own numbers — a later trip edit cannot
 * silently change what was submitted.
 */
export async function buildDeclaration(
  boat: string,
  periodStart: string,
  periodEnd: string,
  userName?: string,
): Promise<{ ok: true; id: string }> {
  await requireAdmin()

  const tripRows = await db
    .select({ id: trips.id })
    .from(trips)
    .where(
      and(
        eq(trips.boat, boat),
        eq(trips.purpose, 'fishing'),
        gte(trips.startedAt, new Date(`${periodStart}T00:00:00Z`)),
        lte(trips.startedAt, new Date(`${periodEnd}T23:59:59Z`)),
      ),
    )
  const tripIds = tripRows.map((t) => t.id)

  const totals: DeclarationTotals = {
    catchBySpecies: [],
    bycatchCount: 0,
    discardCount: 0,
    activities: 0,
    tripCount: tripIds.length,
  }

  if (tripIds.length > 0) {
    const [catchRows, bycatchRows, actRows] = await Promise.all([
      db.select().from(catches).where(inArray(catches.tripId, tripIds)),
      db
        .select()
        .from(fishingBycatch)
        .where(inArray(fishingBycatch.tripId, tripIds)),
      db
        .select({ id: fishingActivities.id })
        .from(fishingActivities)
        .where(inArray(fishingActivities.tripId, tripIds)),
    ])

    const bySpecies = new Map<string, SpeciesTotal>()
    for (const c of catchRows) {
      const key = c.species
      const cur =
        bySpecies.get(key) ??
        { species: key, numberCount: 0, weightKg: 0, released: 0 }
      cur.numberCount += 1
      cur.weightKg += c.weightKg ?? 0
      if (c.released) cur.released += 1
      bySpecies.set(key, cur)
    }
    totals.catchBySpecies = [...bySpecies.values()].sort((a, b) =>
      a.species.localeCompare(b.species),
    )
    totals.bycatchCount = bycatchRows.filter((b) => b.kind === 'bycatch').length
    totals.discardCount = bycatchRows.filter((b) => b.kind === 'discard').length
    totals.activities = actRows.length
  }

  const id = newId('decl')
  await db.insert(catchDeclarations).values({
    id,
    boat,
    periodStart,
    periodEnd,
    tripIds,
    totals,
    status: 'draft',
    createdBy: userName ?? null,
  })
  await audit('catch-declaration', id, 'create', {
    newValue: `${periodStart} → ${periodEnd}`,
    userName: userName ?? null,
  })
  revalidatePath('/admin/compliance/fishing-log')
  return { ok: true, id }
}

export async function updateDeclaration(
  id: string,
  input: Partial<{
    status: string
    submittedTo: string | null
    submissionDate: string | null
    submissionMethod: string | null
    referenceNumber: string | null
    proofUrl: string | null
    approvedBy: string | null
    notes: string | null
  }>,
  userName?: string,
): Promise<{ ok: true }> {
  await requireAdmin()
  const [existing] = await db
    .select()
    .from(catchDeclarations)
    .where(eq(catchDeclarations.id, id))
    .limit(1)
  if (!existing) throw new Error('Declaration not found.')

  const patch: Record<string, unknown> = { updatedAt: new Date() }
  for (const k of [
    'status',
    'submittedTo',
    'submissionDate',
    'submissionMethod',
    'referenceNumber',
    'proofUrl',
    'notes',
  ] as const) {
    if (input[k] !== undefined) patch[k] = input[k]
  }
  if (input.status === 'captain-approved' && input.approvedBy) {
    patch.approvedBy = input.approvedBy
    patch.approvedAt = new Date()
  }
  await db.update(catchDeclarations).set(patch).where(eq(catchDeclarations.id, id))

  if (input.status && input.status !== existing.status) {
    await audit('catch-declaration', id, 'update', {
      field: 'status',
      previousValue: existing.status,
      newValue: input.status,
      userName: userName ?? null,
    })
  }
  revalidatePath('/admin/compliance/fishing-log')
  return { ok: true }
}
