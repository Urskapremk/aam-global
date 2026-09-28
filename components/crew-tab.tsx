'use client'

import {
  Anchor,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Trash2,
  Users,
  X,
} from 'lucide-react'
import { useState } from 'react'
import useSWR from 'swr'

import {
  deletePayout,
  getCrewMonth,
  getKnownWorkers,
  logPayout,
  type CrewRole,
} from '@/app/actions/crew'
import { getFxRates } from '@/app/actions/fuel'
import { fxHint } from '@/lib/currency'

const nf = new Intl.NumberFormat('en-GB')
const ariary = (n: number) => `${nf.format(Math.round(n))} Ar`

const dateFmt = (iso: string) =>
  new Date(iso).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })

// Hours read as one decimal; "0.0 h" for a worker whose trips all lack an end
// time would look like a real zero, so that case shows an em dash instead.
const hoursLabel = (h: number, trips: number, missing: number) => {
  if (trips === 0) return '—' // paid but ran no trips this month
  if (missing >= trips) return '—' // every trip missing an end time
  return `${h.toFixed(1)} h`
}

// Captain vs crew, in the app's established tones (sky for captain, sage crew).
function roleTone(role: CrewRole) {
  return role === 'captain'
    ? { fg: '#1f6f96', bg: '#1f6f9622', label: 'Captain' }
    : { fg: '#4f7a54', bg: '#4f7a5422', label: 'Crew' }
}

