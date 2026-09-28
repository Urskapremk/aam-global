'use server'

import { and, asc, desc, eq } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'

import { isAdmin } from '@/lib/admin-auth'
import { db } from '@/lib/db'
import {
  complianceAudit,
  complianceDocuments,
  incidentLogs,
  predepartureChecks,
  safetyEquipment,
  vesselComplianceProfiles,
} from '@/lib/db/schema'
import { newId } from '@/lib/fleet'
import { boatName } from '@/lib/boats'
import {
  CORE_DOC_CATEGORIES,
  type CheckItem,
  type CheckResult,
  effectiveStatus,
  rollUpCheck,
} from '@/lib/compliance'

async function requireAdmin() {
  if (!(await isAdmin())) throw new Error('Unauthorized')
}

// --- Safety equipment ------------------------------------------------------

export type SafetyItem = typeof safetyEquipment.$inferSelect

export async function getSafetyEquipment(boat: string): Promise<SafetyItem[]> {
  await requireAdmin()
  return db
    .select()
    .from(safetyEquipment)
    .where(
      and(eq(safetyEquipment.boat, boat), eq(safetyEquipment.archived, false)),
    )
    .orderBy(asc(safetyEquipment.category))
}

export type SafetyInput = {
  id?: string
  boat: string
  category: string
  name?: string | null
  quantity?: number | null
  inspectionDate?: string | null
  expiryDate?: string | null
  condition?: string | null
  nextInspection?: string | null
  notes?: string | null
}

export async function saveSafetyItem(
  input: SafetyInput,
): Promise<{ ok: true; id: string }> {
  await requireAdmin()
  const values = {
    boat: input.boat,
    category: input.category,
    name: input.name?.trim() || null,
    quantity: input.quantity ?? null,
    inspectionDate: input.inspectionDate || null,
    expiryDate: input.expiryDate || null,
    condition: input.condition?.trim() || null,
    nextInspection: input.nextInspection || null,
    notes: input.notes?.trim() || null,
  }
  if (input.id) {
    await db
      .update(safetyEquipment)
      .set({ ...values, updatedAt: new Date() })
      .where(eq(safetyEquipment.id, input.id))
    revalidatePath('/admin/compliance/safety')
    return { ok: true, id: input.id }
  }
  const id = newId('safe')
  await db.insert(safetyEquipment).values({ id, ...values })
  revalidatePath('/admin/compliance/safety')
  return { ok: true, id }
}

export async function archiveSafetyItem(id: string): Promise<{ ok: true }> {
  await requireAdmin()
  await db
    .update(safetyEquipment)
    .set({ archived: true, updatedAt: new Date() })
    .where(eq(safetyEquipment.id, id))
  revalidatePath('/admin/compliance/safety')
  return { ok: true }
}

// --- Incident log ----------------------------------------------------------

export type IncidentRow = typeof incidentLogs.$inferSelect

export async function getIncidents(boat?: string): Promise<IncidentRow[]> {
  await requireAdmin()
  const q = db.select().from(incidentLogs).orderBy(desc(incidentLogs.at))
  const rows = await q
  return boat ? rows.filter((r) => r.boat === boat) : rows
}

export type IncidentInput = {
  id?: string
  boat: string
  tripId?: string | null
  category: string
  captain?: string | null
  at?: string | null
  lat?: number | null
  lon?: number | null
  description?: string | null
  personsInvolved?: string | null
  injuries?: string | null
  damage?: string | null
  immediateActions?: string | null
  authorityNotified?: boolean
  authorityName?: string | null
  authorityAt?: string | null
  authorityMethod?: string | null
  authorityContact?: string | null
  authorityReference?: string | null
}

export async function saveIncident(
  input: IncidentInput,
  userName?: string,
): Promise<{ ok: true; id: string }> {
  await requireAdmin()
  const values = {
    boat: input.boat,
    tripId: input.tripId || null,
    category: input.category,
    captain: input.captain?.trim() || null,
    at: input.at ? new Date(input.at) : null,
    lat: input.lat ?? null,
    lon: input.lon ?? null,
    description: input.description?.trim() || null,
    personsInvolved: input.personsInvolved?.trim() || null,
    injuries: input.injuries?.trim() || null,
    damage: input.damage?.trim() || null,
    immediateActions: input.immediateActions?.trim() || null,
    authorityNotified: input.authorityNotified ?? false,
    authorityName: input.authorityName?.trim() || null,
    authorityAt: input.authorityAt ? new Date(input.authorityAt) : null,
    authorityMethod: input.authorityMethod?.trim() || null,
    authorityContact: input.authorityContact?.trim() || null,
    authorityReference: input.authorityReference?.trim() || null,
  }
  if (input.id) {
    await db
      .update(incidentLogs)
      .set({ ...values, updatedAt: new Date() })
      .where(eq(incidentLogs.id, input.id))
    await db.insert(complianceAudit).values({
      id: newId('aud'),
      recordType: 'incident',
      recordId: input.id,
      action: 'update',
      userName: userName ?? null,
    })
    revalidatePath('/admin/compliance/incidents')
    return { ok: true, id: input.id }
  }
  const id = newId('inc')
  await db.insert(incidentLogs).values({ id, ...values, createdBy: userName ?? null })
  await db.insert(complianceAudit).values({
    id: newId('aud'),
    recordType: 'incident',
    recordId: id,
    action: 'create',
    newValue: input.category,
    userName: userName ?? null,
  })
  revalidatePath('/admin/compliance/incidents')
  return { ok: true, id }
}

