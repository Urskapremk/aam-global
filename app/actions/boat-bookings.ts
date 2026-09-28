'use server'

import { db } from '@/lib/db'
import { boatBookings, messages } from '@/lib/db/schema'
import { and, asc, desc, eq, gte, lte, inArray } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { isAdmin } from '@/lib/admin-auth'
import { sendEmail, emailShell, NOTIFY_EMAIL } from '@/lib/email'
import { boatName, tripLabel, type BoatId, type TripTypeId } from '@/lib/boats'
import { sendPushToAll } from '@/lib/push'

async function requireAdmin() {
  if (!(await isAdmin())) throw new Error('Unauthorized')
}

export type BoatBooking = {
  id: number
  boat: string
  tripType: string
  date: string
  name: string
  email: string
  phone: string
  guests: number
  message: string
  departureTime: string
  priceEur: number | null
  paymentMethod: string
  paymentStatus: string
  ownEquipment: boolean
  swimmer: string
  seasickness: string
  fishingExperience: string
  status: string
  createdAt: string
}

function serialize(r: typeof boatBookings.$inferSelect): BoatBooking {
  return {
    id: r.id,
    boat: r.boat,
    tripType: r.tripType,
    date: r.date,
    name: r.name,
    email: r.email,
    phone: r.phone,
    guests: r.guests,
    message: r.message,
    departureTime: r.departureTime ?? '',
    priceEur: r.priceEur ?? null,
    paymentMethod: r.paymentMethod ?? '',
    paymentStatus: r.paymentStatus ?? 'unpaid',
    ownEquipment: r.ownEquipment ?? true,
    swimmer: r.swimmer ?? '',
    seasickness: r.seasickness ?? '',
    fishingExperience: r.fishingExperience ?? '',
    status: r.status,
    createdAt:
      r.createdAt instanceof Date ? r.createdAt.toISOString() : String(r.createdAt),
  }
}

// ---------- Public: availability + request ----------

export type DayAvailability = {
  date: string
  boat: string
  status: 'confirmed' | 'blocked'
}

/**
 * Public availability for a month range. Only confirmed bookings and
 * admin-blocked days count as unavailable; pending requests do NOT block the
 * calendar (several people may enquire about the same day).
 */
export async function getAvailability(
  startDate: string,
  endDate: string,
): Promise<DayAvailability[]> {
  const rows = await db
    .select({
      date: boatBookings.date,
      boat: boatBookings.boat,
      status: boatBookings.status,
    })
    .from(boatBookings)
    .where(
      and(
        gte(boatBookings.date, startDate),
        lte(boatBookings.date, endDate),
        inArray(boatBookings.status, ['confirmed', 'blocked']),
      ),
    )
  return rows.map((r) => ({
    date: r.date,
    boat: r.boat,
    status: r.status as 'confirmed' | 'blocked',
  }))
}

type RequestArgs = {
  boat: BoatId
  tripType: TripTypeId
  date: string
  name: string
  email: string
  phone?: string
  guests?: number
  message?: string
}

