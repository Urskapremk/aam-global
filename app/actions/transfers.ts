'use server'

import { db } from '@/lib/db'
import {
  transfers,
  transferRoutes,
  companySettings,
  messages,
} from '@/lib/db/schema'
import { and, asc, desc, eq } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { isAdmin } from '@/lib/admin-auth'
import { sendEmail, emailShell, NOTIFY_EMAIL } from '@/lib/email'
import { sendPushToAll } from '@/lib/push'
import { boatName } from '@/lib/boats'
import { computeRoutePrice, routeLabel } from '@/lib/transfers'
import {
  buildVoucherHtml,
  buildInvoiceHtml,
  type CompanyInfo,
  type TransferDoc,
} from '@/lib/transfer-docs'

async function requireAdmin() {
  if (!(await isAdmin())) throw new Error('Unauthorized')
}

function isoOrNull(v: Date | string | null): string | null {
  if (!v) return null
  return v instanceof Date ? v.toISOString() : String(v)
}

// ---------- Types ----------

export type TransferRoute = {
  id: number
  fromLocation: string
  toLocation: string
  priceEur: number
  priceType: string
  note: string
  sortOrder: number
  published: boolean
}

export type Transfer = {
  id: number
  reference: string
  routeId: number | null
  fromLocation: string
  toLocation: string
  date: string
  time: string
  durationMin: number
  boat: string
  name: string
  email: string
  phone: string
  pax: number
  priceEur: number
  status: string
  paymentMethod: string
  paidAt: string | null
  voucherSentAt: string | null
  invoiceNumber: string
  invoiceSentAt: string | null
  notes: string
  createdAt: string
}

export type CompanySettings = CompanyInfo & {
  invoicePrefix: string
  invoiceCounter: number
}

function serializeRoute(r: typeof transferRoutes.$inferSelect): TransferRoute {
  return {
    id: r.id,
    fromLocation: r.fromLocation,
    toLocation: r.toLocation,
    priceEur: r.priceEur,
    priceType: r.priceType,
    note: r.note,
    sortOrder: r.sortOrder,
    published: r.published,
  }
}

function serializeTransfer(r: typeof transfers.$inferSelect): Transfer {
  return {
    id: r.id,
    reference: r.reference,
    routeId: r.routeId ?? null,
    fromLocation: r.fromLocation,
    toLocation: r.toLocation,
    date: r.date,
    time: r.time,
    durationMin: r.durationMin ?? 0,
    boat: r.boat,
    name: r.name,
    email: r.email,
    phone: r.phone,
    pax: r.pax,
    priceEur: r.priceEur,
    status: r.status,
    paymentMethod: r.paymentMethod,
    paidAt: isoOrNull(r.paidAt),
    voucherSentAt: isoOrNull(r.voucherSentAt),
    invoiceNumber: r.invoiceNumber,
    invoiceSentAt: isoOrNull(r.invoiceSentAt),
    notes: r.notes,
    createdAt: isoOrNull(r.createdAt) ?? '',
  }
}

