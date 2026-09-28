'use server'

import { and, asc, desc, eq } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'

import { isAdmin } from '@/lib/admin-auth'
import { BOATS, type BoatId } from '@/lib/boats'
import {
  CORE_DOC_CATEGORIES,
  type ComplianceStatus,
  daysUntil,
  effectiveStatus,
  worstStatus,
} from '@/lib/compliance'
import { db } from '@/lib/db'
import {
  complianceAudit,
  complianceDocuments,
  vesselComplianceProfiles,
} from '@/lib/db/schema'
import { newId } from '@/lib/fleet'

async function requireAdmin() {
  if (!(await isAdmin())) throw new Error('Unauthorized')
}

export type ComplianceDoc = {
  id: string
  boat: string
  category: string
  name: string
  number: string | null
  issuingAuthority: string | null
  issueDate: string | null
  expiryDate: string | null
  fileUrl: string | null
  status: string
  effective: ComplianceStatus
  daysUntilExpiry: number | null
  notes: string | null
  archived: boolean
}

export type VesselCompliance = {
  boat: BoatId
  name: string
  registrationNumber: string | null
  headline: ComplianceStatus
  documents: ComplianceDoc[]
  /** Core documents keyed by category, with a synthetic "missing" for gaps. */
  core: { category: string; doc: ComplianceDoc | null; status: ComplianceStatus }[]
}

export type ExpiryAlert = {
  boat: BoatId
  boatName: string
  docId: string
  docName: string
  category: string
  expiryDate: string | null
  days: number | null
  status: ComplianceStatus
}

function toDoc(row: typeof complianceDocuments.$inferSelect): ComplianceDoc {
  const effective = effectiveStatus({
    status: row.status,
    expiryDate: row.expiryDate,
  })
  return {
    id: row.id,
    boat: row.boat,
    category: row.category,
    name: row.name,
    number: row.number,
    issuingAuthority: row.issuingAuthority,
    issueDate: row.issueDate,
    expiryDate: row.expiryDate,
    fileUrl: row.fileUrl,
    status: row.status,
    effective,
    daysUntilExpiry: daysUntil(row.expiryDate),
    notes: row.notes,
    archived: row.archived,
  }
}

/**
 * The whole compliance picture in one read: every vessel with its live
 * documents, a rolled-up headline status, the core-document grid the
 * dashboard shows, and a flat list of expiry alerts across the fleet.
 */
export async function getComplianceOverview(): Promise<{
  vessels: VesselCompliance[]
  alerts: ExpiryAlert[]
}> {
  await requireAdmin()

  const [profiles, docs] = await Promise.all([
    db.select().from(vesselComplianceProfiles),
    db
      .select()
      .from(complianceDocuments)
      .where(eq(complianceDocuments.archived, false))
      .orderBy(asc(complianceDocuments.category)),
  ])

  const vessels: VesselCompliance[] = BOATS.map((boat) => {
    const profile = profiles.find((p) => p.boat === boat.id)
    const vDocs = docs.filter((d) => d.boat === boat.id).map(toDoc)

    const core = CORE_DOC_CATEGORIES.map((category) => {
      const doc = vDocs.find((d) => d.category === category) ?? null
      const status: ComplianceStatus = doc ? doc.effective : 'missing'
      return { category, doc, status }
    })

    const headline = worstStatus(core.map((c) => c.status))

    return {
      boat: boat.id,
      name: profile?.vesselName ?? boat.name,
      registrationNumber: profile?.registrationNumber ?? null,
      headline,
      documents: vDocs,
      core,
    }
  })

  // Expiry alerts: anything expiring within the widest window or already
  // expired, worst first. Missing core documents surface on the dashboard
  // grid itself rather than here (they have no date to sort by).
  const alerts: ExpiryAlert[] = []
  for (const v of vessels) {
    for (const d of v.documents) {
      if (d.effective === 'expiring' || d.effective === 'expired') {
        alerts.push({
          boat: v.boat,
          boatName: v.name,
          docId: d.id,
          docName: d.name,
          category: d.category,
          expiryDate: d.expiryDate,
          days: d.daysUntilExpiry,
          status: d.effective,
        })
      }
    }
  }
  alerts.sort((a, b) => (a.days ?? 0) - (b.days ?? 0))

  return { vessels, alerts }
}

/**
 * Append an audit row. Every create/amend/lock on an official record calls
 * this so the trail is complete; the records themselves are never rewritten
 * in place.
 */
