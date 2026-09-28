'use client'

import { useMemo, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import {
  Plus,
  Trash2,
  Loader2,
  MapPinned,
  CalendarDays,
  Mail,
  Phone,
  Users,
  Clock,
  ChevronLeft,
  ChevronRight,
  FileText,
  Ticket,
  Check,
  X,
  Printer,
  Pencil,
  Banknote,
  Smartphone,
  Send,
} from 'lucide-react'
import {
  createTransfer,
  updateTransfer,
  deleteTransfer,
  setTransferStatus,
  markTransferPaid,
  previewVoucher,
  previewInvoice,
  sendVoucher,
  sendInvoice,
  type Transfer,
  type TransferRoute,
} from '@/app/actions/transfers'
import {
  STATUS_LABEL,
  TRANSFER_STATUSES,
  computeRoutePrice,
  formatEur,
  formatTransferDate,
  paymentMethodLabel,
  routeLabel,
  arrivalTime,
  formatDuration,
} from '@/lib/transfers'
import { cn } from '@/lib/utils'

type Filter = 'upcoming' | 'pending' | 'paid' | 'all'

const STATUS_STYLES: Record<string, string> = {
  pending: 'bg-amber-100 text-amber-800',
  confirmed: 'bg-sky-100 text-sky-800',
  paid: 'bg-emerald-100 text-emerald-800',
  completed: 'bg-emerald-100 text-emerald-800',
  cancelled: 'bg-red-100 text-red-700',
}

const todayKey = () => {
  const n = new Date()
  return ymd(n.getFullYear(), n.getMonth(), n.getDate())
}

export function TransfersManager({
  initial,
  routes,
}: {
  initial: Transfer[]
  routes: TransferRoute[]
}) {
  const [transfers, setTransfers] = useState<Transfer[]>(initial)
  const [filter, setFilter] = useState<Filter>('upcoming')
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [editId, setEditId] = useState<number | null>(null)
  const [busyId, setBusyId] = useState<number | null>(null)
  const [preview, setPreview] = useState<{ title: string; html: string } | null>(null)
  const [flash, setFlash] = useState('')

  const counts = useMemo(
    () => ({
      pending: transfers.filter((t) => t.status === 'pending').length,
      paid: transfers.filter((t) => t.status === 'paid' || t.status === 'completed').length,
      all: transfers.length,
    }),
    [transfers],
  )

  // Sort chronologically by date then departure time so multiple daily
  // crossings appear in the order the boat actually leaves. Missing times
  // sort last within their day.
  function byDateTime(a: Transfer, b: Transfer) {
    if (a.date !== b.date) return a.date < b.date ? -1 : 1
    const ta = a.time || '99:99'
    const tb = b.time || '99:99'
    return ta < tb ? -1 : ta > tb ? 1 : 0
  }

  // The inline list only reflects the Upcoming/Pending/Paid/All tab. Picking a
  // day in the calendar opens a separate popup instead (see dayTransfers).
  const rows = useMemo(() => {
    let list: Transfer[]
    if (filter === 'pending') list = transfers.filter((t) => t.status === 'pending')
    else if (filter === 'paid')
      list = transfers.filter((t) => t.status === 'paid' || t.status === 'completed')
    else if (filter === 'upcoming') {
      const today = todayKey()
      list = transfers.filter((t) => t.date >= today && t.status !== 'cancelled')
    } else list = transfers
    return [...list].sort(byDateTime)
  }, [transfers, filter])

  // Every transfer on the day picked in the calendar, ordered by time — shown
  // enlarged in its own popup so a busy day is easy to read.
  const dayTransfers = useMemo(() => {
    if (!selectedDate) return []
    return transfers.filter((t) => t.date === selectedDate).sort(byDateTime)
  }, [transfers, selectedDate])

  function showFlash(msg: string) {
    setFlash(msg)
    window.setTimeout(() => setFlash(''), 3500)
  }

  async function onCreated(t: Transfer) {
    setTransfers((prev) => [t, ...prev])
    setShowForm(false)
  }

  async function changeStatus(id: number, status: string) {
    setBusyId(id)
    setTransfers((prev) => prev.map((t) => (t.id === id ? { ...t, status } : t)))
    try {
      await setTransferStatus(id, status)
    } finally {
      setBusyId(null)
    }
  }

  async function togglePaid(t: Transfer, method: 'cash' | 'bank' | 'orange') {
    const paid = !(t.status === 'paid' || t.status === 'completed')
    setBusyId(t.id)
    setTransfers((prev) =>
      prev.map((x) =>
        x.id === t.id
          ? {
              ...x,
              status: paid ? 'paid' : 'confirmed',
              paymentMethod: paid ? method : '',
              paidAt: paid ? new Date().toISOString() : null,
            }
          : x,
      ),
    )
    try {
      await markTransferPaid(t.id, paid, method)
    } finally {
      setBusyId(null)
    }
  }

  async function remove(id: number) {
    setBusyId(id)
    setTransfers((prev) => prev.filter((t) => t.id !== id))
    try {
      await deleteTransfer(id)
    } finally {
      setBusyId(null)
    }
  }

  async function doPreviewVoucher(id: number) {
    setBusyId(id)
    const html = await previewVoucher(id)
    setBusyId(null)
    setPreview({ title: 'Voucher preview', html })
  }

  async function doPreviewInvoice(id: number) {
    setBusyId(id)
    const html = await previewInvoice(id)
    setBusyId(null)
    setPreview({ title: 'Invoice preview', html })
  }

  async function doSendVoucher(t: Transfer) {
    if (!t.email) {
      showFlash('This transfer has no guest email — add one first.')
      return
    }
    setBusyId(t.id)
    const res = await sendVoucher(t.id)
    setBusyId(null)
    if (res.ok) {
      setTransfers((prev) =>
        prev.map((x) => (x.id === t.id ? { ...x, voucherSentAt: new Date().toISOString() } : x)),
      )
      showFlash(res.skipped ? 'Email is not configured yet — voucher marked as sent.' : `Voucher sent to ${t.email}.`)
    } else {
      showFlash(res.error || 'Could not send voucher.')
    }
  }

  async function doSendInvoice(t: Transfer) {
    if (!t.email) {
      showFlash('This transfer has no guest email — add one first.')
      return
    }
    setBusyId(t.id)
    const res = await sendInvoice(t.id)
    setBusyId(null)
    if (res.ok) {
      setTransfers((prev) =>
        prev.map((x) =>
          x.id === t.id
            ? { ...x, invoiceNumber: res.invoiceNumber || x.invoiceNumber, invoiceSentAt: new Date().toISOString() }
            : x,
        ),
      )
      showFlash(res.skipped ? 'Email is not configured yet — invoice issued and marked as sent.' : `Invoice ${res.invoiceNumber} sent to ${t.email}.`)
    } else {
      showFlash(res.error || 'Could not send invoice.')
    }
  }

  // A single transfer card. Shared between the inline list and the day popup so
  // both show identical actions (confirm, payment, voucher, invoice, edit).
  function renderRow(t: Transfer) {
    const busy = busyId === t.id
    const paid = t.status === 'paid' || t.status === 'completed'
    if (editId === t.id) {
      return (
        <li key={t.id} className="rounded-2xl border border-accent/40 bg-card p-5">
          <TransferForm
            routes={routes}
            editing={t}
            onCancel={() => setEditId(null)}
            onSaved={(updated) => {
              setTransfers((prev) => prev.map((x) => (x.id === updated.id ? updated : x)))
              setEditId(null)
            }}
          />
        </li>
      )
    }
    return (
      <li key={t.id} className="rounded-2xl border border-border bg-card p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={cn(
                  'rounded-full px-2 py-0.5 text-xs font-medium',
                  STATUS_STYLES[t.status] ?? 'bg-secondary text-foreground',
                )}
              >
                {STATUS_LABEL[t.status] ?? t.status}
                {paid && t.paymentMethod ? ` · ${paymentMethodLabel(t.paymentMethod)}` : ''}
              </span>
              <span className="font-mono text-xs text-muted-foreground">{t.reference}</span>
            </div>
            <p className="mt-2 inline-block rounded-lg bg-primary px-3 py-1.5 font-serif text-lg text-primary-foreground">
              {routeLabel(t.fromLocation, t.toLocation)}
            </p>
            <p className="mt-0.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <CalendarDays className="h-3.5 w-3.5" strokeWidth={1.5} />
                {formatTransferDate(t.date)}
              </span>
              {t.time && (
                <span className="flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5" strokeWidth={1.5} />
                  {t.time}
                  {arrivalTime(t.time, t.durationMin) && (
                    <span className="text-muted-foreground">
                      {'→ '}
                      {arrivalTime(t.time, t.durationMin)}
                      {' ('}
                      {formatDuration(t.durationMin)}
                      {')'}
                    </span>
                  )}
                </span>
              )}
              <span className="flex items-center gap-1.5">
                <Users className="h-3.5 w-3.5" strokeWidth={1.5} />
                {t.pax}
              </span>
            </p>
          </div>
          <div className="text-right">
            <div className="font-serif text-2xl font-medium text-foreground">
              {formatEur(t.priceEur)}
            </div>
            {t.invoiceNumber && (
              <div className="mt-1 text-xs text-muted-foreground">
                Invoice {t.invoiceNumber}
              </div>
            )}
          </div>
        </div>

        {/* Guest contact */}
        <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1.5 border-t border-border pt-3 text-sm text-muted-foreground">
          <span className="font-medium text-foreground">{t.name || '—'}</span>
          {t.email && (
            <a href={`mailto:${t.email}`} className="flex items-center gap-1.5 hover:text-accent">
              <Mail className="h-3.5 w-3.5" strokeWidth={1.5} />
              {t.email}
            </a>
          )}
          {t.phone && (
            <span className="flex items-center gap-1.5">
              <Phone className="h-3.5 w-3.5" strokeWidth={1.5} />
              {t.phone}
            </span>
          )}
        </div>

        {t.notes && (
          <p className="mt-3 whitespace-pre-wrap rounded-lg bg-secondary p-3 text-sm text-foreground">
            {t.notes}
          </p>
        )}

        {/* Status quick actions */}
        <div className="mt-4 flex flex-wrap items-center gap-2">
          {t.status === 'pending' && (
            <button
              type="button"
              onClick={() => changeStatus(t.id, 'confirmed')}
              disabled={busy}
              className="inline-flex items-center gap-1.5 rounded-lg bg-sky-600 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-sky-700 disabled:opacity-60"
            >
              <Check className="h-4 w-4" strokeWidth={2} />
              Confirm
            </button>
          )}
          {!paid ? (
            <>
              <button
                type="button"
                onClick={() => togglePaid(t, 'cash')}
                disabled={busy}
                className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-emerald-700 disabled:opacity-60"
              >
                <Banknote className="h-4 w-4" strokeWidth={1.5} />
                Paid cash
              </button>
              <button
                type="button"
                onClick={() => togglePaid(t, 'bank')}
                disabled={busy}
                className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-300 px-3 py-2 text-sm font-medium text-emerald-700 transition-colors hover:bg-emerald-50 disabled:opacity-60"
              >
                <Banknote className="h-4 w-4" strokeWidth={1.5} />
                Paid by bank
              </button>
              <button
                type="button"
                onClick={() => togglePaid(t, 'orange')}
                disabled={busy}
                className="inline-flex items-center gap-1.5 rounded-lg border border-orange-300 px-3 py-2 text-sm font-medium text-orange-600 transition-colors hover:bg-orange-50 disabled:opacity-60"
              >
                <Smartphone className="h-4 w-4" strokeWidth={1.5} />
                Paid Orange Money
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={() => togglePaid(t, 'cash')}
              disabled={busy}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground disabled:opacity-60"
            >
              Mark unpaid
            </button>
          )}
        </div>

        {/* Documents */}
        <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-border pt-3">
          <button
            type="button"
            onClick={() => doPreviewVoucher(t.id)}
            disabled={busy}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-sm font-medium text-foreground transition-colors hover:border-accent disabled:opacity-60"
          >
            <Ticket className="h-4 w-4" strokeWidth={1.5} />
            Voucher
          </button>
          <button
            type="button"
            onClick={() => doSendVoucher(t)}
            disabled={busy}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-2 text-sm text-muted-foreground transition-colors hover:text-accent disabled:opacity-60"
            aria-label="Send voucher"
          >
            <Send className="h-3.5 w-3.5" strokeWidth={1.5} />
            {t.voucherSentAt ? 'Resend' : 'Send'}
          </button>

          <span className="mx-1 hidden h-5 w-px bg-border sm:block" />

          <button
            type="button"
            onClick={() => doPreviewInvoice(t.id)}
            disabled={busy}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-sm font-medium text-foreground transition-colors hover:border-accent disabled:opacity-60"
          >
            <FileText className="h-4 w-4" strokeWidth={1.5} />
            Invoice
          </button>
          <button
            type="button"
            onClick={() => doSendInvoice(t)}
            disabled={busy}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-2 text-sm text-muted-foreground transition-colors hover:text-accent disabled:opacity-60"
            aria-label="Send invoice"
          >
            <Send className="h-3.5 w-3.5" strokeWidth={1.5} />
            {t.invoiceSentAt ? 'Resend' : 'Send'}
          </button>

          <span className="ml-auto flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => {
                setEditId(t.id)
                setShowForm(false)
              }}
              disabled={busy}
              aria-label="Edit transfer"
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border text-muted-foreground transition-colors hover:text-foreground disabled:opacity-60"
            >
              <Pencil className="h-4 w-4" strokeWidth={1.5} />
            </button>
            <button
              type="button"
              onClick={() => remove(t.id)}
              disabled={busy}
              aria-label="Delete transfer"
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border text-muted-foreground transition-colors hover:border-red-300 hover:text-red-600 disabled:opacity-60"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" strokeWidth={1.5} />}
            </button>
          </span>
        </div>
      </li>
    )
  }

  return (
    <div>
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-serif text-2xl font-medium text-foreground">Transfers</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Island transfers on Odyssey II. Book, price, take payment, and send
            the voucher and invoice — all tied to one reference.
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setShowForm((s) => !s)
            setEditId(null)
          }}
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
        >
          <Plus className="h-4 w-4" strokeWidth={2} />
          New transfer
        </button>
      </header>

      {flash && (
        <div className="mb-4 rounded-lg border border-accent/30 bg-accent/10 px-4 py-3 text-sm text-foreground">
          {flash}
        </div>
      )}

      {showForm && !editId && (
        <TransferForm
          routes={routes}
          onCancel={() => setShowForm(false)}
          onSaved={onCreated}
        />
      )}

      {/* Calendar overview */}
      <TransfersCalendar
        transfers={transfers}
        selectedDate={selectedDate}
        onSelect={(d) => setSelectedDate((cur) => (cur === d ? null : d))}
      />

      {/* Filters */}
      <div className="mb-4 flex flex-wrap items-center gap-1 rounded-lg border border-border bg-card p-1">
        {(
          [
            ['upcoming', 'Upcoming'],
            ['pending', `Pending (${counts.pending})`],
            ['paid', `Paid (${counts.paid})`],
            ['all', `All (${counts.all})`],
          ] as [Filter, string][]
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

      {/* Inline list reflects the selected tab. Picking a calendar day opens
          the enlarged popup below instead. */}
      {rows.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card p-12 text-center text-muted-foreground">
          No transfers in this view.
        </div>
      ) : (
        <ul className="flex flex-col gap-3">{rows.map(renderRow)}</ul>
      )}

      {/* Enlarged popup for the day picked in the calendar */}
      {selectedDate && (
        <DayModal
          label={formatTransferDate(selectedDate)}
          count={dayTransfers.length}
          onClose={() => setSelectedDate(null)}
        >
          {dayTransfers.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border bg-card p-12 text-center text-muted-foreground">
              No transfers on this day.
            </div>
          ) : (
            <ul className="flex flex-col gap-6">
              {dayTransfers.map((t) => (
                <li key={t.id} className="flex flex-col gap-2 sm:flex-row sm:gap-4">
                  {/* Big hour labels so the day reads like a boat timetable:
                      Departure hour and, when a duration is set, the computed
                      Arrival hour in the same style. */}
                  <div className="flex shrink-0 flex-col items-center justify-center gap-2 sm:w-32">
                    {t.time ? (
                      <>
                        <span className="flex flex-col items-center gap-0.5 rounded-xl bg-accent/15 px-3 py-2 text-accent">
                          <span className="text-[11px] font-medium uppercase tracking-wide opacity-80">
                            Departure
                          </span>
                          <span className="flex items-center gap-1.5 font-serif text-2xl font-medium">
                            <Clock className="h-5 w-5" strokeWidth={1.5} />
                            {t.time}
                          </span>
                        </span>
                        {arrivalTime(t.time, t.durationMin) && (
                          <span className="flex flex-col items-center gap-0.5 rounded-xl bg-primary px-3 py-2 text-primary-foreground">
                            <span className="text-[11px] font-medium uppercase tracking-wide opacity-70">
                              Arrival
                            </span>
                            <span className="flex items-center gap-1.5 font-serif text-2xl font-medium">
                              <Clock className="h-5 w-5" strokeWidth={1.5} />
                              {arrivalTime(t.time, t.durationMin)}
                            </span>
                            <span className="text-[11px] opacity-70">
                              ({formatDuration(t.durationMin)})
                            </span>
                          </span>
                        )}
                      </>
                    ) : (
                      <span className="rounded-xl border border-dashed border-border px-3 py-2 text-center text-xs font-medium text-muted-foreground">
                        Time not set
                      </span>
                    )}
                  </div>
                  {/* Full transfer card with all actions */}
                  <ul className="min-w-0 flex-1">{renderRow(t)}</ul>
                </li>
              ))}
            </ul>
          )}
        </DayModal>
      )}

      {preview && (
        <PreviewModal
          title={preview.title}
          html={preview.html}
          onClose={() => setPreview(null)}
        />
      )}
    </div>
  )
}