/** Public: submit a booking request (no payment). Best-effort email notify. */
export async function requestBooking(args: RequestArgs) {
  const name = args.name.trim()
  const email = args.email.trim()
  const date = args.date.trim()
  if (!name || !email || !date || !args.boat || !args.tripType) {
    return { ok: false, error: 'Please choose a boat, date, and enter your name and email.' }
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return { ok: false, error: 'Invalid date.' }
  }

  const [row] = await db
    .insert(boatBookings)
    .values({
      boat: args.boat,
      tripType: args.tripType,
      date,
      name,
      email,
      phone: args.phone?.trim() || '',
      guests: Math.max(1, Math.min(50, Math.round(args.guests || 1))),
      message: args.message?.trim() || '',
      status: 'pending',
    })
    .returning({ id: boatBookings.id })

  // Notify the business (best-effort — booking is already saved).
  await sendEmail({
    to: NOTIFY_EMAIL,
    replyTo: email,
    subject: `New boat booking request: ${boatName(args.boat)} — ${date}`,
    html: emailShell(
      'New boat booking request',
      `<p style="margin:0 0 14px"><strong>${escapeHtml(name)}</strong> &lt;${escapeHtml(email)}&gt;${
        args.phone ? ` &middot; ${escapeHtml(args.phone.trim())}` : ''
      }</p>
       <table style="border-collapse:collapse;font-size:14px;color:#3a4653">
         <tr><td style="padding:2px 16px 2px 0;color:#8592a0">Boat</td><td>${escapeHtml(boatName(args.boat))}</td></tr>
         <tr><td style="padding:2px 16px 2px 0;color:#8592a0">Trip</td><td>${escapeHtml(tripLabel(args.tripType))}</td></tr>
         <tr><td style="padding:2px 16px 2px 0;color:#8592a0">Date</td><td>${escapeHtml(date)}</td></tr>
         <tr><td style="padding:2px 16px 2px 0;color:#8592a0">Guests</td><td>${args.guests || 1}</td></tr>
       </table>
       ${args.message ? `<p style="margin:14px 0 0;white-space:pre-wrap">${escapeHtml(args.message.trim())}</p>` : ''}
       <p style="margin:16px 0 0;color:#8592a0;font-size:13px">Open the admin bookings page to confirm or decline.</p>`,
    ),
  })

  // Ring every subscribed device (works even when the app is closed).
  try {
    await sendPushToAll({
      title: 'New boat booking request',
      body: `${name} — ${boatName(args.boat)} on ${date}`,
      url: '/admin/bookings',
      tag: 'aam-booking',
    })
  } catch {
    /* push is best-effort */
  }

  revalidatePath('/admin/bookings')
  return { ok: true, id: row?.id ?? null }
}

// ---------- Admin ----------

type AdminCreateArgs = {
  boat: BoatId
  tripType: TripTypeId
  date: string
  name: string
  email?: string
  phone?: string
  guests?: number
  message?: string
  departureTime?: string
  priceEur?: number | null
  paymentMethod?: string
  paymentStatus?: string
  ownEquipment?: boolean
  swimmer?: string
  seasickness?: string
  fishingExperience?: string
  status?: 'pending' | 'confirmed'
}

/** Shared column values built from admin form args (create + update). */
function bookingValues(args: AdminCreateArgs) {
  const price =
    args.priceEur === null || args.priceEur === undefined || Number.isNaN(args.priceEur)
      ? null
      : Math.max(0, Math.round(args.priceEur))
  return {
    boat: args.boat,
    tripType: args.tripType,
    date: args.date.trim(),
    name: args.name.trim(),
    email: args.email?.trim() || '',
    phone: args.phone?.trim() || '',
    guests: Math.max(1, Math.min(50, Math.round(args.guests || 1))),
    message: args.message?.trim() || '',
    departureTime: args.departureTime?.trim() || '',
    priceEur: price,
    paymentMethod: args.paymentMethod?.trim() || '',
    paymentStatus: args.paymentStatus?.trim() || 'unpaid',
    ownEquipment: args.ownEquipment !== false,
    swimmer: args.swimmer?.trim() || '',
    seasickness: args.seasickness?.trim() || '',
    fishingExperience: args.fishingExperience?.trim() || '',
  }
}

/**
 * Admin: manually add a booking (phone / walk-in / repeat guest). Defaults to
 * confirmed so it immediately closes the day on the public calendar. No email
 * is sent — the admin already has the guest on the line.
 */
export async function createBooking(
  args: AdminCreateArgs,
): Promise<{ ok: boolean; booking?: BoatBooking; error?: string }> {
  await requireAdmin()
  const name = args.name.trim()
  const date = args.date.trim()
  if (!name || !date || !args.boat || !args.tripType) {
    return { ok: false, error: 'Choose a boat, trip type, date and enter a name.' }
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return { ok: false, error: 'Invalid date.' }
  }
  const [row] = await db
    .insert(boatBookings)
    .values({
      ...bookingValues(args),
      status: args.status === 'pending' ? 'pending' : 'confirmed',
    })
    .returning()
  revalidatePath('/admin/bookings')
  return { ok: true, booking: serialize(row) }
}

/**
 * Admin: edit an existing booking's content (boat, trip, date, guest details).
 * Status is managed separately via setBookingStatus.
 */