function escapeHtml(s: string) {
  return (s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

// ---------- Company settings ----------

async function loadCompanyRow() {
  const [row] = await db
    .select()
    .from(companySettings)
    .where(eq(companySettings.id, 1))
    .limit(1)
  if (row) return row
  // Ensure the singleton row exists.
  const [created] = await db
    .insert(companySettings)
    .values({ id: 1 })
    .onConflictDoNothing()
    .returning()
  return (
    created ??
    (await db.select().from(companySettings).where(eq(companySettings.id, 1)))[0]
  )
}

export async function getCompanySettings(): Promise<CompanySettings> {
  await requireAdmin()
  const r = await loadCompanyRow()
  return {
    name: r.name,
    addressLine1: r.addressLine1,
    addressLine2: r.addressLine2,
    city: r.city,
    country: r.country,
    taxId: r.taxId,
    iban: r.iban,
    bankName: r.bankName,
    email: r.email,
    phone: r.phone,
    invoicePrefix: r.invoicePrefix,
    invoiceCounter: r.invoiceCounter,
  }
}

export async function updateCompanySettings(
  data: Partial<Omit<CompanySettings, 'invoiceCounter'>>,
) {
  await requireAdmin()
  await loadCompanyRow()
  await db
    .update(companySettings)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(companySettings.id, 1))
  revalidatePath('/admin/bookings')
  return { ok: true }
}

function companyInfoFrom(r: typeof companySettings.$inferSelect): CompanyInfo {
  return {
    name: r.name,
    addressLine1: r.addressLine1,
    addressLine2: r.addressLine2,
    city: r.city,
    country: r.country,
    taxId: r.taxId,
    iban: r.iban,
    bankName: r.bankName,
    email: r.email,
    phone: r.phone,
  }
}

// ---------- Routes: public + admin ----------

export async function getPublishedRoutes(): Promise<TransferRoute[]> {
  const rows = await db
    .select()
    .from(transferRoutes)
    .where(eq(transferRoutes.published, true))
    .orderBy(asc(transferRoutes.sortOrder), asc(transferRoutes.id))
  return rows.map(serializeRoute)
}

export async function getRoutes(): Promise<TransferRoute[]> {
  await requireAdmin()
  const rows = await db
    .select()
    .from(transferRoutes)
    .orderBy(asc(transferRoutes.sortOrder), asc(transferRoutes.id))
  return rows.map(serializeRoute)
}

export async function createRoute(data: {
  fromLocation: string
  toLocation: string
  priceEur: number
  priceType?: string
  note?: string
}) {
  await requireAdmin()
  const [row] = await db
    .insert(transferRoutes)
    .values({
      fromLocation: data.fromLocation.trim(),
      toLocation: data.toLocation.trim(),
      priceEur: Math.max(0, Math.round(data.priceEur || 0)),
      priceType: data.priceType === 'per_person' ? 'per_person' : 'flat',
      note: data.note?.trim() || '',
      sortOrder: Date.now() % 100000,
    })
    .returning()
  revalidatePath('/admin/bookings')
  return { ok: true, route: serializeRoute(row) }
}

export async function updateRoute(
  id: number,
  data: Partial<Omit<TransferRoute, 'id'>>,
) {
  await requireAdmin()
  await db
    .update(transferRoutes)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(transferRoutes.id, id))
  revalidatePath('/admin/bookings')
  return { ok: true }
}

export async function deleteRoute(id: number) {
  await requireAdmin()
  await db.delete(transferRoutes).where(eq(transferRoutes.id, id))
  revalidatePath('/admin/bookings')
  return { ok: true }
}

// ---------- Transfers: admin ----------

export async function getTransfers(): Promise<Transfer[]> {
  await requireAdmin()
  const rows = await db
    .select()
    .from(transfers)
    .orderBy(desc(transfers.date), desc(transfers.id))
  return rows.map(serializeTransfer)
}

export async function getPendingTransfersCount() {
  await requireAdmin()
  const rows = await db
    .select({ id: transfers.id })
    .from(transfers)
    .where(eq(transfers.status, 'pending'))
  return rows.length
}

/** Build the shared reference TR-YYYY-#### from the row id. */
function buildReference(id: number, createdAt: Date | string | null): string {
  const year = (createdAt ? new Date(createdAt) : new Date()).getFullYear()
  return `TR-${year}-${String(id).padStart(4, '0')}`
}

type CreateTransferArgs = {
  routeId?: number | null
  fromLocation: string
  toLocation: string
  date: string
  time?: string
  durationMin?: number
  name: string
  email?: string
  phone?: string
  pax?: number
  priceEur: number
  status?: string
  notes?: string
}