// ---------- Create / edit form ----------

function TransferForm({
  routes,
  editing,
  onCancel,
  onSaved,
}: {
  routes: TransferRoute[]
  editing?: Transfer
  onCancel: () => void
  onSaved: (t: Transfer) => void
}) {
  const [routeId, setRouteId] = useState<number | null>(editing?.routeId ?? null)
  const [from, setFrom] = useState(editing?.fromLocation ?? '')
  const [to, setTo] = useState(editing?.toLocation ?? '')
  const [date, setDate] = useState(editing?.date ?? '')
  const [time, setTime] = useState(editing?.time ?? '')
  const [duration, setDuration] = useState(
    editing?.durationMin ? String(editing.durationMin) : '',
  )
  const [name, setName] = useState(editing?.name ?? '')
  const [email, setEmail] = useState(editing?.email ?? '')
  const [phone, setPhone] = useState(editing?.phone ?? '')
  const [pax, setPax] = useState(String(editing?.pax ?? 2))
  const [price, setPrice] = useState(String(editing?.priceEur ?? ''))
  const [notes, setNotes] = useState(editing?.notes ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  function applyRoute(id: number | null, paxNum: number) {
    setRouteId(id)
    const r = routes.find((x) => x.id === id)
    if (r) {
      setFrom(r.fromLocation)
      setTo(r.toLocation)
      setPrice(String(computeRoutePrice(r.priceEur, r.priceType, paxNum)))
    }
  }

  function onPaxChange(v: string) {
    setPax(v)
    const n = Math.max(1, Math.round(Number(v) || 1))
    const r = routes.find((x) => x.id === routeId)
    if (r) setPrice(String(computeRoutePrice(r.priceEur, r.priceType, n)))
  }

  async function submit() {
    setError('')
    const paxNum = Math.max(1, Math.round(Number(pax) || 1))
    const priceNum = Math.max(0, Math.round(Number(price) || 0))
    if (!name.trim()) return setError('Enter the guest name.')
    if (!date) return setError('Choose a date.')
    if (!from.trim() && !routeId) return setError('Choose a route or enter one manually.')

    const durationNum = Math.max(0, Math.min(1440, Math.round(Number(duration) || 0)))
    setSaving(true)
    if (editing) {
      const updated: Transfer = {
        ...editing,
        routeId,
        fromLocation: from.trim(),
        toLocation: to.trim(),
        date,
        time: time.trim(),
        durationMin: durationNum,
        name: name.trim(),
        email: email.trim(),
        phone: phone.trim(),
        pax: paxNum,
        priceEur: priceNum,
        notes: notes.trim(),
      }
      await updateTransfer(editing.id, {
        routeId,
        fromLocation: updated.fromLocation,
        toLocation: updated.toLocation,
        date,
        time: updated.time,
        durationMin: durationNum,
        name: updated.name,
        email: updated.email,
        phone: updated.phone,
        pax: paxNum,
        priceEur: priceNum,
        notes: updated.notes,
      })
      setSaving(false)
      onSaved(updated)
      return
    }

    const res = await createTransfer({
      routeId,
      fromLocation: from,
      toLocation: to,
      date,
      time,
      durationMin: durationNum,
      name,
      email,
      phone,
      pax: paxNum,
      priceEur: priceNum,
      notes,
    })
    setSaving(false)
    if (res.ok && res.transfer) onSaved(res.transfer)
    else setError(res.error || 'Could not save the transfer.')
  }

  return (
    <div className={editing ? '' : 'mb-6 rounded-2xl border border-border bg-card p-5'}>
      {!editing && (
        <div className="mb-3 flex items-center gap-2 text-sm font-medium text-foreground">
          <MapPinned className="h-4 w-4 text-accent" strokeWidth={1.5} />
          New transfer
        </div>
      )}

      <Field label="Route (from your price list)">
        <select
          value={routeId ?? ''}
          onChange={(e) =>
            applyRoute(e.target.value ? Number(e.target.value) : null, Math.max(1, Math.round(Number(pax) || 1)))
          }
          className={inputCls}
        >
          <option value="">Custom route (enter manually)</option>
          {routes.map((r) => (
            <option key={r.id} value={r.id}>
              {routeLabel(r.fromLocation, r.toLocation)} — {formatEur(r.priceEur)}
              {r.priceType === 'per_person' ? '/person' : ''}
            </option>
          ))}
        </select>
      </Field>

      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="From">
          <input value={from} onChange={(e) => setFrom(e.target.value)} className={inputCls} placeholder="Big Port Nosy Be" />
        </Field>
        <Field label="To">
          <input value={to} onChange={(e) => setTo(e.target.value)} className={inputCls} placeholder="Nosy Komba — Ampangorina" />
        </Field>
        <Field label="Date">
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inputCls} />
        </Field>
        <Field label="Departure time">
          <input type="time" value={time} onChange={(e) => setTime(e.target.value)} className={inputCls} />
        </Field>
        <Field label="Trip duration (minutes)">
          <input
            value={duration}
            onChange={(e) => setDuration(e.target.value)}
            inputMode="numeric"
            className={inputCls}
            placeholder="30"
          />
        </Field>
        {/* Auto-computed arrival time: departure + duration. Always shown so
            it's clear when the boat is back and the next transfer can start. */}
        {(() => {
          const arr = arrivalTime(time.trim(), Number(duration) || 0)
          if (arr) {
            return (
              <div className="sm:col-span-2 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl bg-primary px-4 py-3 text-primary-foreground">
                <Clock className="h-5 w-5" strokeWidth={1.5} />
                <span className="text-sm uppercase tracking-wide opacity-80">
                  Arrival time
                </span>
                <span className="font-serif text-2xl font-semibold">{arr}</span>
                <span className="text-sm opacity-70">
                  ({time.trim()} + {formatDuration(Number(duration) || 0)})
                </span>
              </div>
            )
          }
          return (
            <div className="sm:col-span-2 flex items-center gap-2 rounded-xl border border-dashed border-border px-4 py-3 text-sm text-muted-foreground">
              <Clock className="h-4 w-4" strokeWidth={1.5} />
              Enter departure time and trip duration to calculate the arrival time.
            </div>
          )
        })()}
        <Field label="Passengers">
          <input value={pax} onChange={(e) => onPaxChange(e.target.value)} inputMode="numeric" className={inputCls} />
        </Field>
        <Field label="Price (EUR)">
          <input value={price} onChange={(e) => setPrice(e.target.value)} inputMode="numeric" className={inputCls} placeholder="60" />
        </Field>
        <Field label="Guest name">
          <input value={name} onChange={(e) => setName(e.target.value)} className={inputCls} placeholder="Alberto Tomba" />
        </Field>
        <Field label="Guest email">
          <input value={email} onChange={(e) => setEmail(e.target.value)} className={inputCls} placeholder="guest@email.com" />
        </Field>
        <Field label="Phone (optional)">
          <input value={phone} onChange={(e) => setPhone(e.target.value)} className={inputCls} />
        </Field>
      </div>
      <Field label="Notes (optional)">
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
          className={cn(inputCls, 'resize-y')}
          placeholder="Meeting point, luggage, flight number…"
        />
      </Field>

      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}

      <div className="mt-4 flex gap-2">
        <button
          type="button"
          onClick={submit}
          disabled={saving}
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-60"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" strokeWidth={2} />}
          {editing ? 'Save changes' : 'Create transfer'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="inline-flex items-center gap-2 rounded-lg border border-border px-4 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          <X className="h-4 w-4" strokeWidth={1.5} />
          Cancel
        </button>
      </div>
    </div>
  )
}

