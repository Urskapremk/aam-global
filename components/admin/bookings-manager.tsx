'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  Check,
  X,
  Trash2,
  Loader2,
  Ship,
  CalendarDays,
  Mail,
  Phone,
  Users,
  ChevronLeft,
  ChevronRight,
  Lock,
  LockOpen,
  Plus,
  Pencil,
  Clock,
  Euro,
  Ticket,
  Send,
} from 'lucide-react'
import {
  setBookingStatus,
  deleteBooking,
  setBlockedDays,
  createBooking,
  updateBooking,
  getVoucherPreview,
  sendBookingVoucher,
  type BoatBooking,
} from '@/app/actions/boat-bookings'
import {
  PUBLIC_BOATS,
  TRIP_TYPES,
  boatName,
  tripLabel,
  type BoatId,
  type TripTypeId,
} from '@/lib/boats'
import { cn } from '@/lib/utils'

type StatusFilter = 'pending' | 'confirmed' | 'all'

const STATUS_STYLES: Record<string, string> = {
  pending: 'bg-amber-100 text-amber-800',
  confirmed: 'bg-emerald-100 text-emerald-800',
  declined: 'bg-red-100 text-red-700',
  blocked: 'bg-slate-200 text-slate-700',
}

export function BookingsManager({ initial }: { initial: BoatBooking[] }) {
  const [busyId, setBusyId] = useState<number | null>(null)
  const [filter, setFilter] = useState<StatusFilter>('pending')
  const [showAdd, setShowAdd] = useState(false)
  const [editing, setEditing] = useState<BoatBooking | null>(null)
  const [voucherFor, setVoucherFor] = useState<BoatBooking | null>(null)
  // Local copy is the source of truth after load, so status/delete changes
  // reflect instantly. Server actions persist the change in the background.
  const [bookings, setBookings] = useState<BoatBooking[]>(initial)

  const counts = useMemo(() => {
    return {
      pending: bookings.filter((b) => b.status === 'pending').length,
      confirmed: bookings.filter((b) => b.status === 'confirmed').length,
      all: bookings.length,
    }
  }, [bookings])

  const rows = useMemo(() => {
    if (filter === 'all') return bookings
    if (filter === 'pending') return bookings.filter((b) => b.status === 'pending')
    return bookings.filter((b) => b.status === 'confirmed')
  }, [bookings, filter])

  async function changeStatus(
    id: number,
    status: 'pending' | 'confirmed' | 'declined',
  ) {
    setBusyId(id)
    setBookings((prev) =>
      prev.map((b) => (b.id === id ? { ...b, status } : b)),
    )
    try {
      await setBookingStatus(id, status)
    } finally {
      setBusyId(null)
    }
  }

  async function remove(id: number) {
    setBusyId(id)
    setBookings((prev) => prev.filter((b) => b.id !== id))
    try {
      await deleteBooking(id)
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="mx-auto max-w-4xl">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-serif text-2xl font-medium text-foreground">
            Boat bookings
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Confirm or decline requests. Confirmed and blocked days are hidden
            from the public calendar.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowAdd(true)}
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-primary/90"
        >
          <Plus className="h-4 w-4" strokeWidth={2} />
          Add booking
        </button>
      </header>

      {showAdd && (
        <AddBookingForm
          onClose={() => setShowAdd(false)}
          onSaved={(b) => {
            setBookings((prev) => [b, ...prev])
            setShowAdd(false)
          }}
        />
      )}

      {editing && (
        <AddBookingForm
          initial={editing}
          onClose={() => setEditing(null)}
          onSaved={(b) => {
            setBookings((prev) => prev.map((x) => (x.id === b.id ? b : x)))
            setEditing(null)
          }}
        />
      )}

      {voucherFor && (
        <VoucherModal booking={voucherFor} onClose={() => setVoucherFor(null)} />
      )}

      {/* Availability calendar — click a day to close/open it */}
      <AvailabilityCalendar
        bookings={bookings}
        onChange={(next) => setBookings(next)}
      />

      {/* Status filter */}
      <div className="mb-4 flex gap-1 rounded-lg border border-border bg-card p-1">
        {(
          [
            ['pending', `Pending (${counts.pending})`],
            ['confirmed', `Confirmed (${counts.confirmed})`],
            ['all', `All (${counts.all})`],
          ] as [StatusFilter, string][]
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setFilter(key)}
            className={cn(
              'flex-1 rounded-md px-3 py-2 text-sm font-medium transition-colors',
              filter === key
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Bookings list */}
      {rows.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card p-12 text-center text-muted-foreground">
          No bookings in this view.
        </div>
      ) : (
        <ul className="flex flex-col gap-3">
          {rows.map((b) => {
            const busy = busyId === b.id
            return (
              <li
                key={b.id}
                className="rounded-2xl border border-border bg-card p-5"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span
                        className={cn(
                          'rounded-full px-2 py-0.5 text-xs font-medium capitalize',
                          STATUS_STYLES[b.status] ?? 'bg-secondary text-foreground',
                        )}
                      >
                        {b.status}
                      </span>
                      <span className="flex items-center gap-1.5 text-sm font-medium text-foreground">
                        <Ship className="h-4 w-4 text-accent" strokeWidth={1.5} />
                        {boatName(b.boat)}
                      </span>
                    </div>
                    <p className="mt-2 flex items-center gap-1.5 font-serif text-lg text-foreground">
                      <CalendarDays className="h-4 w-4 text-muted-foreground" strokeWidth={1.5} />
                      {formatDate(b.date)}
                      {b.departureTime && (
                        <span className="flex items-center gap-1 text-base text-muted-foreground">
                          <Clock className="h-4 w-4" strokeWidth={1.5} />
                          {b.departureTime}
                        </span>
                      )}
                    </p>
                    {b.status !== 'blocked' && (
                      <p className="mt-0.5 text-sm text-muted-foreground">
                        {tripLabel(b.tripType)} · {b.guests}{' '}
                        {b.guests === 1 ? 'guest' : 'guests'}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5">
                    {b.status === 'pending' && (
                      <button
                        type="button"
                        onClick={() => changeStatus(b.id, 'confirmed')}
                        disabled={busy}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-emerald-700 disabled:opacity-60"
                      >
                        {busy ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Check className="h-4 w-4" strokeWidth={2} />
                        )}
                        Confirm
                      </button>
                    )}
                    {b.status === 'confirmed' && (
                      <button
                        type="button"
                        onClick={() => changeStatus(b.id, 'pending')}
                        disabled={busy}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground disabled:opacity-60"
                      >
                        Unconfirm
                      </button>
                    )}
                    {(b.status === 'pending' || b.status === 'confirmed') && (
                      <button
                        type="button"
                        onClick={() => changeStatus(b.id, 'declined')}
                        disabled={busy}
                        aria-label="Decline"
                        className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border text-muted-foreground transition-colors hover:border-red-300 hover:text-red-600 disabled:opacity-60"
                      >
                        <X className="h-4 w-4" strokeWidth={1.5} />
                      </button>
                    )}
                    {b.status !== 'blocked' && (
                      <button
                        type="button"
                        onClick={() => setVoucherFor(b)}
                        disabled={busy}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:border-accent hover:text-accent disabled:opacity-60"
                      >
                        <Ticket className="h-4 w-4" strokeWidth={1.5} />
                        Voucher
                      </button>
                    )}
                    {b.status !== 'blocked' && (
                      <button
                        type="button"
                        onClick={() => setEditing(b)}
                        disabled={busy}
                        aria-label="Edit"
                        className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border text-muted-foreground transition-colors hover:border-accent hover:text-accent disabled:opacity-60"
                      >
                        <Pencil className="h-4 w-4" strokeWidth={1.5} />
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => remove(b.id)}
                      disabled={busy}
                      aria-label="Delete"
                      className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border text-muted-foreground transition-colors hover:border-red-300 hover:text-red-600 disabled:opacity-60"
                    >
                      <Trash2 className="h-4 w-4" strokeWidth={1.5} />
                    </button>
                  </div>
                </div>

                {/* Contact details */}
                {b.status !== 'blocked' && (
                  <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-1.5 border-t border-border pt-4 text-sm text-muted-foreground">
                    <span className="font-medium text-foreground">{b.name}</span>
                    {b.email && (
                      <a
                        href={`mailto:${b.email}`}
                        className="flex items-center gap-1.5 transition-colors hover:text-accent"
                      >
                        <Mail className="h-3.5 w-3.5" strokeWidth={1.5} />
                        {b.email}
                      </a>
                    )}
                    {b.phone && (
                      <span className="flex items-center gap-1.5">
                        <Phone className="h-3.5 w-3.5" strokeWidth={1.5} />
                        {b.phone}
                      </span>
                    )}
                    <span className="flex items-center gap-1.5">
                      <Users className="h-3.5 w-3.5" strokeWidth={1.5} />
                      {b.guests}
                    </span>
                    {b.priceEur != null && (
                      <span className="flex items-center gap-1.5 font-medium text-foreground">
                        <Euro className="h-3.5 w-3.5" strokeWidth={1.5} />
                        {b.priceEur}
                        {b.paymentMethod && (
                          <span className="text-muted-foreground">
                            · {paymentMethodLabel(b.paymentMethod)}
                          </span>
                        )}
                      </span>
                    )}
                    {b.paymentStatus && b.paymentStatus !== 'unpaid' && (
                      <span
                        className={cn(
                          'rounded-full px-2 py-0.5 text-xs font-medium capitalize',
                          b.paymentStatus === 'paid'
                            ? 'bg-emerald-100 text-emerald-700'
                            : 'bg-amber-100 text-amber-700',
                        )}
                      >
                        {b.paymentStatus}
                      </span>
                    )}
                  </div>
                )}
                {b.status !== 'blocked' &&
                  (!b.ownEquipment ||
                    b.swimmer ||
                    b.seasickness ||
                    b.fishingExperience) && (
                    <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                      {!b.ownEquipment && (
                        <span className="rounded-full bg-sky-100 px-2 py-0.5 font-medium text-sky-700">
                          Gear rental +€{50 * b.guests}
                        </span>
                      )}
                      {b.swimmer && (
                        <span className="rounded-full bg-secondary px-2 py-0.5 text-muted-foreground">
                          Swimmer: {b.swimmer === 'yes' ? 'yes' : 'no'}
                        </span>
                      )}
                      {b.seasickness && (
                        <span className="rounded-full bg-secondary px-2 py-0.5 text-muted-foreground">
                          Seasickness: {b.seasickness === 'yes' ? 'yes' : 'no'}
                        </span>
                      )}
                      {b.fishingExperience && (
                        <span className="rounded-full bg-secondary px-2 py-0.5 text-muted-foreground">
                          Big game exp.: {b.fishingExperience === 'yes' ? 'yes' : 'no'}
                        </span>
                      )}
                    </div>
                  )}
                {b.message && (
                  <p className="mt-3 whitespace-pre-wrap rounded-lg bg-secondary p-3 text-sm text-foreground">
                    {b.message}
                  </p>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

/**
 * Admin booking form. In "add" mode it records a new booking (phone / walk-in),
 * defaulting to Odyssey and confirmed. When `initial` is passed it edits that
 * booking's content instead. Trip type covers fishing or an excursion.
 */
function AddBookingForm({
  initial,
  onClose,
  onSaved,
}: {
  initial?: BoatBooking
  onClose: () => void
  onSaved: (b: BoatBooking) => void
}) {
  const isEdit = !!initial
  const today = new Date().toISOString().slice(0, 10)
  const [boat, setBoat] = useState<BoatId>((initial?.boat as BoatId) ?? 'odyssey')
  const [tripType, setTripType] = useState<TripTypeId>(
    (initial?.tripType as TripTypeId) ?? 'big-game',
  )
  const [date, setDate] = useState(initial?.date ?? today)
  const [guests, setGuests] = useState(String(initial?.guests ?? 2))
  const [name, setName] = useState(initial?.name ?? '')
  const [email, setEmail] = useState(initial?.email ?? '')
  const [phone, setPhone] = useState(initial?.phone ?? '')
  const [message, setMessage] = useState(initial?.message ?? '')
  const [departureTime, setDepartureTime] = useState(initial?.departureTime ?? '')
  const [price, setPrice] = useState(
    initial?.priceEur != null ? String(initial.priceEur) : '',
  )
  const [paymentMethod, setPaymentMethod] = useState(initial?.paymentMethod ?? '')
  const [paymentStatus, setPaymentStatus] = useState(initial?.paymentStatus ?? 'unpaid')
  const [ownEquipment, setOwnEquipment] = useState(initial?.ownEquipment ?? true)
  const [swimmer, setSwimmer] = useState(initial?.swimmer ?? '')
  const [seasickness, setSeasickness] = useState(initial?.seasickness ?? '')
  const [fishingExperience, setFishingExperience] = useState(
    initial?.fishingExperience ?? '',
  )
  const [status, setStatus] = useState<'confirmed' | 'pending'>('confirmed')
  const rentalSurcharge = ownEquipment ? 0 : 50 * (Number(guests) || 0)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (!name.trim()) {
      setError('Enter the guest name.')
      return
    }
    setSaving(true)
    const payload = {
      boat,
      tripType,
      date,
      name,
      email,
      phone,
      guests: Number(guests) || 1,
      message,
      departureTime,
      priceEur: price.trim() === '' ? null : Number(price),
      paymentMethod,
      paymentStatus,
      ownEquipment,
      swimmer,
      seasickness,
      fishingExperience,
    }
    const res = isEdit
      ? await updateBooking(initial!.id, payload)
      : await createBooking({ ...payload, status })
    setSaving(false)
    if (!res.ok || !res.booking) {
      setError(res.error || 'Could not save the booking.')
      return
    }
    onSaved(res.booking)
  }

  const field =
    'w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-accent focus:outline-none'
  const labelCls = 'mb-1 block text-xs font-medium uppercase tracking-wide text-muted-foreground'

  return (
    <div
      className="fixed inset-0 z-[90] flex items-start justify-center overflow-y-auto bg-black/50 p-4 sm:p-8"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-2xl border border-border bg-card p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-serif text-xl font-medium text-foreground">
            {isEdit ? 'Edit booking' : 'Add booking'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-border text-muted-foreground transition-colors hover:text-foreground"
          >
            <X className="h-4 w-4" strokeWidth={1.5} />
          </button>
        </div>

        <form onSubmit={submit} className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Boat</label>
              <select
                value={boat}
                onChange={(e) => setBoat(e.target.value as BoatId)}
                className={field}
              >
                {PUBLIC_BOATS.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelCls}>Trip type</label>
              <select
                value={tripType}
                onChange={(e) => setTripType(e.target.value as TripTypeId)}
                className={field}
              >
                {TRIP_TYPES.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className={labelCls}>Date</label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className={cn(field, '[color-scheme:dark]')}
              />
            </div>
            <div>
              <label className={labelCls}>Departure</label>
              <input
                type="time"
                value={departureTime}
                onChange={(e) => setDepartureTime(e.target.value)}
                className={cn(field, '[color-scheme:dark]')}
              />
            </div>
            <div>
              <label className={labelCls}>Guests</label>
              <input
                type="number"
                min={1}
                max={50}
                value={guests}
                onChange={(e) => setGuests(e.target.value)}
                className={field}
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className={labelCls}>Price (EUR)</label>
              <input
                type="number"
                min={0}
                step={1}
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder="800"
                className={field}
              />
            </div>
            <div>
              <label className={labelCls}>Payment</label>
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
                className={field}
              >
                <option value="">—</option>
                <option value="cash">Cash</option>
                <option value="card">Card</option>
                <option value="transfer">Transfer</option>
                <option value="orange-money">Orange Money</option>
              </select>
            </div>
            <div>
              <label className={labelCls}>Paid?</label>
              <select
                value={paymentStatus}
                onChange={(e) => setPaymentStatus(e.target.value)}
                className={field}
              >
                <option value="unpaid">Unpaid</option>
                <option value="deposit">Deposit</option>
                <option value="paid">Paid</option>
              </select>
            </div>
          </div>

          <div>
            <label className={labelCls}>Guest name</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Full name"
              className={field}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Email (optional)</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={field}
              />
            </div>
            <div>
              <label className={labelCls}>Phone (optional)</label>
              <input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className={field}
              />
            </div>
          </div>

          <div>
            <label className={labelCls}>Fishing gear</label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setOwnEquipment(true)}
                className={cn(
                  'flex-1 rounded-lg border px-3 py-2 text-sm font-medium transition-colors',
                  ownEquipment
                    ? 'border-accent bg-accent/10 text-foreground'
                    : 'border-border text-muted-foreground hover:text-foreground',
                )}
              >
                Own gear
              </button>
              <button
                type="button"
                onClick={() => setOwnEquipment(false)}
                className={cn(
                  'flex-1 rounded-lg border px-3 py-2 text-sm font-medium transition-colors',
                  !ownEquipment
                    ? 'border-accent bg-accent/10 text-foreground'
                    : 'border-border text-muted-foreground hover:text-foreground',
                )}
              >
                Rent (+€50/person)
              </button>
            </div>
            {!ownEquipment && (
              <p className="mt-1 text-xs text-muted-foreground">
                Gear rental surcharge: {Number(guests) || 0} × €50 ={' '}
                <span className="font-medium text-foreground">€{rentalSurcharge}</span>{' '}
                (add to the price above).
              </p>
            )}
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className={labelCls}>Swimmer?</label>
              <select
                value={swimmer}
                onChange={(e) => setSwimmer(e.target.value)}
                className={field}
              >
                <option value="">—</option>
                <option value="yes">Yes</option>
                <option value="no">No</option>
              </select>
            </div>
            <div>
              <label className={labelCls}>Seasickness?</label>
              <select
                value={seasickness}
                onChange={(e) => setSeasickness(e.target.value)}
                className={field}
              >
                <option value="">—</option>
                <option value="yes">Yes</option>
                <option value="no">No</option>
              </select>
            </div>
            <div>
              <label className={labelCls}>Big game exp.?</label>
              <select
                value={fishingExperience}
                onChange={(e) => setFishingExperience(e.target.value)}
                className={field}
              >
                <option value="">—</option>
                <option value="yes">Yes</option>
                <option value="no">No</option>
              </select>
            </div>
          </div>

          <div>
            <label className={labelCls}>Notes (optional)</label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={2}
              placeholder="Activity, meeting point, price agreed…"
              className={cn(field, 'resize-y')}
            />
          </div>

          {!isEdit && (
            <div>
              <label className={labelCls}>Status</label>
              <div className="flex gap-2">
                {(['confirmed', 'pending'] as const).map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setStatus(s)}
                    className={cn(
                      'flex-1 rounded-lg border px-3 py-2 text-sm font-medium capitalize transition-colors',
                      status === s
                        ? 'border-accent bg-accent/10 text-foreground'
                        : 'border-border text-muted-foreground hover:text-foreground',
                    )}
                  >
                    {s}
                  </button>
                ))}
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                Confirmed closes the day on the public calendar right away.
              </p>
            </div>
          )}

          {error && (
            <p className="rounded-lg bg-red-100 px-3 py-2 text-sm text-red-700">
              {error}
            </p>
          )}

          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-border px-4 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-60"
            >
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Check className="h-4 w-4" strokeWidth={2} />
              )}
              Save booking
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

/**
 * Voucher preview + send. Loads the exact branded HTML the guest will receive
 * (rendered in an isolated iframe), then emails it to the booking's address.
 */
function VoucherModal({
  booking,
  onClose,
}: {
  booking: BoatBooking
  onClose: () => void
}) {
  const [html, setHtml] = useState<string | null>(null)
  // Natural (unscaled) content height of the voucher, and the scale needed to
  // fit it fully in the available viewport height without scrolling.
  const [frameHeight, setFrameHeight] = useState(420)
  const [scale, setScale] = useState(1)
  const [sending, setSending] = useState(false)
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null)

  useEffect(() => {
    let alive = true
    getVoucherPreview(booking.id).then((h) => {
      if (alive) setHtml(h)
    })
    return () => {
      alive = false
    }
  }, [booking.id])

  const validEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(booking.email.trim())

  async function send() {
    setSending(true)
    setResult(null)
    const res = await sendBookingVoucher(booking.id)
    setSending(false)
    setResult({
      ok: res.ok,
      text: res.ok
        ? `Voucher sent to ${booking.email}.`
        : res.error || 'Could not send the voucher.',
    })
  }

  return (
    <div
      className="fixed inset-0 z-[90] flex items-start justify-center overflow-y-auto bg-black/50 p-4 sm:p-8"
      onClick={onClose}
    >
      <div
        className="flex max-h-[calc(100vh-4rem)] w-full max-w-2xl flex-col overflow-y-auto rounded-2xl border border-border bg-card p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="font-serif text-xl font-medium text-foreground">
              Booking voucher
            </h2>
            <p className="mt-0.5 text-sm text-muted-foreground">
              {boatName(booking.boat)} · {tripLabel(booking.tripType)}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-border text-muted-foreground transition-colors hover:text-foreground"
          >
            <X className="h-4 w-4" strokeWidth={1.5} />
          </button>
        </div>

        <div
          className="overflow-hidden rounded-lg border border-border bg-white"
          style={{ height: html ? frameHeight * scale : 420 }}
        >
          {html ? (
            <iframe
              title="Voucher preview"
              srcDoc={html}
              onLoad={(e) => {
                // Measure the voucher's true height, then scale it down so the
                // whole thing fits in the viewport without scrolling.
                try {
                  const doc = e.currentTarget.contentDocument
                  const h = (doc?.body?.scrollHeight ?? 0) + 8
                  if (h) {
                    setFrameHeight(h)
                    // Reserve ~230px for modal header, footer and paddings.
                    const available = window.innerHeight - 230
                    setScale(Math.min(1, available / h))
                  }
                } catch {
                  /* cross-origin: keep fallback height */
                }
              }}
              style={{
                height: frameHeight,
                transform: `scale(${scale})`,
                transformOrigin: 'top center',
              }}
              className="w-full"
              sandbox="allow-same-origin"
            />
          ) : (
            <div className="flex h-[420px] items-center justify-center text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          )}
        </div>

        {!validEmail && (
          <p className="mt-3 rounded-lg bg-amber-100 px-3 py-2 text-sm text-amber-800">
            This booking has no valid guest email. Add one via Edit to send the
            voucher.
          </p>
        )}

        {result && (
          <p
            className={cn(
              'mt-3 rounded-lg px-3 py-2 text-sm',
              result.ok
                ? 'bg-emerald-100 text-emerald-700'
                : 'bg-red-100 text-red-700',
            )}
          >
            {result.text}
          </p>
        )}

        <div className="mt-4 flex items-center justify-between gap-2">
          <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <Mail className="h-4 w-4" strokeWidth={1.5} />
            {booking.email || 'No email on file'}
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-border px-4 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              Close
            </button>
            <button
              type="button"
              onClick={send}
              disabled={sending || !validEmail || (result?.ok ?? false)}
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-60"
            >
              {sending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" strokeWidth={2} />
              )}
              {result?.ok ? 'Sent' : 'Send to guest'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

/** Human-friendly label for a stored payment method slug. */
function paymentMethodLabel(method: string): string {
  const map: Record<string, string> = {
    cash: 'Cash',
    card: 'Card',
    transfer: 'Transfer',
    'orange-money': 'Orange Money',
  }
  return map[method] ?? method
}

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]
const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

function ymd(y: number, m: number, d: number) {
  return `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

/**
 * Interactive availability calendar. Click any day to close it (turns red /
 * unavailable) or reopen it. Days with a real confirmed customer booking are
 * shown as booked and can't be reopened from here. Also blocks/opens the whole
 * visible month in one click.
 */
function AvailabilityCalendar({
  bookings,
  onChange,
}: {
  bookings: BoatBooking[]
  onChange: (next: BoatBooking[]) => void
}) {
  const now = new Date()
  const [boat, setBoat] = useState<BoatId>('odyssey')
  const [month, setMonth] = useState(now.getMonth())
  const [year, setYear] = useState(now.getFullYear())
  const [busyDate, setBusyDate] = useState<string | null>(null)
  const [busyMonth, setBusyMonth] = useState(false)

  // Sets of dates for the SELECTED boat only — each boat is independent.
  const { blocked, booked } = useMemo(() => {
    const blocked = new Set<string>()
    const booked = new Set<string>()
    for (const b of bookings) {
      if (b.boat !== boat) continue
      if (b.status === 'blocked') blocked.add(b.date)
      else if (b.status === 'confirmed') booked.add(b.date)
    }
    return { blocked, booked }
  }, [bookings, boat])

  const cells = useMemo(() => buildCalendar(year, month), [year, month])
  const today = ymd(now.getFullYear(), now.getMonth(), now.getDate())
  const totalDays = daysInMonth(year, month)

  // Is every (non-past) day in this month closed already?
  const monthAllClosed = useMemo(() => {
    for (let d = 1; d <= totalDays; d++) {
      const key = ymd(year, month, d)
      if (key < today) continue
      if (!blocked.has(key) && !booked.has(key)) return false
    }
    return true
  }, [year, month, totalDays, blocked, booked, today])

  async function toggleDay(dateKey: string) {
    if (booked.has(dateKey)) return // real booking — manage it in the list
    setBusyDate(dateKey)
    const res = await setBlockedDays(boat, [dateKey], !blocked.has(dateKey))
    setBusyDate(null)
    if (res.ok && res.bookings) onChange(res.bookings)
  }

  async function toggleMonth() {
    const dates: string[] = []
    for (let d = 1; d <= totalDays; d++) {
      const key = ymd(year, month, d)
      if (key < today) continue
      dates.push(key)
    }
    if (dates.length === 0) return
    setBusyMonth(true)
    const res = await setBlockedDays(boat, dates, !monthAllClosed)
    setBusyMonth(false)
    if (res.ok && res.bookings) onChange(res.bookings)
  }

  function prevMonth() {
    if (month === 0) {
      setMonth(11)
      setYear((y) => y - 1)
    } else setMonth((m) => m - 1)
  }
  function nextMonth() {
    if (month === 11) {
      setMonth(0)
      setYear((y) => y + 1)
    } else setMonth((m) => m + 1)
  }

  const atCurrentMonth =
    year < now.getFullYear() ||
    (year === now.getFullYear() && month <= now.getMonth())

  return (
    <div className="mb-6 rounded-2xl border border-border bg-card p-5">
      <div className="mb-1 flex items-center gap-2 text-sm font-medium text-foreground">
        <CalendarDays className="h-4 w-4 text-accent" strokeWidth={1.5} />
        Availability — tap a day to close or open it
      </div>
      <p className="mb-4 text-xs text-muted-foreground">
        Each boat has its own calendar. Closed days turn red and disappear from
        the public calendar for the selected boat only.
      </p>

      {/* Boat selector — each boat is booked independently */}
      <div className="mb-4 flex flex-wrap gap-2">
        {PUBLIC_BOATS.map((b) => {
          const active = b.id === boat
          return (
            <button
              key={b.id}
              type="button"
              onClick={() => setBoat(b.id)}
              aria-pressed={active}
              className={cn(
                'inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition-colors',
                active
                  ? 'border-accent bg-accent/10 text-foreground'
                  : 'border-border text-muted-foreground hover:text-foreground',
              )}
            >
              <Ship className="h-4 w-4" strokeWidth={1.5} />
              {b.name}
            </button>
          )
        })}
      </div>

      {/* Month nav + whole-month toggle */}
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={prevMonth}
            disabled={atCurrentMonth}
            aria-label="Previous month"
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-border text-muted-foreground transition-colors hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
          >
            <ChevronLeft className="h-4 w-4" strokeWidth={1.5} />
          </button>
          <span className="min-w-[150px] text-center font-serif text-lg text-foreground">
            {MONTHS[month]} {year}
          </span>
          <button
            type="button"
            onClick={nextMonth}
            aria-label="Next month"
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-border text-muted-foreground transition-colors hover:text-foreground"
          >
            <ChevronRight className="h-4 w-4" strokeWidth={1.5} />
          </button>
        </div>
        <button
          type="button"
          onClick={toggleMonth}
          disabled={busyMonth}
          className={cn(
            'inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors disabled:opacity-60',
            monthAllClosed
              ? 'border border-border text-muted-foreground hover:text-foreground'
              : 'bg-red-600 text-white hover:bg-red-700',
          )}
        >
          {busyMonth ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : monthAllClosed ? (
            <LockOpen className="h-4 w-4" strokeWidth={1.5} />
          ) : (
            <Lock className="h-4 w-4" strokeWidth={1.5} />
          )}
          {monthAllClosed ? 'Open whole month' : 'Close whole month'}
        </button>
      </div>

      {/* Weekday header */}
      <div className="grid grid-cols-7 gap-1.5 text-center text-xs font-medium text-muted-foreground">
        {WEEKDAYS.map((w) => (
          <div key={w} className="py-1">
            {w}
          </div>
        ))}
      </div>

      {/* Day grid */}
      <div className="mt-1.5 grid grid-cols-7 gap-1.5">
        {cells.map((day, i) => {
          if (day === null) return <div key={`e${i}`} />
          const key = ymd(year, month, day)
          const isPast = key < today
          const isBooked = booked.has(key)
          const isBlocked = blocked.has(key)
          const busy = busyDate === key

          return (
            <button
              key={key}
              type="button"
              disabled={isPast || isBooked || busy}
              onClick={() => toggleDay(key)}
              aria-label={`${key}${isBlocked ? ' — closed' : isBooked ? ' — booked' : ' — open'}`}
              className={cn(
                'relative flex aspect-square items-center justify-center rounded-lg text-sm font-medium transition-colors',
                isPast && 'cursor-not-allowed text-muted-foreground/30',
                !isPast &&
                  isBooked &&
                  'cursor-not-allowed bg-amber-100 text-amber-800',
                !isPast &&
                  isBlocked &&
                  'bg-red-600 text-white hover:bg-red-700',
                !isPast &&
                  !isBooked &&
                  !isBlocked &&
                  'border border-border text-foreground hover:border-accent hover:bg-accent/5',
              )}
            >
              {busy ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                day
              )}
            </button>
          )
        })}
      </div>

      {/* Legend */}
      <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="h-3 w-3 rounded border border-border" /> Open
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-3 w-3 rounded bg-red-600" /> Closed
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-3 w-3 rounded bg-amber-100" /> Booked
        </span>
      </div>
    </div>
  )
}

function daysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate()
}

/** Build a Mon-first grid: leading nulls + day numbers. */
function buildCalendar(year: number, month: number): (number | null)[] {
  const first = new Date(year, month, 1).getDay() // 0=Sun..6=Sat
  const lead = (first + 6) % 7 // convert to Mon-first
  const total = daysInMonth(year, month)
  const cells: (number | null)[] = []
  for (let i = 0; i < lead; i++) cells.push(null)
  for (let d = 1; d <= total; d++) cells.push(d)
  return cells
}

function formatDate(ymdStr: string) {
  const [y, m, d] = ymdStr.split('-').map(Number)
  if (!y || !m || !d) return ymdStr
  return new Date(y, m - 1, d).toLocaleDateString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}