// --- Legal & safety pre-departure check ------------------------------------

export type PreDepartureResult = {
  boat: string
  boatName: string
  purpose: string
  result: CheckResult
  items: CheckItem[]
  personsOnBoard: number | null
  maxPersons: number | null
  capacityExceeded: boolean
}

/**
 * Build (but do not store) the legal & safety pre-departure checklist for a
 * boat. This is the gate the spec puts before START TRIP: it reads the live
 * document register, safety equipment and capacity, and rolls them into a
 * green / yellow / red result. A missing or expired mandatory document is a
 * hard `fail` (red); anything only unverified is `verify` (yellow).
 */
export async function runPreDepartureCheck(
  boat: string,
  opts?: { purpose?: string; personsOnBoard?: number | null },
): Promise<PreDepartureResult> {
  await requireAdmin()

  const [profile] = await db
    .select()
    .from(vesselComplianceProfiles)
    .where(eq(vesselComplianceProfiles.boat, boat))
    .limit(1)

  const docs = await db
    .select()
    .from(complianceDocuments)
    .where(
      and(
        eq(complianceDocuments.boat, boat),
        eq(complianceDocuments.archived, false),
      ),
    )

  const isFishing = (opts?.purpose ?? '') === 'fishing'

  // Which document categories gate this specific trip. Fishing licence only
  // matters on a fishing trip, so it is skipped (n/a) otherwise.
  const gated: { category: string; label: string; required: boolean }[] = [
    { category: 'permis-navigation', label: 'Permis de navigation', required: true },
    { category: 'role-equipage', label: "Rôle d'équipage", required: true },
    { category: 'insurance', label: 'Insurance', required: true },
    { category: 'safety-inspection', label: 'Safety inspection', required: true },
    { category: 'fishing-licence', label: 'Fishing licence', required: isFishing },
  ]

  const items: CheckItem[] = gated.map((g) => {
    if (!g.required) {
      return { key: g.category, label: g.label, state: 'n/a', detail: 'Not required for this trip' }
    }
    const doc = docs.find((d) => d.category === g.category)
    if (!doc) {
      return { key: g.category, label: g.label, state: 'fail', detail: 'No document on file' }
    }
    const eff = effectiveStatus({ status: doc.status, expiryDate: doc.expiryDate })
    if (eff === 'expired' || eff === 'suspended' || eff === 'missing') {
      return { key: g.category, label: g.label, state: 'fail', detail: `Document ${eff}` }
    }
    if (eff === 'expiring' || eff === 'pending') {
      return { key: g.category, label: g.label, state: 'verify', detail: `Document ${eff}` }
    }
    return { key: g.category, label: g.label, state: 'pass', detail: 'Valid' }
  })

  // Capacity: a hard cap. Over the limit is always a red fail.
  const maxPersons = profile?.maxPersons ?? null
  const pob = opts?.personsOnBoard ?? null
  const capacityExceeded =
    maxPersons != null && pob != null && pob > maxPersons
  items.push({
    key: 'capacity',
    label: 'Passenger capacity',
    state:
      maxPersons == null
        ? 'verify'
        : pob == null
          ? 'verify'
          : capacityExceeded
            ? 'fail'
            : 'pass',
    detail:
      maxPersons == null
        ? 'No maximum set on the vessel profile'
        : pob == null
          ? 'Persons on board not entered'
          : capacityExceeded
            ? `${pob} on board exceeds the maximum of ${maxPersons}`
            : `${pob} of ${maxPersons} maximum`,
  })

  const result = rollUpCheck(items)

  return {
    boat,
    boatName: profile?.vesselName ?? boatName(boat),
    purpose: opts?.purpose ?? 'other',
    result,
    items,
    personsOnBoard: pob,
    maxPersons,
    capacityExceeded,
  }
}

/**
 * Store the outcome of a pre-departure check for the record. A red result may
 * only be stored with a documented override reason — the spec forbids silently
 * ignoring a failed check.
 */
export async function recordPreDepartureCheck(
  check: PreDepartureResult,
  opts: { tripId?: string | null; performedBy?: string; overrideReason?: string | null },
): Promise<{ ok: true; id: string }> {
  await requireAdmin()
  if (check.result === 'red' && !opts.overrideReason?.trim()) {
    throw new Error('A failed check requires a documented override reason.')
  }
  const id = newId('pdc')
  await db.insert(predepartureChecks).values({
    id,
    tripId: opts.tripId || null,
    boat: check.boat,
    purpose: check.purpose,
    result: check.result,
    items: check.items,
    personsOnBoard: check.personsOnBoard,
    maxPersons: check.maxPersons,
    overrideReason: opts.overrideReason?.trim() || null,
    performedBy: opts.performedBy ?? null,
  })
  revalidatePath('/admin/compliance')
  return { ok: true, id }
}