export async function updateBooking(
  id: number,
  args: Omit<AdminCreateArgs, 'status'>,
): Promise<{ ok: boolean; booking?: BoatBooking; error?: string }> {
  await requireAdmin()
  const name = args.name.trim()
  const date = args.date.trim()
  if (!name || !date || !args.boat || !args.tripType) {
    return { ok: false, error: 'Choose a boat, trip type, date and enter a name.' }
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return { ok: false, error: 'Invalid date.' }
  }
  const [row] = await db
    .update(boatBookings)
    .set(bookingValues(args))
    .where(eq(boatBookings.id, id))
    .returning()
  if (!row) return { ok: false, error: 'Booking not found.' }
  revalidatePath('/admin/bookings')
  return { ok: true, booking: serialize(row) }
}

export async function getBookings(): Promise<BoatBooking[]> {
  await requireAdmin()
  const rows = await db
    .select()
    .from(boatBookings)
    .orderBy(desc(boatBookings.createdAt))
  return rows.map(serialize)
}

/** Upcoming confirmed + blocked days, for the admin calendar. */
export async function getAdminAvailability(
  startDate: string,
  endDate: string,
): Promise<BoatBooking[]> {
  await requireAdmin()
  const rows = await db
    .select()
    .from(boatBookings)
    .where(and(gte(boatBookings.date, startDate), lte(boatBookings.date, endDate)))
    .orderBy(asc(boatBookings.date))
  return rows.map(serialize)
}

export async function getPendingBookingsCount() {
  await requireAdmin()
  const rows = await db
    .select({ id: boatBookings.id })
    .from(boatBookings)
    .where(eq(boatBookings.status, 'pending'))
  return rows.length
}

export async function setBookingStatus(id: number, status: BookingStatusInput) {
  await requireAdmin()
  await db.update(boatBookings).set({ status }).where(eq(boatBookings.id, id))
  revalidatePath('/admin/bookings')
  return { ok: true }
}

type BookingStatusInput = 'pending' | 'confirmed' | 'declined'

export async function deleteBooking(id: number) {
  await requireAdmin()
  await db.delete(boatBookings).where(eq(boatBookings.id, id))
  revalidatePath('/admin/bookings')
  return { ok: true }
}

/** Admin blocks a day for a boat (maintenance, private hold, etc.). */
export async function blockDay(args: { boat: BoatId; date: string; note?: string }) {
  await requireAdmin()
  if (!/^\d{4}-\d{2}-\d{2}$/.test(args.date)) {
    return { ok: false, error: 'Invalid date.' }
  }
  const [row] = await db
    .insert(boatBookings)
    .values({
      boat: args.boat,
      tripType: 'charter',
      date: args.date,
      name: 'Blocked (admin)',
      message: args.note?.trim() || '',
      status: 'blocked',
      guests: 0,
    })
    .returning()
  revalidatePath('/admin/bookings')
  return { ok: true, booking: serialize(row) }
}

/**
 * Block or open one or more days for a SINGLE boat (closes that boat's day for
 * public reservations). Each boat has its own independent availability. Used by
 * the admin availability calendar — click a day to close it, click again to
 * reopen. Returns the full, fresh bookings list so the client can reconcile its
 * local state without drift.
 */
export async function setBlockedDays(
  boat: BoatId,
  dates: string[],
  blocked: boolean,
): Promise<{ ok: boolean; bookings?: BoatBooking[]; error?: string }> {
  await requireAdmin()
  const valid = dates.filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d))
  if (valid.length === 0) return { ok: false, error: 'No valid dates.' }

  if (blocked) {
    // Only add blocked rows where none already exists for this boat.
    const existing = await db
      .select({ date: boatBookings.date })
      .from(boatBookings)
      .where(
        and(
          eq(boatBookings.boat, boat),
          inArray(boatBookings.date, valid),
          eq(boatBookings.status, 'blocked'),
        ),
      )
    const have = new Set(existing.map((r) => r.date))
    const toInsert = valid
      .filter((d) => !have.has(d))
      .map((d) => ({
        boat,
        tripType: 'charter',
        date: d,
        name: 'Blocked (admin)',
        message: '',
        status: 'blocked',
        guests: 0,
      }))
    if (toInsert.length) await db.insert(boatBookings).values(toInsert)
  } else {
    // Reopen: remove this boat's admin blocks (leaves real bookings intact).
    await db
      .delete(boatBookings)
      .where(
        and(
          eq(boatBookings.boat, boat),
          inArray(boatBookings.date, valid),
          eq(boatBookings.status, 'blocked'),
        ),
      )
  }

  revalidatePath('/admin/bookings')
  const all = await db
    .select()
    .from(boatBookings)
    .orderBy(desc(boatBookings.createdAt))
  return { ok: true, bookings: all.map(serialize) }
}

