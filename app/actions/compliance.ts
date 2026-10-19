'use server'

import { readFile } from 'node:fs/promises'
import path from 'node:path'

import { put } from '@vercel/blob'
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

/** Stable id so the A.R.O. attestation is inserted once and never duplicated. */
const ODYSSEY_II_INSURANCE_ID = 'doc-odyssey-ii-aro-2788'
const ODYSSEY_II_INSURANCE_PUBLIC = '/documents/odyssey-ii-insurance-attestation.png'

const ODYSSEY_II_INSURANCE_NOTES = [
  'Policyholder: MR SCHNEIDER MICHAEL, ANDREKAREKA NOSY KOMBA, 207 NOSY BE.',
  'Vessel: ODYSSEY II – HV 25 111. Type: EMBARCATION DE PLAISANCE.',
  'RC Passagers. Dommages Matériels up to 30,000,000 Ar; Dommages Corporels up to 50,000,000 Ar; 5 passengers.',
  'Signed Nosy Be, 13 April 2026.',
].join(' ')

/** Stable id so the APMF naturalisation cover is inserted once. */
const ODYSSEY_II_NATURALISATION_ID = 'doc-odyssey-ii-apmf-1029'
const ODYSSEY_II_NATURALISATION_PUBLIC =
  '/documents/odyssey-ii-acte-naturalisation-cover.png'

const ODYSSEY_II_NATURALISATION_NOTES = [
  'Cover letter transmitting the Acte de naturalisation (PJ 01). This scan is the cover letter, not the act itself.',
  'To: Monsieur SCHNEIDER Michael, Andrakaveka Be, Ampangorina, NOSY BE.',
  'Subject: Vedette ODYSSEY II, immatriculation HV-25.111 / Demande d\'acte de naturalisation.',
  'Ref: lettre du 13/11/2025; documents reçus le 02/12/2025.',
  'Signed Antananarivo, 23 December 2025, Maurice Tianjara, Directeur Général p.i.',
  'Copie à: M. le DR APMF – NOSY BE.',
].join(' ')

/** Stable id so the Acte de naturalisation itself is inserted once. */
const ODYSSEY_II_NATURALISATION_ACT_ID = 'doc-odyssey-ii-hv-25-111'
const ODYSSEY_II_NATURALISATION_ACT_PUBLIC =
  '/documents/odyssey-ii-acte-naturalisation.png'

const ODYSSEY_II_NATURALISATION_ACT_NOTES = [
  'Acte de naturalisation for vedette ODYSSEY II. Bilingual French and Malagasy (FR+MG).',
  'Issued by Agence Portuaire, Maritime et Fluviale (APMF). Port of registry: HELL VILLE.',
  'Registration HV-25.111 dated 08/12/2025.',
  'Naturalization register 25.100 dated 02/12/2025.',
  'Built 2024, Afrique du Sud, fibre de verre, 60 CV.',
  'Issued Antananarivo, stamp 23 DEC 2025, Maurice Tianjara, par délégation.',
].join(' ')

/** Stable id so the naturalisation act numbered 25.100 is inserted once. */
const ODYSSEY_II_NATURALISATION_25100_ID = 'doc-odyssey-ii-nat-25-100'
const ODYSSEY_II_NATURALISATION_25100_PUBLIC =
  '/documents/odyssey-ii-acte-naturalisation-25-100.png'

const ODYSSEY_II_NATURALISATION_25100_NOTES = [
  'Acte de naturalisation d\'un navire malgache for vedette ODYSSEY II. Bilingual French and Malagasy (FR+MG).',
  'Number 25.100. This scan is the act itself, distinct from the APMF cover letter and from registration HV-25.111.',
  'Owner: Monsieur SCHNEIDER Michael, Andrakaveka Be, Ampangorina, NOSY BE.',
  'Jauge brute 1.48 t, jauge nette 1.28 t (Jaugeage 1969). Stamp PLAISANCE.',
  'Length 4 m 70, beam 1 m 90.',
].join(' ')