export function CrewTab() {
  const monthsData = useSWR('crew-init', () => getCrewMonth())
  // Live EUR + Rand reference beside the Ariary payouts. Same 'fx-rates' key
  // as everywhere else, so a rate change on the Exchange screen updates here.
  const fx = useSWR('fx-rates', () => getFxRates())
  const rates = fx.data
  const [month, setMonth] = useState<string | null>(null)

  const list = monthsData.data?.availableMonths ?? []
  const active = month ?? list[0] ?? null

  const data = useSWR(active ? ['crew', active] : 'crew-init', () =>
    getCrewMonth(active ?? undefined),
  )
  const d = data.data

  const idx = active ? list.indexOf(active) : -1
  const older = idx >= 0 && idx < list.length - 1 ? list[idx + 1] : null
  const newer = idx > 0 ? list[idx - 1] : null

  const monthLabel = d
    ? new Date(`${d.month}-01T00:00:00Z`).toLocaleDateString('en-GB', {
        month: 'long',
        year: 'numeric',
      })
    : '—'

  const [formOpen, setFormOpen] = useState(false)

  return (
    <div className="space-y-6">
      {/* Month switcher */}
      <div className="flex items-center justify-between gap-3 rounded-2xl border border-border bg-card px-4 py-3">
        <button
          type="button"
          disabled={!older}
          onClick={() => older && setMonth(older)}
          className="flex h-10 w-10 items-center justify-center rounded-full border border-border text-foreground transition disabled:cursor-not-allowed disabled:opacity-30 enabled:cursor-pointer enabled:hover:bg-background/60"
          aria-label="Previous month"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
        <div className="text-center">
          <p className="text-[10px] uppercase tracking-[0.22em] text-accent">
            Crew payroll
          </p>
          <p className="mt-0.5 font-serif text-xl text-foreground">
            {monthLabel}
          </p>
        </div>
        <button
          type="button"
          disabled={!newer}
          onClick={() => newer && setMonth(newer)}
          className="flex h-10 w-10 items-center justify-center rounded-full border border-border text-foreground transition disabled:cursor-not-allowed disabled:opacity-30 enabled:cursor-pointer enabled:hover:bg-background/60"
          aria-label="Next month"
        >
          <ChevronRight className="h-5 w-5" />
        </button>
      </div>

      {data.isLoading || !d ? (
        <div className="flex items-center justify-center rounded-2xl border border-border bg-card py-16 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      ) : (
        <>
          {/* Total paid + honest note */}
          <section className="overflow-hidden rounded-2xl border border-border bg-card">
            <header className="flex flex-wrap items-center justify-between gap-4 bg-panel-header p-5">
              <div>
                <p className="text-[10px] uppercase tracking-[0.22em] text-panel-header-foreground/60">
                  Paid this month
                </p>
                <p className="mt-1 text-3xl font-medium tabular-nums text-panel-header-foreground">
                  {ariary(d.totalPaidAr)}
                </p>
                {d.totalPaidAr > 0 && fxHint(d.totalPaidAr, rates, 'en') && (
                  <p className="mt-1 text-xs tabular-nums text-panel-header-foreground/60">
                    {fxHint(d.totalPaidAr, rates, 'en')}
                  </p>
                )}
              </div>
              <Users
                className="h-8 w-8 text-panel-header-foreground/40"
                aria-hidden
              />
            </header>
            <div className="p-5">
              <p className="text-[11px] leading-relaxed text-muted-foreground">
                Hours come straight from the trips each person ran; paid is what
                you have logged as handed over. They are shown side by side, not
                divided into a rate — there is no agreed hourly rate on record,
                so any &ldquo;owed&rdquo; figure would be invented.
              </p>
            </div>
          </section>

          {/* Per-person table */}
          <section className="overflow-hidden rounded-2xl border border-border bg-card">
            <header className="flex items-center gap-2 bg-panel-header px-5 py-3">
              <Anchor
                className="h-4 w-4 text-panel-header-foreground/70"
                aria-hidden
              />
              <h2 className="text-sm font-medium text-panel-header-foreground">
                People this month
              </h2>
            </header>
            {d.rows.length === 0 ? (
              <p className="p-5 text-sm text-muted-foreground">
                No trips or payouts recorded for {monthLabel}.
              </p>
            ) : (
              <ul className="divide-y divide-border">
                {d.rows.map((r) => {
                  const tone = roleTone(r.role)
                  return (
                    <li
                      key={`${r.role}-${r.name}`}
                      className="flex flex-wrap items-center gap-x-4 gap-y-2 p-4"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="truncate text-sm font-medium text-foreground">
                            {r.name}
                          </span>
                          <span
                            className="flex-shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.1em]"
                            style={{ color: tone.fg, backgroundColor: tone.bg }}
                          >
                            {tone.label}
                          </span>
                        </div>
                        <p className="mt-1 text-[11px] text-muted-foreground">
                          {r.trips === 0
                            ? 'No trips this month'
                            : `${r.trips} trip${r.trips === 1 ? '' : 's'}`}
                          {r.tripsMissingTime > 0 &&
                            ` · ${r.tripsMissingTime} without an end time`}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                          Hours
                        </p>
                        <p className="text-sm font-medium tabular-nums text-foreground">
                          {hoursLabel(r.hours, r.trips, r.tripsMissingTime)}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                          Paid
                        </p>
                        <p className="text-sm font-medium tabular-nums text-foreground">
                          {r.paidAr > 0 ? ariary(r.paidAr) : '—'}
                        </p>
                        {r.paidAr > 0 && fxHint(r.paidAr, rates, 'en') && (
                          <p className="text-[10px] tabular-nums text-muted-foreground">
                            {fxHint(r.paidAr, rates, 'en')}
                          </p>
                        )}
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}
          </section>

          {/* Payout ledger */}
          <section className="overflow-hidden rounded-2xl border border-border bg-card">
            <header className="flex items-center justify-between gap-2 bg-panel-header px-5 py-3">
              <h2 className="text-sm font-medium text-panel-header-foreground">
                Payouts logged
              </h2>
              <button
                type="button"
                onClick={() => setFormOpen((v) => !v)}
                className="flex min-h-11 cursor-pointer items-center gap-1.5 rounded-full bg-panel-header-foreground/10 px-4 text-xs font-medium uppercase tracking-[0.1em] text-panel-header-foreground transition hover:bg-panel-header-foreground/20"
              >
                {formOpen ? (
                  <>
                    <X className="h-4 w-4" /> Close
                  </>
                ) : (
                  'Log a payout'
                )}
              </button>
            </header>

            {formOpen && (
              <PayoutForm
                onDone={() => {
                  setFormOpen(false)
                  data.mutate()
                }}
              />
            )}

            {d.payouts.length === 0 ? (
              <p className="p-5 text-sm text-muted-foreground">
                Nothing logged for {monthLabel}.
              </p>
            ) : (
              <ul className="divide-y divide-border">
                {d.payouts.map((p) => (
                  <li key={p.id} className="flex items-center gap-3 p-4">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-foreground">
                        {p.personName}
                        <span className="ml-2 text-[11px] font-normal text-muted-foreground">
                          {dateFmt(p.paidAt)}
                        </span>
                      </p>
                      {(p.note || p.loggedBy) && (
                        <p className="mt-0.5 text-[11px] text-muted-foreground">
                          {[p.note, p.loggedBy && `by ${p.loggedBy}`]
                            .filter(Boolean)
                            .join(' · ')}
                        </p>
                      )}
                    </div>
                    <div className="flex-shrink-0 text-right">
                      <span className="text-sm font-medium tabular-nums text-foreground">
                        {ariary(p.amountAr)}
                      </span>
                      {fxHint(p.amountAr, rates, 'en') && (
                        <p className="text-[10px] tabular-nums text-muted-foreground">
                          {fxHint(p.amountAr, rates, 'en')}
                        </p>
                      )}
                    </div>
                    <DeleteButton id={p.id} onDone={() => data.mutate()} />
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </div>
  )
}

function DeleteButton({ id, onDone }: { id: string; onDone: () => void }) {
  const [busy, setBusy] = useState(false)
  return (
    <button
      type="button"
      disabled={busy}
      aria-label="Delete payout"
      onClick={async () => {
        setBusy(true)
        try {
          await deletePayout(id)
          onDone()
        } finally {
          setBusy(false)
        }
      }}
      className="flex h-11 w-11 flex-shrink-0 cursor-pointer items-center justify-center rounded-full text-muted-foreground transition-colors hover:text-[#b0203a] disabled:opacity-50"
    >
      {busy ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <Trash2 className="h-4 w-4" />
      )}
    </button>
  )
}

function PayoutForm({ onDone }: { onDone: () => void }) {
  const workers = useSWR('crew-workers', () => getKnownWorkers())
  const [name, setName] = useState('')
  const [role, setRole] = useState<CrewRole>('crew')
  const [amount, setAmount] = useState('')
  const [note, setNote] = useState('')
  const [loggedBy, setLoggedBy] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const inputClass =
    'w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/60 focus:border-accent focus:outline-none'
  const labelClass =
    'mb-1 block text-[11px] uppercase tracking-[0.12em] text-muted-foreground'

  const submit = async () => {
    setErr(null)
    const amt = Number(amount)
    if (!name.trim()) return setErr('Choose or type a name.')
    if (!(amt > 0)) return setErr('Enter an amount greater than zero.')
    setBusy(true)
    try {
      await logPayout({
        personName: name.trim(),
        role,
        amountAr: amt,
        note: note.trim() || null,
        loggedBy: loggedBy.trim() || null,
      })
      onDone()
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Could not save.')
      setBusy(false)
    }
  }

  return (
    <div className="space-y-4 border-b border-border bg-background/40 p-5">
      <div>
        <label className={labelClass} htmlFor="payout-name">
          Person
        </label>
        <input
          id="payout-name"
          list="crew-worker-list"
          value={name}
          onChange={(e) => {
            const v = e.target.value
            setName(v)
            // If they picked a known worker, default the role to match.
            const found = workers.data?.find((w) => w.name === v.trim())
            if (found) setRole(found.role)
          }}
          placeholder="Choose or type a name"
          className={inputClass}
        />
        <datalist id="crew-worker-list">
          {(workers.data ?? []).map((w) => (
            <option key={w.name} value={w.name} />
          ))}
        </datalist>
      </div>

      <div className="flex gap-2">
        {(['captain', 'crew'] as CrewRole[]).map((r) => {
          const active = role === r
          const tone = roleTone(r)
          return (
            <button
              key={r}
              type="button"
              onClick={() => setRole(r)}
              aria-pressed={active}
              className="min-h-11 flex-1 cursor-pointer rounded-lg border px-4 text-sm font-medium capitalize transition"
              style={
                active
                  ? { borderColor: tone.fg, color: tone.fg, backgroundColor: tone.bg }
                  : undefined
              }
            >
              {r}
            </button>
          )
        })}
      </div>

      <div>
        <label className={labelClass} htmlFor="payout-amount">
          Amount (Ar)
        </label>
        <input
          id="payout-amount"
          inputMode="decimal"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="e.g. 150000"
          className={inputClass}
        />
      </div>

      <div>
        <label className={labelClass} htmlFor="payout-note">
          Note (optional)
        </label>
        <input
          id="payout-note"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="e.g. week of 20–26 Aug"
          className={inputClass}
        />
      </div>

      <div>
        <label className={labelClass} htmlFor="payout-by">
          Logged by (optional)
        </label>
        <input
          id="payout-by"
          value={loggedBy}
          onChange={(e) => setLoggedBy(e.target.value)}
          placeholder="Your name"
          className={inputClass}
        />
      </div>

      {err && <p className="text-xs text-[#b0203a]">{err}</p>}

      <button
        type="button"
        disabled={busy}
        onClick={submit}
        className="flex min-h-11 w-full cursor-pointer items-center justify-center gap-2 rounded-lg bg-accent text-sm font-semibold uppercase tracking-[0.12em] text-accent-foreground transition hover:opacity-90 disabled:opacity-60"
      >
        {busy && <Loader2 className="h-4 w-4 animate-spin" />}
        Save payout
      </button>
    </div>
  )
}