export async function writeAudit(entry: {
  recordType: string
  recordId: string
  action: string
  field?: string
  previousValue?: string
  newValue?: string
  reason?: string
  userName?: string
}): Promise<void> {
  await requireAdmin()
  await db.insert(complianceAudit).values({
    id: newId('aud'),
    recordType: entry.recordType,
    recordId: entry.recordId,
    action: entry.action,
    field: entry.field ?? null,
    previousValue: entry.previousValue ?? null,
    newValue: entry.newValue ?? null,
    reason: entry.reason ?? null,
    userName: entry.userName ?? null,
  })
}

/** Full audit trail for one record, newest first. */
export async function getAuditTrail(recordType: string, recordId: string) {
  await requireAdmin()
  return db
    .select()
    .from(complianceAudit)
    .where(
      and(
        eq(complianceAudit.recordType, recordType),
        eq(complianceAudit.recordId, recordId),
      ),
    )
    .orderBy(desc(complianceAudit.at))
}

export type DocInput = {
  id?: string
  boat: string
  category: string
  name: string
  number?: string | null
  issuingAuthority?: string | null
  issueDate?: string | null
  expiryDate?: string | null
  fileUrl?: string | null
  status?: string
  notes?: string | null
}

/**
 * Create a new document or amend an existing one. An amend never silently
 * overwrites: we diff the incoming values against the stored row and write one
 * audit line per changed field, so the register keeps a full paper trail of
 * who changed what. A brand-new document writes a single `create` line.
 */
export async function saveComplianceDocument(
  input: DocInput,
  userName?: string,
): Promise<{ ok: true; id: string }> {
  await requireAdmin()

  const values = {
    boat: input.boat,
    category: input.category,
    name: input.name.trim(),
    number: input.number?.trim() || null,
    issuingAuthority: input.issuingAuthority?.trim() || null,
    issueDate: input.issueDate || null,
    expiryDate: input.expiryDate || null,
    fileUrl: input.fileUrl?.trim() || null,
    status: input.status || 'valid',
    notes: input.notes?.trim() || null,
  }

  if (input.id) {
    const [existing] = await db
      .select()
      .from(complianceDocuments)
      .where(eq(complianceDocuments.id, input.id))
      .limit(1)

    if (existing) {
      // One audit line per changed field — the diff, not the whole row.
      const fields: (keyof typeof values)[] = [
        'category',
        'name',
        'number',
        'issuingAuthority',
        'issueDate',
        'expiryDate',
        'fileUrl',
        'status',
        'notes',
      ]
      for (const f of fields) {
        const prev = (existing as Record<string, unknown>)[f]
        const next = values[f]
        if ((prev ?? '') !== (next ?? '')) {
          await db.insert(complianceAudit).values({
            id: newId('aud'),
            recordType: 'document',
            recordId: input.id,
            action: 'amend',
            field: f,
            previousValue: prev == null ? null : String(prev),
            newValue: next == null ? null : String(next),
            userName: userName ?? null,
          })
        }
      }
      await db
        .update(complianceDocuments)
        .set({ ...values, updatedAt: new Date() })
        .where(eq(complianceDocuments.id, input.id))
      revalidatePath('/admin/compliance')
      return { ok: true, id: input.id }
    }
  }

  const id = newId('doc')
  await db.insert(complianceDocuments).values({
    id,
    ...values,
    createdBy: userName ?? null,
  })
  await db.insert(complianceAudit).values({
    id: newId('aud'),
    recordType: 'document',
    recordId: id,
    action: 'create',
    newValue: values.name,
    userName: userName ?? null,
  })
  revalidatePath('/admin/compliance')
  return { ok: true, id }
}

/**
 * Archive a superseded document. We never hard-delete a compliance record —
 * archiving hides it from the live register while keeping it (and its audit
 * trail) for history and inspection.
 */
export async function archiveComplianceDocument(
  id: string,
  reason?: string,
  userName?: string,
): Promise<{ ok: true }> {
  await requireAdmin()
  await db
    .update(complianceDocuments)
    .set({ archived: true, updatedAt: new Date() })
    .where(eq(complianceDocuments.id, id))
  await db.insert(complianceAudit).values({
    id: newId('aud'),
    recordType: 'document',
    recordId: id,
    action: 'update',
    field: 'archived',
    newValue: 'true',
    reason: reason ?? null,
    userName: userName ?? null,
  })
  revalidatePath('/admin/compliance')
  return { ok: true }
}

/** All documents for one vessel including archived, newest activity first. */
export async function getVesselDocuments(boat: string): Promise<{
  live: ComplianceDoc[]
  archived: ComplianceDoc[]
}> {
  await requireAdmin()
  const rows = await db
    .select()
    .from(complianceDocuments)
    .where(eq(complianceDocuments.boat, boat))
    .orderBy(asc(complianceDocuments.category))
  const docs = rows.map(toDoc)
  return {
    live: docs.filter((d) => !d.archived),
    archived: docs.filter((d) => d.archived),
  }
}