/**
 * Prefer Vercel Blob when a token is present. Without one (or if the upload
 * fails) the scan stays in public/ and the row points at that path, so it
 * still shows after deploy.
 */
async function odysseyIiInsuranceFileUrl(): Promise<string> {
  if (!process.env.BLOB_READ_WRITE_TOKEN) return ODYSSEY_II_INSURANCE_PUBLIC
  try {
    const filePath = path.join(
      process.cwd(),
      'public',
      'documents',
      'odyssey-ii-insurance-attestation.png',
    )
    const body = await readFile(filePath)
    const blob = await put(
      'aam/compliance/odyssey-ii/insurance-attestation-2788.png',
      body,
      {
        access: 'public',
        addRandomSuffix: false,
        contentType: 'image/png',
      },
    )
    return blob.url
  } catch (err) {
    console.error('Odyssey II insurance blob upload failed:', err)
    return ODYSSEY_II_INSURANCE_PUBLIC
  }
}

/**
 * File Urška's A.R.O. insurance attestation on ODYSSEY II (HV 25 111).
 * Idempotent: a second visit does not insert another row. Also records the
 * registration on the vessel profile when that field is still empty.
 */
export async function ensureOdysseyIiInsuranceAttestation(): Promise<void> {
  await requireAdmin()
  try {
    const [existing] = await db
      .select({ id: complianceDocuments.id })
      .from(complianceDocuments)
      .where(eq(complianceDocuments.id, ODYSSEY_II_INSURANCE_ID))
      .limit(1)
    if (!existing) {
      const fileUrl = await odysseyIiInsuranceFileUrl()
      await db.insert(complianceDocuments).values({
        id: ODYSSEY_II_INSURANCE_ID,
        boat: 'odyssey-ii',
        category: 'insurance',
        name: "Attestation d'assurance — RC Passagers (A.R.O.)",
        number: '2788',
        issuingAuthority:
          "Compagnie d'Assurances Réassurances Omnibranches A.R.O., Antananarivo",
        issueDate: '2026-04-13',
        expiryDate: '2027-04-13',
        fileUrl,
        status: 'valid',
        notes: ODYSSEY_II_INSURANCE_NOTES,
        createdBy: 'Urška',
      })
      await db.insert(complianceAudit).values({
        id: newId('aud'),
        recordType: 'document',
        recordId: ODYSSEY_II_INSURANCE_ID,
        action: 'create',
        newValue: "Attestation d'assurance — RC Passagers (A.R.O.)",
        reason: 'Filed from the A.R.O. attestation scan (policy 2788).',
        userName: 'Urška',
      })
    }

    const [profile] = await db
      .select()
      .from(vesselComplianceProfiles)
      .where(eq(vesselComplianceProfiles.boat, 'odyssey-ii'))
      .limit(1)
    if (!profile) {
      await db.insert(vesselComplianceProfiles).values({
        id: newId('vcp'),
        boat: 'odyssey-ii',
        vesselName: 'ODYSSEY II',
        registrationNumber: 'HV 25 111',
        classification: 'EMBARCATION DE PLAISANCE',
        passengerTransport: true,
      })
    } else if (!profile.registrationNumber?.trim()) {
      await db
        .update(vesselComplianceProfiles)
        .set({
          registrationNumber: 'HV 25 111',
          vesselName: profile.vesselName ?? 'ODYSSEY II',
          classification:
            profile.classification ?? 'EMBARCATION DE PLAISANCE',
          updatedAt: new Date(),
        })
        .where(eq(vesselComplianceProfiles.boat, 'odyssey-ii'))
    }
  } catch (err) {
    console.error('Could not file Odyssey II insurance attestation:', err)
  }
}

