'use server'

import { and, desc, eq, sql } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'

import { isAdmin } from '@/lib/admin-auth'
import { boatName } from '@/lib/boats'
import { db } from '@/lib/db'
import { complianceAudit, voyageJournals } from '@/lib/db/schema'
import { sendEmail } from '@/lib/email'
import { newId } from '@/lib/fleet'
import {
  formatVoyageNumber,
  NO_INCIDENT_TEXT,
  OPERATOR_NAME,
  optionLabel,
  PURPOSES,
  type CrewMember,
  type EmailLogEntry,
  type PassengerRow,
  type Rectificatif,
  type VoyageJournalRow,
  type VoyageStatus,
} from '@/lib/voyage-journal'

async function requireAdmin() {
  if (!(await isAdmin())) throw new Error('Not authorised')
}

/** Absolute origin for links in the email (Vercel env in prod, preview URL otherwise). */
function publicBaseUrl(): string {
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL)
    return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`
  return process.env.V0_RUNTIME_URL || 'http://localhost:3000'
}

// The admin is a single unnamed operator, so audit rows are attributed to
// "Admin" unless a specific name is supplied.
const ADMIN_USER = 'Admin'

type Row = typeof voyageJournals.$inferSelect

function toRow(r: Row): VoyageJournalRow {
  return {
    id: r.id,
    boat: r.boat,
    boatLabel: boatName(r.boat),
    voyageNumber: r.voyageNumber,
    seq: r.seq,
    year: r.year,
    status: r.status as VoyageStatus,
    voyageDate: r.voyageDate,
    departureLocation: r.departureLocation,
    departureTime: r.departureTime,
    destination: r.destination,
    stopovers: r.stopovers,
    arrivalLocation: r.arrivalLocation,
    arrivalDate: r.arrivalDate,
    arrivalTime: r.arrivalTime,
    purpose: r.purpose,
    purposeOther: r.purposeOther,
    captainName: r.captainName,
    captainLicense: r.captainLicense,
    crew: Array.isArray(r.crew) ? (r.crew as CrewMember[]) : [],
    passengerCount: r.passengerCount,
    passengers: Array.isArray(r.passengers)
      ? (r.passengers as PassengerRow[])
      : [],
    weather: r.weather,
    seaState: r.seaState,
    wind: r.wind,
    navigationZone: r.navigationZone,
    fuelDepart: r.fuelDepart,
    fuelAdded: r.fuelAdded,
    fuelArrival: r.fuelArrival,
    fuelObservations: r.fuelObservations,
    eventsText: r.eventsText,
    noIncident: r.noIncident,
    certifiedBy: r.certifiedBy,
    validatedAt: r.validatedAt ? new Date(r.validatedAt).toISOString() : null,
    validatedByUser: r.validatedByUser,
    captainId: r.captainId,
    locked: r.locked,
    rectificatifs: Array.isArray(r.rectificatifs)
      ? (r.rectificatifs as Rectificatif[])
      : [],
    emailLog: Array.isArray(r.emailLog) ? (r.emailLog as EmailLogEntry[]) : [],
    createdAt: new Date(r.createdAt).toISOString(),
    updatedAt: new Date(r.updatedAt).toISOString(),
  }
}

async function audit(
  recordId: string,
  action: string,
  opts: { field?: string; reason?: string; newValue?: string } = {},
) {
  await db.insert(complianceAudit).values({
    id: newId('audit'),
    recordType: 'voyage-log',
    recordId,
    action,
    field: opts.field ?? null,
    previousValue: null,
    newValue: opts.newValue ?? null,
    reason: opts.reason ?? null,
    userName: ADMIN_USER,
  })
}

export type JournalFilters = {
  boat?: string
  captain?: string
  destination?: string
  voyageNumber?: string
  status?: VoyageStatus
  incident?: 'with' | 'without'
  from?: string
  to?: string
}

export async function listVoyageJournals(
  filters: JournalFilters = {},
): Promise<VoyageJournalRow[]> {
  await requireAdmin()
  const rows = await db
    .select()
    .from(voyageJournals)
    .orderBy(desc(voyageJournals.year), desc(voyageJournals.seq))
  let out = rows.map(toRow)

  if (filters.boat) out = out.filter((r) => r.boat === filters.boat)
  if (filters.status) out = out.filter((r) => r.status === filters.status)
  if (filters.captain) {
    const q = filters.captain.toLowerCase()
    out = out.filter((r) => (r.captainName ?? '').toLowerCase().includes(q))
  }
  if (filters.destination) {
    const q = filters.destination.toLowerCase()
    out = out.filter((r) => (r.destination ?? '').toLowerCase().includes(q))
  }
  if (filters.voyageNumber) {
    const q = filters.voyageNumber.toLowerCase()
    out = out.filter((r) => r.voyageNumber.toLowerCase().includes(q))
  }
  if (filters.incident === 'with') out = out.filter((r) => !r.noIncident)
  if (filters.incident === 'without') out = out.filter((r) => r.noIncident)
  if (filters.from) out = out.filter((r) => (r.voyageDate ?? '') >= filters.from!)
  if (filters.to) out = out.filter((r) => (r.voyageDate ?? '') <= filters.to!)
  return out
}

export async function getVoyageJournal(
  id: string,
): Promise<VoyageJournalRow | null> {
  const rows = await db
    .select()
    .from(voyageJournals)
    .where(eq(voyageJournals.id, id))
    .limit(1)
  return rows[0] ? toRow(rows[0]) : null
}

/**
 * Public read for the emailed A4 document link (/voyage-journal/[id]).
 * Intentionally unauthenticated: an inspector opens the link without an admin
 * login. The id is a random unguessable key and the document carries no
 * sensitive credentials — only the official voyage record.
 */
export async function getVoyageJournalPublic(
  id: string,
): Promise<VoyageJournalRow | null> {
  return getVoyageJournal(id)
}

/** Create a new draft with the next voyage number for that vessel + year. */
export async function createVoyageJournal(boat: string) {
  await requireAdmin()
  const year = new Date().getUTCFullYear()
  const existing = await db
    .select({ maxSeq: sql<number>`coalesce(max(${voyageJournals.seq}), 0)` })
    .from(voyageJournals)
    .where(and(eq(voyageJournals.boat, boat), eq(voyageJournals.year, year)))
  const seq = Number(existing[0]?.maxSeq ?? 0) + 1
  const id = newId('vj')
  const voyageNumber = formatVoyageNumber(boat, year, seq)
  await db.insert(voyageJournals).values({
    id,
    boat,
    voyageNumber,
    seq,
    year,
    status: 'brouillon',
    voyageDate: new Date().toISOString().slice(0, 10),
    createdBy: ADMIN_USER,
  })
  await audit(id, 'create', { newValue: voyageNumber })
  revalidatePath('/admin/compliance/logbook')
  return { id, voyageNumber }
}

export type JournalPatch = {
  voyageDate?: string | null
  departureLocation?: string | null
  departureTime?: string | null
  destination?: string | null
  stopovers?: string | null
  arrivalLocation?: string | null
  arrivalDate?: string | null
  arrivalTime?: string | null
  purpose?: string | null
  purposeOther?: string | null
  captainName?: string | null
  captainLicense?: string | null
  crew?: CrewMember[]
  passengerCount?: number | null
  passengers?: PassengerRow[]
  weather?: string | null
  seaState?: string | null
  wind?: string | null
  navigationZone?: string | null
  fuelDepart?: number | null
  fuelAdded?: number | null
  fuelArrival?: number | null
  fuelObservations?: string | null
  eventsText?: string | null
  noIncident?: boolean
}

/** Save draft fields. Refuses to touch a locked entry. */
export async function saveVoyageJournalDraft(id: string, patch: JournalPatch) {
  await requireAdmin()
  const cur = await db
    .select({ locked: voyageJournals.locked })
    .from(voyageJournals)
    .where(eq(voyageJournals.id, id))
    .limit(1)
  if (!cur[0]) throw new Error('Not found')
  if (cur[0].locked)
    throw new Error('This voyage is validated and can no longer be edited')

  const clean: CrewMember[] | undefined = patch.crew
    ?.map((c) => ({ name: c.name.trim(), role: (c.role || '').trim() }))
    .filter((c) => c.name.length > 0)
  const cleanPax: PassengerRow[] | undefined = patch.passengers
    ?.map((p) => ({
      name: p.name.trim(),
      nationality: (p.nationality || '').trim(),
    }))
    .filter((p) => p.name.length > 0)

  await db
    .update(voyageJournals)
    .set({
      ...patch,
      crew: clean ?? patch.crew,
      passengers: cleanPax ?? patch.passengers,
      updatedAt: new Date(),
    })
    .where(eq(voyageJournals.id, id))
  revalidatePath('/admin/compliance/logbook')
  return { ok: true }
}

/**
 * VALIDER ET CLÔTURER — the captain certifies the entry. It is closed and
 * LOCKED in one step; after this only a rectificatif can be appended.
 */
export async function validateVoyageJournal(
  id: string,
  data: { certifiedBy: string; captainId?: string | null },
) {
  await requireAdmin()
  const cur = await db
    .select()
    .from(voyageJournals)
    .where(eq(voyageJournals.id, id))
    .limit(1)
  if (!cur[0]) throw new Error('Not found')
  if (cur[0].locked) throw new Error('Already validated')
  const certifiedBy = data.certifiedBy.trim()
  if (!certifiedBy) throw new Error('Captain name is required to validate')

  await db
    .update(voyageJournals)
    .set({
      status: 'cloture',
      locked: true,
      certifiedBy,
      captainId: data.captainId ?? null,
      validatedAt: new Date(),
      validatedByUser: ADMIN_USER,
      updatedAt: new Date(),
    })
    .where(eq(voyageJournals.id, id))
  await audit(id, 'lock', { reason: `Validated by ${certifiedBy}` })
  revalidatePath('/admin/compliance/logbook')
  return { ok: true }
}

/** Append a correction to a locked entry. The original is never changed. */
export async function addRectificatif(
  id: string,
  data: { reason: string; text: string },
) {
  await requireAdmin()
  const cur = await db
    .select()
    .from(voyageJournals)
    .where(eq(voyageJournals.id, id))
    .limit(1)
  if (!cur[0]) throw new Error('Not found')
  const reason = data.reason.trim()
  const text = data.text.trim()
  if (!reason || !text) throw new Error('Reason and correction text are required')

  const list: Rectificatif[] = Array.isArray(cur[0].rectificatifs)
    ? (cur[0].rectificatifs as Rectificatif[])
    : []
  const entry: Rectificatif = {
    id: newId('rect'),
    date: new Date().toISOString().slice(0, 10),
    reason,
    text,
    addedBy: ADMIN_USER,
    at: new Date().toISOString(),
  }
  await db
    .update(voyageJournals)
    .set({ rectificatifs: [...list, entry], updatedAt: new Date() })
    .where(eq(voyageJournals.id, id))
  await audit(id, 'correction', { reason, newValue: text })
  revalidatePath('/admin/compliance/logbook')
  return { ok: true }
}

/** Delete — allowed only for drafts (never for validated/closed entries). */
export async function deleteVoyageJournal(id: string) {
  await requireAdmin()
  const cur = await db
    .select({ locked: voyageJournals.locked })
    .from(voyageJournals)
    .where(eq(voyageJournals.id, id))
    .limit(1)
  if (!cur[0]) throw new Error('Not found')
  if (cur[0].locked)
    throw new Error('A validated voyage cannot be deleted')
  await db.delete(voyageJournals).where(eq(voyageJournals.id, id))
  revalidatePath('/admin/compliance/logbook')
  return { ok: true }
}

/**
 * ENVOYER PAR E-MAIL — sends the logbook as formatted HTML plus a link to the
 * official print/PDF page, and records the send in the audit trail.
 */
export async function sendVoyageJournalEmail(
  id: string,
  data: { to: string; copyToOperator: boolean },
) {
  await requireAdmin()
  const rows = await db
    .select()
    .from(voyageJournals)
    .where(eq(voyageJournals.id, id))
    .limit(1)
  if (!rows[0]) throw new Error('Not found')
  const r = toRow(rows[0])
  const to = data.to.trim()
  if (!to) throw new Error('Recipient email is required')

  const base = publicBaseUrl()
  const pdfUrl = `${base}/voyage-journal/${id}`
  const dateStr = r.voyageDate ?? r.createdAt.slice(0, 10)
  const subject = `Journal de bord – ${r.boatLabel} – ${dateStr} – ${r.voyageNumber}`
  const purposeFr = optionLabel(PURPOSES, r.purpose)?.fr ?? r.purpose ?? '—'
  const incident = r.noIncident ? NO_INCIDENT_TEXT : r.eventsText || '—'

  const html = `
  <div style="font-family:Georgia,'Times New Roman',serif;color:#111;max-width:640px;margin:0 auto">
    <h1 style="font-size:20px;letter-spacing:0.12em;border-bottom:2px solid #111;padding-bottom:8px">JOURNAL DE BORD</h1>
    <p style="font-size:13px;color:#444;margin:4px 0 16px">Navigation maritime – Madagascar</p>
    <table style="font-size:14px;width:100%;border-collapse:collapse">
      <tr><td style="padding:3px 0;color:#555">Navire</td><td style="padding:3px 0;font-weight:bold">${r.boatLabel}</td></tr>
      <tr><td style="padding:3px 0;color:#555">N° du voyage</td><td style="padding:3px 0;font-weight:bold">${r.voyageNumber}</td></tr>
      <tr><td style="padding:3px 0;color:#555">Date</td><td style="padding:3px 0">${dateStr}</td></tr>
      <tr><td style="padding:3px 0;color:#555">Départ</td><td style="padding:3px 0">${r.departureLocation ?? '—'} ${r.departureTime ? '· ' + r.departureTime : ''}</td></tr>
      <tr><td style="padding:3px 0;color:#555">Destination</td><td style="padding:3px 0">${r.destination ?? '—'}</td></tr>
      <tr><td style="padding:3px 0;color:#555">Arrivée</td><td style="padding:3px 0">${r.arrivalLocation ?? '—'} ${r.arrivalTime ? '· ' + r.arrivalTime : ''}</td></tr>
      <tr><td style="padding:3px 0;color:#555">Objet</td><td style="padding:3px 0">${purposeFr}</td></tr>
      <tr><td style="padding:3px 0;color:#555">Capitaine</td><td style="padding:3px 0">${r.captainName ?? '—'}</td></tr>
      <tr><td style="padding:3px 0;color:#555">Passagers</td><td style="padding:3px 0">${r.passengerCount ?? '—'}</td></tr>
    </table>
    <p style="font-size:13px;margin:16px 0 4px;color:#555">Événements / incidents</p>
    <p style="font-size:14px;margin:0 0 16px">${incident}</p>
    <p style="font-size:14px;margin:16px 0">
      <a href="${pdfUrl}" style="color:#1e3a5f;font-weight:bold">Ouvrir le document officiel (PDF / impression)</a>
    </p>
    <p style="font-size:12px;color:#777;border-top:1px solid #ddd;padding-top:10px">
      ${OPERATOR_NAME} · Document généré le ${new Date().toISOString().slice(0, 10)}
    </p>
  </div>`

  const recipients = [to]
  const result = await sendEmail({ to: recipients, subject, html })

  const list: EmailLogEntry[] = Array.isArray(rows[0].emailLog)
    ? (rows[0].emailLog as EmailLogEntry[])
    : []
  const entry: EmailLogEntry = {
    id: newId('mail'),
    to,
    copyToOperator: data.copyToOperator,
    at: new Date().toISOString(),
    user: ADMIN_USER,
  }
  await db
    .update(voyageJournals)
    .set({ emailLog: [...list, entry], updatedAt: new Date() })
    .where(eq(voyageJournals.id, id))
  await audit(id, 'update', { field: 'email', newValue: to })
  revalidatePath('/admin/compliance/logbook')

  if (!result.ok && !result.skipped) {
    return { ok: false as const, error: result.error }
  }
  return { ok: true as const, skipped: !result.ok }
}