function escapeHtml(s: string) {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

// ---------- Voucher (guest-facing confirmation) ----------

const yesNo = (v: string) => (v === 'yes' ? 'Yes' : v === 'no' ? 'No' : '—')

function formatVoucherDate(iso: string): string {
  const d = new Date(iso + 'T00:00:00')
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

/** A padded, human-friendly reference like "AAM-000123". */
function voucherRef(id: number): string {
  return `AAM-${String(id).padStart(6, '0')}`
}

/** Build the branded voucher HTML for a booking (guest-facing). */
function buildVoucherHtml(b: BoatBooking): string {
  const NAVY = '#1e3a5f'
  const INK = '#3a4653'
  const MUTED = '#8592a0'
  const LINE = '#e6ebf1'

  const rentalSurcharge = b.ownEquipment ? 0 : 50 * b.guests
  const payMethodNames: Record<string, string> = {
    cash: 'Cash',
    card: 'Card',
    transfer: 'Transfer',
    'orange-money': 'Orange Money',
  }
  const payMethodLabel = b.paymentMethod
    ? payMethodNames[b.paymentMethod] ??
      b.paymentMethod.charAt(0).toUpperCase() + b.paymentMethod.slice(1)
    : ''
  const payStatusLabel =
    b.paymentStatus === 'paid'
      ? 'Paid'
      : b.paymentStatus === 'deposit'
        ? 'Deposit paid'
        : 'Payable on the day'

  // A single detail row: label on the left, value on the right.
  const row = (label: string, value: string) =>
    value
      ? `<tr>
           <td style="padding:9px 0;border-bottom:1px solid ${LINE};color:${MUTED};font-size:13px;width:44%">${escapeHtml(label)}</td>
           <td style="padding:9px 0;border-bottom:1px solid ${LINE};color:${INK};font-size:14px;font-weight:600;text-align:right">${value}</td>
         </tr>`
      : ''

  const priceRows =
    b.priceEur != null
      ? row('Charter price', `&euro;${b.priceEur}`) +
        (rentalSurcharge > 0
          ? row('Fishing gear rental', `&euro;${rentalSurcharge} (${b.guests} &times; &euro;50)`)
          : '') +
        row(
          'Total',
          `&euro;${b.priceEur + rentalSurcharge}`,
        )
      : ''

  const detailRows =
    row('Reference', escapeHtml(voucherRef(b.id))) +
    row('Guest', escapeHtml(b.name)) +
    row('Vessel', escapeHtml(boatName(b.boat))) +
    row('Activity', escapeHtml(tripLabel(b.tripType))) +
    row('Date', escapeHtml(formatVoucherDate(b.date))) +
    row('Departure', escapeHtml(b.departureTime || 'To be confirmed')) +
    row('Guests', String(b.guests)) +
    row('Fishing gear', b.ownEquipment ? 'Own gear' : 'Rental (provided)') +
    row('Swimmer', yesNo(b.swimmer)) +
    row('Seasickness', yesNo(b.seasickness)) +
    row('Big game experience', yesNo(b.fishingExperience))

  const paymentRows =
    priceRows +
    (payMethodLabel ? row('Payment method', escapeHtml(payMethodLabel)) : '') +
    row('Payment status', payStatusLabel)

  const body = `
    <p style="margin:0 0 8px;font-size:16px;color:${INK}">Dear ${escapeHtml(b.name || 'guest')},</p>
    <p style="margin:0 0 20px;color:${INK}">
      Thank you for your booking. Please find your confirmation voucher below.
      Show it on the day of departure — we look forward to welcoming you aboard.
    </p>

    <div style="border:1px solid ${LINE};border-radius:12px;padding:20px 22px;background:#fbfcfe">
      <div style="font-size:11px;letter-spacing:2px;text-transform:uppercase;color:${MUTED};margin-bottom:4px">Booking voucher</div>
      <div style="font-family:'Cormorant Garamond',Georgia,serif;font-size:24px;font-weight:600;color:${NAVY};margin-bottom:14px">${escapeHtml(boatName(b.boat))} &middot; ${escapeHtml(tripLabel(b.tripType))}</div>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse">
        ${detailRows}
      </table>
    </div>

    ${
      paymentRows
        ? `<div style="border:1px solid ${LINE};border-radius:12px;padding:20px 22px;margin-top:16px">
             <div style="font-size:11px;letter-spacing:2px;text-transform:uppercase;color:${MUTED};margin-bottom:10px">Payment</div>
             <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse">
               ${paymentRows}
             </table>
           </div>`
        : ''
    }

    ${
      b.message
        ? `<div style="margin-top:16px;padding:14px 16px;border-radius:10px;background:#f6f8fb;color:${INK};font-size:14px;white-space:pre-wrap">${escapeHtml(b.message)}</div>`
        : ''
    }

    <div style="margin-top:20px;padding:16px 18px;border-radius:10px;background:#f6f8fb;color:${INK};font-size:13px;line-height:1.7">
      <strong style="color:${NAVY}">Good to know</strong><br/>
      Please arrive 15 minutes before departure. Bring sun protection, a hat and
      a light jacket. Drinks and water are provided on board. If anything
      changes, reply to this email and we'll help right away.
    </div>
  `

  return emailShell('Booking voucher', body)
}

/** Admin: preview the exact voucher HTML for a booking (for an in-app preview). */
export async function getVoucherPreview(id: number): Promise<string> {
  await requireAdmin()
  const [row] = await db
    .select()
    .from(boatBookings)
    .where(eq(boatBookings.id, id))
    .limit(1)
  if (!row) return emailShell('Booking voucher', '<p>Booking not found.</p>')
  return buildVoucherHtml(serialize(row))
}

/**
 * Admin: email the voucher to the guest who booked. Requires the booking to
 * have a valid email on file.
 */
export async function sendBookingVoucher(
  id: number,
): Promise<{ ok: boolean; error?: string; skipped?: boolean }> {
  await requireAdmin()
  const [row] = await db
    .select()
    .from(boatBookings)
    .where(eq(boatBookings.id, id))
    .limit(1)
  if (!row) return { ok: false, error: 'Booking not found.' }
  const booking = serialize(row)
  const email = booking.email.trim()
  const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  if (!emailRe.test(email)) {
    return {
      ok: false,
      error: 'This booking has no valid guest email. Add one via Edit first.',
    }
  }

  const result = await sendEmail({
    to: email,
    subject: `Your booking voucher — ${boatName(booking.boat)} · ${formatVoucherDate(booking.date)}`,
    html: buildVoucherHtml(booking),
  })

  // Log the outgoing voucher into the mailbox "sent" history (best-effort).
  try {
    await db.insert(messages).values({
      direction: 'outbound',
      source: 'email',
      name: booking.name,
      email,
      subject: `Booking voucher — ${boatName(booking.boat)} (${voucherRef(booking.id)})`,
      body: `Voucher sent for ${boatName(booking.boat)} · ${tripLabel(booking.tripType)} on ${formatVoucherDate(booking.date)}.`,
      read: true,
      meta: JSON.stringify({ sent: result.ok, voucher: voucherRef(booking.id) }),
    })
  } catch {
    // Non-fatal: the voucher email is what matters.
  }

  revalidatePath('/admin/inbox')

  if (!result.ok) {
    return {
      ok: false,
      skipped: 'skipped' in result ? result.skipped : undefined,
      error:
        'skipped' in result && result.skipped
          ? 'Email is not configured yet (RESEND_API_KEY missing).'
          : `Could not send: ${result.error}`,
    }
  }
  return { ok: true }
}