async function odysseyIiNaturalisationFileUrl(): Promise<string> {
  if (!process.env.BLOB_READ_WRITE_TOKEN) return ODYSSEY_II_NATURALISATION_PUBLIC
  try {
    const filePath = path.join(
      process.cwd(),
      'public',
      'documents',
      'odyssey-ii-acte-naturalisation-cover.png',
    )
    const body = await readFile(filePath)
    const blob = await put(
      'aam/compliance/odyssey-ii/acte-naturalisation-cover-1029.png',
      body,
      {
        access: 'public',
        addRandomSuffix: false,
        contentType: 'image/png',
      },
    )
    return blob.url
  } catch (err) {
    console.error('Odyssey II naturalisation blob upload failed:', err)
    return ODYSSEY_II_NATURALISATION_PUBLIC
  }
}

/**
 * File the APMF cover letter that transmits the Acte de naturalisation for
 * ODYSSEY II (HV-25.111). Not insurance. Idempotent on a stable id.
 */
export async function ensureOdysseyIiNaturalisationCover(): Promise<void> {
  await requireAdmin()
  try {
    const [existing] = await db
      .select({ id: complianceDocuments.id })
      .from(complianceDocuments)
      .where(eq(complianceDocuments.id, ODYSSEY_II_NATURALISATION_ID))
      .limit(1)
    if (existing) return
    const fileUrl = await odysseyIiNaturalisationFileUrl()
    await db.insert(complianceDocuments).values({
      id: ODYSSEY_II_NATURALISATION_ID,
      boat: 'odyssey-ii',
      category: 'registration',
      name: 'Acte de naturalisation — APMF cover (HV-25.111)',
      number: '1029-APMF/DG/DAP/SGAN.25',
      issuingAuthority:
        'Agence Portuaire, Maritime et Fluviale (APMF), Antananarivo',
      issueDate: '2025-12-23',
      fileUrl,
      status: 'valid',
      notes: ODYSSEY_II_NATURALISATION_NOTES,
      createdBy: 'Urška',
    })
    await db.insert(complianceAudit).values({
      id: newId('aud'),
      recordType: 'document',
      recordId: ODYSSEY_II_NATURALISATION_ID,
      action: 'create',
      newValue: 'Acte de naturalisation — APMF cover (HV-25.111)',
      reason:
        'Filed from the APMF cover letter N° 1029-APMF/DG/DAP/SGAN.25 (23 Dec 2025).',
      userName: 'Urška',
    })
  } catch (err) {
    console.error('Could not file Odyssey II naturalisation cover:', err)
  }
}

async function odysseyIiNaturalisationActFileUrl(): Promise<string> {
  if (!process.env.BLOB_READ_WRITE_TOKEN) return ODYSSEY_II_NATURALISATION_ACT_PUBLIC
  try {
    const filePath = path.join(
      process.cwd(),
      'public',
      'documents',
      'odyssey-ii-acte-naturalisation.png',
    )
    const body = await readFile(filePath)
    const blob = await put(
      'aam/compliance/odyssey-ii/acte-naturalisation-hv-25-111.png',
      body,
      {
        access: 'public',
        addRandomSuffix: false,
        contentType: 'image/png',
      },
    )
    return blob.url
  } catch (err) {
    console.error('Odyssey II naturalisation act blob upload failed:', err)
    return ODYSSEY_II_NATURALISATION_ACT_PUBLIC
  }
}

/**
 * File the APMF Acte de naturalisation for ODYSSEY II (HV-25.111).
 * Not insurance. Idempotent on a stable id, and does not touch the cover letter.
 */