// ---------- Day popup ----------

// Large centered popup showing all transfers for one calendar day. Rendered
// through a portal on <body> so a transformed ancestor can't shrink it.
function DayModal({
  label,
  count,
  onClose,
  children,
}: {
  label: string
  count: number
  onClose: () => void
  children: ReactNode
}) {
  if (typeof document === 'undefined') return null

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        className="flex h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-background shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-border bg-card px-5 py-4">
          <div className="flex items-center gap-2.5">
            <CalendarDays className="h-5 w-5 text-accent" strokeWidth={1.5} />
            <div>
              <h2 className="font-serif text-lg text-foreground">{label}</h2>
              <p className="text-xs text-muted-foreground">
                {count === 0
                  ? 'No transfers'
                  : `${count} transfer${count > 1 ? 's' : ''} this day`}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border text-muted-foreground transition-colors hover:text-foreground"
          >
            <X className="h-4 w-4" strokeWidth={1.5} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-5">{children}</div>
      </div>
    </div>,
    document.body,
  )
}

// ---------- Document preview modal ----------

function PreviewModal({
  title,
  html,
  onClose,
}: {
  title: string
  html: string
  onClose: () => void
}) {
  const frameRef = useRef<HTMLIFrameElement>(null)

  function print() {
    const win = frameRef.current?.contentWindow
    if (win) {
      win.focus()
      win.print()
    }
  }

  const doc = `<!doctype html><html><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width, initial-scale=1"/><style>body{margin:0;padding:24px;background:#eef3f8}</style></head><body>${html}</body></html>`

  // Render through a portal on <body> so a transformed ancestor can't shrink the
  // fixed overlay (that made the preview collapse to a tiny box).
  if (typeof document === 'undefined') return null

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        className="flex h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-card"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-border px-5 py-3">
          <h2 className="font-serif text-lg text-foreground">{title}</h2>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={print}
              className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
            >
              <Printer className="h-4 w-4" strokeWidth={1.5} />
              Print / PDF
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border text-muted-foreground transition-colors hover:text-foreground"
            >
              <X className="h-4 w-4" strokeWidth={1.5} />
            </button>
          </div>
        </div>
        <iframe
          ref={frameRef}
          title={title}
          srcDoc={doc}
          className="w-full flex-1 border-0 bg-[#eef3f8]"
          style={{ minHeight: 0 }}
        />
      </div>
    </div>,
    document.body,
  )
}