export async function createTransfer(args: CreateTransferArgs) {
  await requireAdmin()
  if (!/^\d{4}-\d{2}-\d{2}$/.test(args.date)) {
    return { ok: false, error: 'Please choose a valid date.' }
  }
  if (!args.name.trim()) {
    return { ok: false, error: 'Please enter the guest name.' }
  }
  const [row] = await db
    .insert(transfers)
    .values({
      routeId: args.routeId ?? null,
      fromLocation: args.fromLocation.trim(),
      toLocation: args.toLocation.trim(),
      date: args.date,
      time: args.time?.trim() || '',
      durationMin: Math.max(0, Math.min(1440, Math.round(args.durationMin || 0))),
      name: args.name.trim(),
      email: args.email?.trim() || '',
      phone: args.phone?.trim() || '',
      pax: Math.max(1, Math.min(50, Math.round(args.pax || 1))),
      priceEur: Math.max(0, Math.round(args.priceEur || 0)),
      status: args.status || 'confirmed',
      notes: args.notes?.trim() || '',
    })
    .returning()
  // Assign the shared reference now that we have the row id.
  const reference = buildReference(row.id, row.createdAt)
  await db.update(transfers).set({ reference }).where(eq(transfers.id, row.id))
  revalidatePath('/admin/bookings')
  return { ok: true, transfer: serializeTransfer({ ...row, reference }) }
}

export async function updateTransfer(
  id: number,
  data: Partial<
    Pick<
      Transfer,
      | 'routeId'
      | 'fromLocation'
      | 'toLocation'
      | 'date'
      | 'time'
      | 'durationMin'
      | 'name'
      | 'email'
      | 'phone'
      | 'pax'
      | 'priceEur'
      | 'status'
      | 'notes'
    >
  >,
) {
  await requireAdmin()
  await db.update(transfers).set(data).where(eq(transfers.id, id))
  revalidatePath('/admin/bookings')
  return { ok: true }
}

export async function setTransferStatus(id: number, status: string) {
  await requireAdmin()
  await db.update(transfers).set({ status }).where(eq(transfers.id, id))
  revalidatePath('/admin/bookings')
  return { ok: true }
}

/** Mark a transfer paid (or unpaid) with the payment method. */
export async function markTransferPaid(
  id: number,
  paid: boolean,
  method: 'cash' | 'bank' | 'orange' = 'cash',
) {
  await requireAdmin()
  await db
    .update(transfers)
    .set(
      paid
        ? { status: 'paid', paymentMethod: method, paidAt: new Date() }
        : { status: 'confirmed', paymentMethod: '', paidAt: null },
    )
    .where(eq(transfers.id, id))
  revalidatePath('/admin/bookings')
  return { ok: true }
}

export async function deleteTransfer(id: number) {
  await requireAdmin()
  await db.delete(transfers).where(eq(transfers.id, id))
  revalidatePath('/admin/bookings')
  return { ok: true }
}

// ---------- Documents: voucher + invoice ----------

async function loadTransferDoc(id: number): Promise<{
  t: typeof transfers.$inferSelect
  doc: TransferDoc
  company: CompanyInfo
} | null> {
  const [t] = await db.select().from(transfers).where(eq(transfers.id, id)).limit(1)
  if (!t) return null
  const c = await loadCompanyRow()
  const doc: TransferDoc = {
    reference: t.reference || buildReference(t.id, t.createdAt),
    fromLocation: t.fromLocation,
    toLocation: t.toLocation,
    date: t.date,
    time: t.time,
    durationMin: t.durationMin ?? 0,
    boatName: boatName(t.boat),
    name: t.name,
    email: t.email,
    phone: t.phone,
    pax: t.pax,
    priceEur: t.priceEur,
    status: t.status,
    paymentMethod: t.paymentMethod,
    invoiceNumber: t.invoiceNumber,
  }
  return { t, doc, company: companyInfoFrom(c) }
}

/** In-app preview of a voucher (admin). */
export async function previewVoucher(id: number): Promise<string> {
  await requireAdmin()
  const loaded = await loadTransferDoc(id)
  if (!loaded) return '<p>Transfer not found.</p>'
  return buildVoucherHtml(loaded.doc, loaded.company)
}

/**
 * In-app preview of an invoice (admin). Shows the next invoice number that
 * would be assigned if one has not been issued yet.
 */