export async function ensureOdysseyIiNaturalisationAct(): Promise<void> {
  await requireAdmin()
  try {
    const [existing] = await db
      .select({ id: complianceDocuments.id })
      .from(complianceDocuments)
      .where(eq(complianceDocuments.id, ODYSSEY_II_NATURALISATION_ACT_ID))
      .limit(1)
    if (existing) return
    const fileUrl = await odysseyIiNaturalisationActFileUrl()
    await db.insert(complianceDocuments).values({
      id: ODYSSEY_II_NATURALISATION_ACT_ID,
      boat: 'odyssey-ii',
      category: 'registration',
      name: 'Acte de naturalisation — HV-25.111',
      number: 'HV-25.111',
      issuingAuthority:
        'Agence Portuaire, Maritime et Fluviale (APMF), Antananarivo',
      issueDate: '2025-12-23',
      fileUrl,
      status: 'valid',
      notes: ODYSSEY_II_NATURALISATION_ACT_NOTES,
      createdBy: 'Urška',
    })
    await db.insert(complianceAudit).values({
      id: newId('aud'),
      recordType: 'document',
      recordId: ODYSSEY_II_NATURALISATION_ACT_ID,
      action: 'create',
      newValue: 'Acte de naturalisation — HV-25.111',
      reason:
        'Filed from the APMF Acte de naturalisation HV-25.111 (stamp 23 Dec 2025, Maurice Tianjara).',
      userName: 'Urška',
    })
  } catch (err) {
    console.error('Could not file Odyssey II naturalisation act:', err)
  }
}

async function odysseyIiNaturalisation25100FileUrl(): Promise<string> {
  if (!process.env.BLOB_READ_WRITE_TOKEN) return ODYSSEY_II_NATURALISATION_25100_PUBLIC
  try {
    const filePath = path.join(
      process.cwd(),
      'public',
      'documents',
      'odyssey-ii-acte-naturalisation-25-100.png',
    )
    const body = await readFile(filePath)
    const blob = await put(
      'aam/compliance/odyssey-ii/acte-naturalisation-25-100.png',
      body,
      {
        access: 'public',
        addRandomSuffix: false,
        contentType: 'image/png',
      },
    )
    return blob.url
  } catch (err) {
    console.error('Odyssey II naturalisation 25.100 blob upload failed:', err)
    return ODYSSEY_II_NATURALISATION_25100_PUBLIC
  }
}

/**
 * File the Acte de naturalisation d'un navire malgache for ODYSSEY II (n° 25.100).
 * Not insurance. Idempotent on a stable id, and does not touch the cover or HV-25.111 rows.
 */
export async function ensureOdysseyIiNaturalisation25100(): Promise<void> {
  await requireAdmin()
  try {
    const [existing] = await db
      .select({ id: complianceDocuments.id })
      .from(complianceDocuments)
      .where(eq(complianceDocuments.id, ODYSSEY_II_NATURALISATION_25100_ID))
      .limit(1)
    if (existing) return
    const fileUrl = await odysseyIiNaturalisation25100FileUrl()
    await db.insert(complianceDocuments).values({
      id: ODYSSEY_II_NATURALISATION_25100_ID,
      boat: 'odyssey-ii',
      category: 'registration',
      name: 'Acte de naturalisation — navire malgache n° 25.100',
      number: '25.100',
      issuingAuthority: 'République de Madagascar',
      fileUrl,
      status: 'valid',
      notes: ODYSSEY_II_NATURALISATION_25100_NOTES,
      createdBy: 'Urška',
    })
    await db.insert(complianceAudit).values({
      id: newId('aud'),
      recordType: 'document',
      recordId: ODYSSEY_II_NATURALISATION_25100_ID,
      action: 'create',
      newValue: 'Acte de naturalisation — navire malgache n° 25.100',
      reason:
        'Filed from the Acte de naturalisation d\'un navire malgache n° 25.100 (stamp PLAISANCE).',
      userName: 'Urška',
    })
  } catch (err) {
    console.error('Could not file Odyssey II naturalisation 25.100:', err)
  }
}

async function ensureOdysseyIiFiledDocuments(): Promise<void> {
  await ensureOdysseyIiInsuranceAttestation()
  await ensureOdysseyIiNaturalisationCover()
  await ensureOdysseyIiNaturalisationAct()
  await ensureOdysseyIiNaturalisation25100()
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
  await ensureOdysseyIiFiledDocuments()

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
  if (boat === 'odyssey-ii') await ensureOdysseyIiFiledDocuments()
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