// ---------- Calendar ----------

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]
const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

function TransfersCalendar({
  transfers,
  selectedDate,
  onSelect,
}: {
  transfers: Transfer[]
  selectedDate: string | null
  onSelect: (date: string) => void
}) {
  const now = new Date()
  const [month, setMonth] = useState(now.getMonth())
  const [year, setYear] = useState(now.getFullYear())

  const byDay = useMemo(() => {
    const map = new Map<string, Transfer[]>()
    for (const t of transfers) {
      if (t.status === 'cancelled') continue
      const list = map.get(t.date) ?? []
      list.push(t)
      map.set(t.date, list)
    }
    // Order each day's crossings by departure time (untimed ones last) so the
    // calendar reads top-to-bottom like a daily boat schedule.
    for (const list of map.values()) {
      list.sort((a, b) => {
        const ta = a.time || '99:99'
        const tb = b.time || '99:99'
        return ta < tb ? -1 : ta > tb ? 1 : 0
      })
    }
    return map
  }, [transfers])

  const cells = useMemo(() => buildCalendar(year, month), [year, month])
  const today = todayKey()

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

  return (
    <div className="mb-6 rounded-2xl border border-border bg-card p-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm font-medium text-foreground">
          <CalendarDays className="h-4 w-4 text-accent" strokeWidth={1.5} />
          Transfer schedule
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={prevMonth}
            aria-label="Previous month"
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-border text-muted-foreground transition-colors hover:text-foreground"
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
      </div>

      <div className="grid grid-cols-7 gap-1.5 text-center text-xs font-medium text-muted-foreground">
        {WEEKDAYS.map((w) => (
          <div key={w} className="py-1">{w}</div>
        ))}
      </div>

      <div className="mt-1.5 grid grid-cols-7 gap-1.5">
        {cells.map((day, i) => {
          if (day === null) return <div key={`e${i}`} />
          const key = ymd(year, month, day)
          const list = byDay.get(key) ?? []
          const has = list.length > 0
          const timed = list.filter((t) => t.time) // crossings with a set time
          const times = timed.map((t) => t.time)
          const extraCount = list.length - Math.min(timed.length, 2)
          const isToday = key === today
          const isSelected = key === selectedDate
          return (
            <button
              key={key}
              type="button"
              onClick={() => has && onSelect(key)}
              disabled={!has}
              aria-label={`${key}${has ? ` — ${list.length} transfer(s)${times.length ? `: ${times.join(', ')}` : ''}` : ''}`}
              className={cn(
                'relative flex min-h-[64px] flex-col items-center justify-start gap-0.5 rounded-lg py-1.5 text-sm transition-colors sm:min-h-[76px]',
                !has && 'text-muted-foreground/40',
                has && !isSelected && 'bg-accent/10 font-medium text-foreground hover:bg-accent/20',
                isSelected && 'bg-primary font-medium text-primary-foreground',
                isToday && !isSelected && 'ring-1 ring-accent',
              )}
            >
              <span>{day}</span>
              {has && (
                <span className="flex w-full flex-col items-center gap-0.5 px-0.5">
                  {timed.slice(0, 2).map((t) => (
                    <span
                      key={t.id}
                      className={cn(
                        'w-full truncate rounded px-1 text-center text-[10px] font-semibold leading-tight',
                        isSelected
                          ? 'bg-primary-foreground/20 text-primary-foreground'
                          : 'bg-accent/20 text-accent',
                      )}
                    >
                      {t.time}
                    </span>
                  ))}
                  {timed.length > 0 && extraCount > 0 && (
                    <span
                      className={cn(
                        'text-[9px] font-semibold leading-tight',
                        isSelected ? 'text-primary-foreground/80' : 'text-accent/80',
                      )}
                    >
                      +{extraCount}
                    </span>
                  )}
                  {timed.length === 0 && (
                    <span
                      className={cn(
                        'rounded-full px-1.5 text-[9px] font-semibold leading-tight',
                        isSelected
                          ? 'bg-primary-foreground/20 text-primary-foreground'
                          : 'bg-accent/20 text-accent',
                      )}
                    >
                      {list.length} transfer{list.length > 1 ? 's' : ''}
                    </span>
                  )}
                </span>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ---------- helpers ----------

const inputCls =
  'w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none transition-colors focus:border-accent [color-scheme:light]'

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="mt-3 block first:mt-0">
      <span className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      {children}
    </label>
  )
}

function ymd(y: number, m: number, d: number) {
  return `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}
function daysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate()
}
function buildCalendar(year: number, month: number): (number | null)[] {
  const first = new Date(year, month, 1).getDay()
  const lead = (first + 6) % 7
  const total = daysInMonth(year, month)
  const cells: (number | null)[] = []
  for (let i = 0; i < lead; i++) cells.push(null)
  for (let d = 1; d <= total; d++) cells.push(d)
  return cells
}