export async function previewInvoice(id: number): Promise<string> {
  await requireAdmin()
  const loaded = await loadTransferDoc(id)
  if (!loaded) return '<p>Transfer not found.</p>'
  let doc = loaded.doc
  if (!doc.invoiceNumber) {
    const c = await loadCompanyRow()
    const year = new Date().getFullYear()
    const next = `${c.invoicePrefix}-${year}-${String(c.invoiceCounter + 1).padStart(4, '0')}`
    doc = { ...doc, invoiceNumber: next }
  }
  return buildInvoiceHtml(doc, loaded.company)
}

/** Assign an invoice number if the transfer does not have one yet. */
async function ensureInvoiceNumber(t: typeof transfers.$inferSelect): Promise<string> {
  if (t.invoiceNumber) return t.invoiceNumber
  const c = await loadCompanyRow()
  const year = new Date().getFullYear()
  const nextCounter = c.invoiceCounter + 1
  const number = `${c.invoicePrefix}-${year}-${String(nextCounter).padStart(4, '0')}`
  await db
    .update(companySettings)
    .set({ invoiceCounter: nextCounter, updatedAt: new Date() })
    .where(eq(companySettings.id, 1))
  await db.update(transfers).set({ invoiceNumber: number }).where(eq(transfers.id, t.id))
  return number
}

/** Send the voucher to the guest by email + log it in the outbox. */
export async function sendVoucher(id: number) {
  await requireAdmin()
  const loaded = await loadTransferDoc(id)
  if (!loaded) return { ok: false, error: 'Transfer not found.' }
  const { t, doc, company } = loaded
  if (!t.email) return { ok: false, error: 'This transfer has no guest email.' }

  const html = emailShell(
    'Transfer voucher',
    buildVoucherHtml(doc, company),
  )
  const subject = `Your transfer voucher ${doc.reference} — ${routeLabel(doc.fromLocation, doc.toLocation)}`
  const result = await sendEmail({ to: t.email, subject, html })
  const skipped = result.ok ? false : (result.skipped ?? false)
  if (!result.ok && !skipped) {
    return { ok: false, error: result.error }
  }

  await db.update(transfers).set({ voucherSentAt: new Date() }).where(eq(transfers.id, t.id))
  await db.insert(messages).values({
    direction: 'outbound',
    source: 'email',
    name: t.name,
    email: t.email,
    subject,
    body: `Transfer voucher ${doc.reference} sent.`,
    read: true,
    meta: JSON.stringify({ sent: result.ok, transferRef: doc.reference, kind: 'voucher' }),
  })
  revalidatePath('/admin/bookings')
  return { ok: true, skipped }
}

/** Issue (assign a number if needed) + send the invoice to the guest by email. */
export async function sendInvoice(id: number) {
  await requireAdmin()
  const loaded = await loadTransferDoc(id)
  if (!loaded) return { ok: false, error: 'Transfer not found.' }
  const { t, company } = loaded
  if (!t.email) return { ok: false, error: 'This transfer has no guest email.' }

  const invoiceNumber = await ensureInvoiceNumber(t)
  const doc: TransferDoc = { ...loaded.doc, invoiceNumber }

  const html = emailShell('Invoice', buildInvoiceHtml(doc, company))
  const subject = `Invoice ${invoiceNumber} — transfer ${doc.reference}`
  const result = await sendEmail({ to: t.email, subject, html })
  const skipped = result.ok ? false : (result.skipped ?? false)
  if (!result.ok && !skipped) {
    return { ok: false, error: result.error }
  }

  await db.update(transfers).set({ invoiceSentAt: new Date() }).where(eq(transfers.id, t.id))
  await db.insert(messages).values({
    direction: 'outbound',
    source: 'email',
    name: t.name,
    email: t.email,
    subject,
    body: `Invoice ${invoiceNumber} for transfer ${doc.reference} sent.`,
    read: true,
    meta: JSON.stringify({ sent: result.ok, transferRef: doc.reference, invoiceNumber, kind: 'invoice' }),
  })
  revalidatePath('/admin/bookings')
  return { ok: true, invoiceNumber, skipped }
}

// ---------- Public: request a transfer ----------

type PublicRequestArgs = {
  routeId?: number | null
  fromLocation: string
  toLocation: string
  date: string
  time?: string
  name: string
  email: string
  phone?: string
  pax?: number
  message?: string
}

/** Public: submit a transfer request (no payment). Best-effort email notify. */
export async function requestTransfer(args: PublicRequestArgs) {
  const name = args.name.trim()
  const email = args.email.trim()
  const date = args.date.trim()
  if (!name || !email || !date || (!args.fromLocation.trim() && !args.routeId)) {
    return { ok: false, error: 'Please choose a route, a date, and enter your name and email.' }
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return { ok: false, error: 'Invalid date.' }
  }

  // Resolve price from the chosen route (if any), so the admin sees an estimate.
  let priceEur = 0
  let from = args.fromLocation.trim()
  let to = args.toLocation.trim()
  const pax = Math.max(1, Math.min(50, Math.round(args.pax || 1)))
  if (args.routeId) {
    const [route] = await db
      .select()
      .from(transferRoutes)
      .where(and(eq(transferRoutes.id, args.routeId), eq(transferRoutes.published, true)))
      .limit(1)
    if (route) {
      from = route.fromLocation
      to = route.toLocation
      priceEur = computeRoutePrice(route.priceEur, route.priceType, pax)
    }
  }

  const [row] = await db
    .insert(transfers)
    .values({
      routeId: args.routeId ?? null,
      fromLocation: from,
      toLocation: to,
      date,
      time: args.time?.trim() || '',
      name,
      email,
      phone: args.phone?.trim() || '',
      pax,
      priceEur,
      status: 'pending',
      notes: args.message?.trim() || '',
    })
    .returning()
  const reference = buildReference(row.id, row.createdAt)
  await db.update(transfers).set({ reference }).where(eq(transfers.id, row.id))

  await sendEmail({
    to: NOTIFY_EMAIL,
    replyTo: email,
    subject: `New transfer request: ${routeLabel(from, to)} — ${date}`,
    html: emailShell(
      'New transfer request',
      `<p style="margin:0 0 14px"><strong>${escapeHtml(name)}</strong> &lt;${escapeHtml(email)}&gt;${
        args.phone ? ` &middot; ${escapeHtml(args.phone.trim())}` : ''
      }</p>
       <table style="border-collapse:collapse;font-size:14px;color:#3a4653">
         <tr><td style="padding:2px 16px 2px 0;color:#8592a0">Route</td><td>${escapeHtml(routeLabel(from, to))}</td></tr>
         <tr><td style="padding:2px 16px 2px 0;color:#8592a0">Date</td><td>${escapeHtml(date)}${args.time ? ` at ${escapeHtml(args.time.trim())}` : ''}</td></tr>
         <tr><td style="padding:2px 16px 2px 0;color:#8592a0">Passengers</td><td>${pax}</td></tr>
         <tr><td style="padding:2px 16px 2px 0;color:#8592a0">Reference</td><td>${escapeHtml(reference)}</td></tr>
       </table>
       ${args.message ? `<p style="margin:14px 0 0;white-space:pre-wrap">${escapeHtml(args.message.trim())}</p>` : ''}
       <p style="margin:16px 0 0;color:#8592a0;font-size:13px">Open the admin bookings page → Transfers to confirm, price and send a voucher.</p>`,
    ),
  })

  // Ring every subscribed device (works even when the app is closed).
  try {
    await sendPushToAll({
      title: 'New transfer request',
      body: `${name} — ${routeLabel(from, to)} on ${date}`,
      url: '/admin/bookings',
      tag: 'aam-transfer',
    })
  } catch {
    /* push is best-effort */
  }

  revalidatePath('/admin/bookings')
  return { ok: true, reference }
}
