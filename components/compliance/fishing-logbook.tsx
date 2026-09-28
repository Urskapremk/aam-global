'use client'

import { useState, useTransition } from 'react'
import { ChevronDown, Lock, Plus, ShieldAlert, TriangleAlert } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  DISCARD_REASONS,
  FISHING_METHODS,
  PROTECTED_INTERACTIONS,
  PROTECTED_OUTCOMES,
  TRANSSHIPMENT_WARNING,
  discardReasonLabel,
  fishingMethodLabel,
} from '@/lib/compliance'
import {
  addBycatch,
  addFishingActivity,
  addProtectedIncident,
  approveFishingLog,
  confirmProtectedIncident,
  deleteBycatch,
  recordTransshipment,
  saveLandingRecord,
  type FishingLogEntry,
} from '@/app/actions/fishing-log'

const CAPTAIN = 'Mike Schneider'

function fmtDate(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

function field(
  label: string,
  child: React.ReactNode,
) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[11px] uppercase tracking-[0.1em] text-muted-foreground">
        {label}
      </span>
      {child}
    </label>
  )
}

const inputCls =
  'rounded-md border border-border bg-background px-2.5 py-1.5 text-sm text-foreground outline-none focus:border-primary'

export function FishingLogbook({
  boats,
  logsByBoat,
}: {
  boats: { id: string; label: string }[]
  logsByBoat: Record<string, FishingLogEntry[]>
}) {
  const [activeBoat, setActiveBoat] = useState(boats[0]?.id ?? '')
  const entries = logsByBoat[activeBoat] ?? []

  return (
    <div className="space-y-6">
      {boats.length > 1 && (
        <div className="flex flex-wrap gap-2">
          {boats.map((b) => {
            const on = b.id === activeBoat
            return (
              <button
                key={b.id}
                type="button"
                onClick={() => setActiveBoat(b.id)}
                className={
                  'rounded-lg border px-4 py-2 text-sm transition-colors ' +
                  (on
                    ? 'border-primary/40 bg-primary/10 text-foreground'
                    : 'border-border bg-card text-muted-foreground hover:bg-muted')
                }
              >
                {b.label}
              </button>
            )
          })}
        </div>
      )}

      {entries.length === 0 ? (
        <p className="rounded-xl border border-border bg-card p-6 text-sm text-muted-foreground">
          No fishing trips recorded for this vessel yet. Fishing trips logged in
          Trips appear here automatically.
        </p>
      ) : (
        <div className="space-y-3">
          {entries.map((e) => (
            <FishingEntry key={e.tripId} entry={e} />
          ))}
        </div>
      )}
    </div>
  )
}

function FishingEntry({ entry }: { entry: FishingLogEntry }) {
  const [open, setOpen] = useState(entry.status === 'active')
  const retained = entry.catches.filter((c) => !c.released).length
  const released = entry.catches.filter((c) => c.released).length
  const protectedUnconfirmed = entry.protected.filter(
    (p) => !p.captainConfirmed,
  ).length

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left transition-colors hover:bg-muted"
      >
        <span className="min-w-0">
          <span className="flex items-center gap-2">
            <span className="font-serif text-lg text-foreground">
              {fmtDate(entry.startedAt)}
            </span>
            {entry.locked && (
              <Lock className="h-3.5 w-3.5 text-muted-foreground" />
            )}
            {protectedUnconfirmed > 0 && (
              <ShieldAlert className="h-4 w-4 text-[#b0203a]" />
            )}
          </span>
          <span className="mt-0.5 block text-xs text-muted-foreground">
            {entry.captainName ?? 'No captain'} · {entry.catches.length} catch
            {entry.catches.length === 1 ? '' : 'es'} ({retained} kept, {released}{' '}
            released) · {entry.activities.length} activit
            {entry.activities.length === 1 ? 'y' : 'ies'}
          </span>
        </span>
        <ChevronDown
          className={
            'h-4 w-4 shrink-0 text-muted-foreground transition-transform ' +
            (open ? 'rotate-180' : '')
          }
        />
      </button>

      {open && (
        <div className="space-y-6 border-t border-border px-5 py-5">
          {entry.locked && (
            <div className="rounded-lg border border-[#4f7a54]/40 bg-[#4f7a54]/10 px-3 py-2 text-xs text-[#4f7a54]">
              Approved by {entry.approvedBy}. This log is locked; corrections
              must be recorded with a reason through the audit trail.
            </div>
          )}

          <CatchesBlock entry={entry} />
          <ActivitiesBlock entry={entry} />
          <BycatchBlock entry={entry} />
          <ProtectedBlock entry={entry} />
          <LandingBlock entry={entry} />
          <TransshipmentBlock entry={entry} />

          {!entry.locked && <ApproveBlock entry={entry} />}
        </div>
      )}
    </div>
  )
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h4 className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
      {children}
    </h4>
  )
}

function CatchesBlock({ entry }: { entry: FishingLogEntry }) {
  return (
    <section className="space-y-2">
      <SectionTitle>Catches by species</SectionTitle>
      {entry.catches.length === 0 ? (
        <p className="text-sm text-muted-foreground">Zero catch recorded.</p>
      ) : (
        <div className="overflow-hidden rounded-lg border border-border">
          <table className="w-full text-sm">
            <tbody>
              {entry.catches.map((c) => (
                <tr key={c.id} className="border-b border-border last:border-0">
                  <td className="px-3 py-2 text-foreground">{c.species}</td>
                  <td className="px-3 py-2 text-muted-foreground">
                    {c.weightKg != null ? `${c.weightKg} kg` : '—'}
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">
                    {c.method ? fishingMethodLabel(c.method) : '—'}
                  </td>
                  <td className="px-3 py-2 text-right">
                    {c.released ? (
                      <span className="text-[#1f6f96]">Released</span>
                    ) : (
                      <span className="text-[#4f7a54]">Retained</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="text-[11px] text-muted-foreground">
        Retained catches are logged in Fishing / Captain Mode and shown here for
        the record.
      </p>
    </section>
  )
}

function ActivitiesBlock({ entry }: { entry: FishingLogEntry }) {
  const [pending, start] = useTransition()
  const [adding, setAdding] = useState(false)
  const [f, setF] = useState({
    startAt: '',
    endAt: '',
    zone: '',
    depthM: '',
    method: 'trolling',
    gear: '',
    lines: '',
    hooks: '',
    rods: '',
    trollingMinutes: '',
  })

  function save() {
    start(async () => {
      await addFishingActivity(
        entry.tripId,
        entry.boat,
        {
          startAt: f.startAt || null,
          endAt: f.endAt || null,
          zone: f.zone || null,
          depthM: f.depthM ? Number(f.depthM) : null,
          method: f.method,
          gear: f.gear || null,
          lines: f.lines ? Number(f.lines) : null,
          hooks: f.hooks ? Number(f.hooks) : null,
          rods: f.rods ? Number(f.rods) : null,
          trollingMinutes: f.trollingMinutes ? Number(f.trollingMinutes) : null,
        },
        CAPTAIN,
      )
      setAdding(false)
      setF({
        startAt: '',
        endAt: '',
        zone: '',
        depthM: '',
        method: 'trolling',
        gear: '',
        lines: '',
        hooks: '',
        rods: '',
        trollingMinutes: '',
      })
    })
  }

  return (
    <section className="space-y-2">
      <SectionTitle>Fishing effort &amp; activities</SectionTitle>
      {entry.activities.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No activity recorded yet.
        </p>
      ) : (
        <div className="space-y-2">
          {entry.activities.map((a) => (
            <div
              key={a.id}
              className="rounded-lg border border-border bg-background px-3 py-2 text-sm"
            >
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <span className="font-medium text-foreground">
                  {fishingMethodLabel(a.method)}
                </span>
                {a.zone && (
                  <span className="text-muted-foreground">{a.zone}</span>
                )}
                {a.depthM != null && (
                  <span className="text-muted-foreground">{a.depthM} m</span>
                )}
                {a.lat != null && a.lon != null && (
                  <span className="text-muted-foreground tabular-nums">
                    {a.lat.toFixed(4)}, {a.lon.toFixed(4)}
                  </span>
                )}
              </div>
              <div className="mt-1 flex flex-wrap gap-x-3 text-xs text-muted-foreground">
                {a.gear && <span>Gear: {a.gear}</span>}
                {a.lines != null && <span>{a.lines} lines</span>}
                {a.hooks != null && <span>{a.hooks} hooks</span>}
                {a.rods != null && <span>{a.rods} rods</span>}
                {a.trollingMinutes != null && (
                  <span>{a.trollingMinutes} min trolling</span>
                )}
              </div>
              {a.locationAmendedReason && (
                <p className="mt-1 text-[11px] text-[#8f6d3a]">
                  Location corrected: {a.locationAmendedReason} (original{' '}
                  {a.latOriginal?.toFixed(4)}, {a.lonOriginal?.toFixed(4)})
                </p>
              )}
            </div>
          ))}
        </div>
      )}

      {!entry.locked &&
        (adding ? (
          <div className="space-y-3 rounded-lg border border-border bg-background p-3">
            <div className="grid gap-3 sm:grid-cols-2">
              {field(
                'Start',
                <input
                  type="datetime-local"
                  className={inputCls}
                  value={f.startAt}
                  onChange={(e) => setF({ ...f, startAt: e.target.value })}
                />,
              )}
              {field(
                'End',
                <input
                  type="datetime-local"
                  className={inputCls}
                  value={f.endAt}
                  onChange={(e) => setF({ ...f, endAt: e.target.value })}
                />,
              )}
              {field(
                'Method',
                <select
                  className={inputCls}
                  value={f.method}
                  onChange={(e) => setF({ ...f, method: e.target.value })}
                >
                  {FISHING_METHODS.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.label}
                    </option>
                  ))}
                </select>,
              )}
              {field(
                'Gear',
                <input
                  className={inputCls}
                  value={f.gear}
                  onChange={(e) => setF({ ...f, gear: e.target.value })}
                />,
              )}
              {field(
                'Zone',
                <input
                  className={inputCls}
                  value={f.zone}
                  onChange={(e) => setF({ ...f, zone: e.target.value })}
                />,
              )}
              {field(
                'Depth (m)',
                <input
                  type="number"
                  className={inputCls}
                  value={f.depthM}
                  onChange={(e) => setF({ ...f, depthM: e.target.value })}
                />,
              )}
              {field(
                'Lines',
                <input
                  type="number"
                  className={inputCls}
                  value={f.lines}
                  onChange={(e) => setF({ ...f, lines: e.target.value })}
                />,
              )}
              {field(
                'Hooks',
                <input
                  type="number"
                  className={inputCls}
                  value={f.hooks}
                  onChange={(e) => setF({ ...f, hooks: e.target.value })}
                />,
              )}
              {field(
                'Rods',
                <input
                  type="number"
                  className={inputCls}
                  value={f.rods}
                  onChange={(e) => setF({ ...f, rods: e.target.value })}
                />,
              )}
              {field(
                'Trolling (min)',
                <input
                  type="number"
                  className={inputCls}
                  value={f.trollingMinutes}
                  onChange={(e) =>
                    setF({ ...f, trollingMinutes: e.target.value })
                  }
                />,
              )}
            </div>
            <div className="flex gap-2">
              <Button size="sm" onClick={save} disabled={pending}>
                {pending ? 'Saving…' : 'Save activity'}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setAdding(false)}
              >
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <Button
            size="sm"
            variant="outline"
            onClick={() => setAdding(true)}
            className="gap-1.5"
          >
            <Plus className="h-3.5 w-3.5" /> Add activity
          </Button>
        ))}
    </section>
  )
}

function BycatchBlock({ entry }: { entry: FishingLogEntry }) {
  const [pending, start] = useTransition()
  const [adding, setAdding] = useState<'bycatch' | 'discard' | null>(null)
  const [f, setF] = useState({
    species: '',
    faoCode: '',
    numberCount: '',
    weightKg: '',
    fate: 'released',
    discardReason: 'undersized',
    condition: '',
  })

  function reset() {
    setF({
      species: '',
      faoCode: '',
      numberCount: '',
      weightKg: '',
      fate: 'released',
      discardReason: 'undersized',
      condition: '',
    })
    setAdding(null)
  }

  function save(kind: 'bycatch' | 'discard') {
    if (!f.species.trim()) return
    start(async () => {
      await addBycatch(
        entry.tripId,
        entry.boat,
        {
          kind,
          species: f.species,
          faoCode: f.faoCode || null,
          numberCount: f.numberCount ? Number(f.numberCount) : null,
          weightKg: f.weightKg ? Number(f.weightKg) : null,
          fate: kind === 'bycatch' ? f.fate : null,
          discardReason: kind === 'discard' ? f.discardReason : null,
          condition: f.condition || null,
        },
        CAPTAIN,
      )
      reset()
    })
  }

  function remove(id: string) {
    start(async () => {
      await deleteBycatch(id)
    })
  }

  return (
    <section className="space-y-2">
      <SectionTitle>Bycatch &amp; discards</SectionTitle>
      {entry.bycatch.length === 0 ? (
        <p className="text-sm text-muted-foreground">None recorded.</p>
      ) : (
        <div className="space-y-2">
          {entry.bycatch.map((b) => (
            <div
              key={b.id}
              className="flex items-start justify-between gap-3 rounded-lg border border-border bg-background px-3 py-2 text-sm"
            >
              <div>
                <span className="font-medium text-foreground">{b.species}</span>
                <span className="ml-2 rounded border border-border px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
                  {b.kind}
                </span>
                <div className="mt-0.5 text-xs text-muted-foreground">
                  {b.numberCount != null && <span>{b.numberCount} fish · </span>}
                  {b.weightKg != null && <span>{b.weightKg} kg · </span>}
                  {b.kind === 'discard'
                    ? discardReasonLabel(b.discardReason)
                    : `${b.fate ?? '—'}${
                        b.condition ? ` (${b.condition})` : ''
                      }`}
                </div>
              </div>
              {!entry.locked && (
                <button
                  type="button"
                  onClick={() => remove(b.id)}
                  className="text-xs text-[#b0203a] hover:underline"
                >
                  Remove
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {!entry.locked &&
        (adding ? (
          <div className="space-y-3 rounded-lg border border-border bg-background p-3">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              New {adding}
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              {field(
                'Species',
                <input
                  className={inputCls}
                  value={f.species}
                  onChange={(e) => setF({ ...f, species: e.target.value })}
                />,
              )}
              {field(
                'FAO code',
                <input
                  className={inputCls}
                  value={f.faoCode}
                  onChange={(e) => setF({ ...f, faoCode: e.target.value })}
                />,
              )}
              {field(
                'Number',
                <input
                  type="number"
                  className={inputCls}
                  value={f.numberCount}
                  onChange={(e) => setF({ ...f, numberCount: e.target.value })}
                />,
              )}
              {field(
                'Weight (kg)',
                <input
                  type="number"
                  className={inputCls}
                  value={f.weightKg}
                  onChange={(e) => setF({ ...f, weightKg: e.target.value })}
                />,
              )}
              {adding === 'bycatch'
                ? field(
                    'Fate',
                    <select
                      className={inputCls}
                      value={f.fate}
                      onChange={(e) => setF({ ...f, fate: e.target.value })}
                    >
                      <option value="released">Released</option>
                      <option value="retained">Retained</option>
                    </select>,
                  )
                : field(
                    'Reason',
                    <select
                      className={inputCls}
                      value={f.discardReason}
                      onChange={(e) =>
                        setF({ ...f, discardReason: e.target.value })
                      }
                    >
                      {DISCARD_REASONS.map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.label}
                        </option>
                      ))}
                    </select>,
                  )}
              {adding === 'bycatch' &&
                field(
                  'Condition at release',
                  <input
                    className={inputCls}
                    value={f.condition}
                    onChange={(e) => setF({ ...f, condition: e.target.value })}
                  />,
                )}
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                onClick={() => save(adding)}
                disabled={pending || !f.species.trim()}
              >
                {pending ? 'Saving…' : `Save ${adding}`}
              </Button>
              <Button size="sm" variant="ghost" onClick={reset}>
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => setAdding('bycatch')}
              className="gap-1.5"
            >
              <Plus className="h-3.5 w-3.5" /> Bycatch
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setAdding('discard')}
              className="gap-1.5"
            >
              <Plus className="h-3.5 w-3.5" /> Discard
            </Button>
          </div>
        ))}
    </section>
  )
}

function ProtectedBlock({ entry }: { entry: FishingLogEntry }) {
  const [pending, start] = useTransition()
  const [adding, setAdding] = useState(false)
  const [f, setF] = useState({
    species: '',
    at: '',
    interactionType: 'accidental-catch',
    outcome: 'released',
    condition: '',
    notes: '',
  })

  function save() {
    if (!f.species.trim()) return
    start(async () => {
      await addProtectedIncident(
        entry.tripId,
        entry.boat,
        {
          species: f.species,
          at: f.at || null,
          interactionType: f.interactionType,
          outcome: f.outcome,
          condition: f.condition || null,
          notes: f.notes || null,
        },
        CAPTAIN,
      )
      setAdding(false)
      setF({
        species: '',
        at: '',
        interactionType: 'accidental-catch',
        outcome: 'released',
        condition: '',
        notes: '',
      })
    })
  }

  function confirm(id: string) {
    start(async () => {
      await confirmProtectedIncident(id, CAPTAIN)
    })
  }

  return (
    <section className="space-y-2">
      <SectionTitle>Protected / sensitive species</SectionTitle>
      {entry.protected.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No protected-species interactions recorded.
        </p>
      ) : (
        <div className="space-y-2">
          {entry.protected.map((p) => (
            <div
              key={p.id}
              className={
                'rounded-lg border px-3 py-2 text-sm ' +
                (p.captainConfirmed
                  ? 'border-border bg-background'
                  : 'border-[#b0203a]/40 bg-[#b0203a]/[0.06]')
              }
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium text-foreground">{p.species}</span>
                {p.captainConfirmed ? (
                  <span className="text-xs text-[#4f7a54]">
                    Confirmed by {p.confirmedBy}
                  </span>
                ) : (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => confirm(p.id)}
                    disabled={pending}
                  >
                    Captain confirm
                  </Button>
                )}
              </div>
              <div className="mt-0.5 text-xs text-muted-foreground">
                {PROTECTED_INTERACTIONS.find(
                  (i) => i.id === p.interactionType,
                )?.label ?? p.interactionType}{' '}
                · {PROTECTED_OUTCOMES.find((o) => o.id === p.outcome)?.label ??
                  p.outcome}
                {p.condition ? ` · ${p.condition}` : ''}
              </div>
              {p.notes && (
                <p className="mt-1 text-xs text-muted-foreground">{p.notes}</p>
              )}
            </div>
          ))}
        </div>
      )}

      {adding ? (
        <div className="space-y-3 rounded-lg border border-[#b0203a]/30 bg-background p-3">
          <div className="grid gap-3 sm:grid-cols-2">
            {field(
              'Species',
              <input
                className={inputCls}
                value={f.species}
                onChange={(e) => setF({ ...f, species: e.target.value })}
              />,
            )}
            {field(
              'Date & time',
              <input
                type="datetime-local"
                className={inputCls}
                value={f.at}
                onChange={(e) => setF({ ...f, at: e.target.value })}
              />,
            )}
            {field(
              'Interaction',
              <select
                className={inputCls}
                value={f.interactionType}
                onChange={(e) =>
                  setF({ ...f, interactionType: e.target.value })
                }
              >
                {PROTECTED_INTERACTIONS.map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.label}
                  </option>
                ))}
              </select>,
            )}
            {field(
              'Outcome',
              <select
                className={inputCls}
                value={f.outcome}
                onChange={(e) => setF({ ...f, outcome: e.target.value })}
              >
                {PROTECTED_OUTCOMES.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.label}
                  </option>
                ))}
              </select>,
            )}
            {field(
              'Condition',
              <input
                className={inputCls}
                value={f.condition}
                onChange={(e) => setF({ ...f, condition: e.target.value })}
              />,
            )}
          </div>
          {field(
            'Notes',
            <textarea
              className={inputCls}
              rows={2}
              value={f.notes}
              onChange={(e) => setF({ ...f, notes: e.target.value })}
            />,
          )}
          <div className="flex gap-2">
            <Button
              size="sm"
              onClick={save}
              disabled={pending || !f.species.trim()}
            >
              {pending ? 'Saving…' : 'Record incident'}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setAdding(false)}>
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <Button
          size="sm"
          variant="outline"
          onClick={() => setAdding(true)}
          className="gap-1.5"
        >
          <ShieldAlert className="h-3.5 w-3.5" /> Record interaction
        </Button>
      )}
    </section>
  )
}

function LandingBlock({ entry }: { entry: FishingLogEntry }) {
  const [pending, start] = useTransition()
  const l = entry.log
  const [f, setF] = useState({
    landingDate: l?.landingDate ?? '',
    landingTime: l?.landingTime ?? '',
    landingLocation: l?.landingLocation ?? '',
    landingRecipient: l?.landingRecipient ?? '',
    landingStorage: l?.landingStorage ?? '',
    landingSale: l?.landingSale ?? '',
    authorizationNumber: l?.authorizationNumber ?? '',
    landingNotes: l?.landingNotes ?? '',
  })

  function save() {
    start(async () => {
      await saveLandingRecord(entry.tripId, entry.boat, {
        landingDate: f.landingDate || null,
        landingTime: f.landingTime || null,
        landingLocation: f.landingLocation || null,
        landingRecipient: f.landingRecipient || null,
        landingStorage: f.landingStorage || null,
        landingSale: f.landingSale || null,
        authorizationNumber: f.authorizationNumber || null,
        landingNotes: f.landingNotes || null,
      })
    })
  }

  return (
    <section className="space-y-2">
      <SectionTitle>Landing / débarquement</SectionTitle>
      <div className="grid gap-3 sm:grid-cols-2">
        {field(
          'Landing date',
          <input
            type="date"
            className={inputCls}
            disabled={entry.locked}
            value={f.landingDate}
            onChange={(e) => setF({ ...f, landingDate: e.target.value })}
          />,
        )}
        {field(
          'Landing time',
          <input
            type="time"
            className={inputCls}
            disabled={entry.locked}
            value={f.landingTime}
            onChange={(e) => setF({ ...f, landingTime: e.target.value })}
          />,
        )}
        {field(
          'Landing location',
          <input
            className={inputCls}
            disabled={entry.locked}
            value={f.landingLocation}
            onChange={(e) => setF({ ...f, landingLocation: e.target.value })}
          />,
        )}
        {field(
          'Fishing authorization no.',
          <input
            className={inputCls}
            disabled={entry.locked}
            value={f.authorizationNumber}
            onChange={(e) =>
              setF({ ...f, authorizationNumber: e.target.value })
            }
          />,
        )}
        {field(
          'Recipient / customer',
          <input
            className={inputCls}
            disabled={entry.locked}
            value={f.landingRecipient}
            onChange={(e) => setF({ ...f, landingRecipient: e.target.value })}
          />,
        )}
        {field(
          'Storage destination',
          <input
            className={inputCls}
            disabled={entry.locked}
            value={f.landingStorage}
            onChange={(e) => setF({ ...f, landingStorage: e.target.value })}
          />,
        )}
        {field(
          'Sale / non-sale',
          <select
            className={inputCls}
            disabled={entry.locked}
            value={f.landingSale}
            onChange={(e) => setF({ ...f, landingSale: e.target.value })}
          >
            <option value="">—</option>
            <option value="sale">Sale</option>
            <option value="non-sale">Non-sale</option>
          </select>,
        )}
      </div>
      {!entry.locked && (
        <Button size="sm" onClick={save} disabled={pending}>
          {pending ? 'Saving…' : 'Save landing record'}
        </Button>
      )}
    </section>
  )
}

function TransshipmentBlock({ entry }: { entry: FishingLogEntry }) {
  const [pending, start] = useTransition()
  const [open, setOpen] = useState(false)
  const [ack, setAck] = useState(false)
  const l = entry.log
  const [f, setF] = useState({
    authorization: '',
    vessel: '',
    at: '',
    details: '',
  })

  const recorded = l?.transshipment

  function save() {
    if (!ack || !f.authorization.trim()) return
    start(async () => {
      await recordTransshipment(
        entry.tripId,
        entry.boat,
        {
          authorization: f.authorization,
          vessel: f.vessel || null,
          at: f.at || null,
          details: f.details || null,
          approvedBy: CAPTAIN,
        },
        true,
      )
      setOpen(false)
      setAck(false)
    })
  }

  return (
    <section className="space-y-2">
      <SectionTitle>Transshipment</SectionTitle>
      {recorded ? (
        <div className="rounded-lg border border-[#b0203a]/40 bg-[#b0203a]/[0.06] px-3 py-2 text-sm">
          <p className="font-medium text-[#b0203a]">Transshipment recorded</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Authorization: {l?.transshipmentAuthorization ?? '—'} · Vessel:{' '}
            {l?.transshipmentVessel ?? '—'} · Approved by{' '}
            {l?.transshipmentApprovedBy ?? '—'}
          </p>
        </div>
      ) : (
        <p className="rounded-lg border border-border bg-background px-3 py-2 text-sm font-medium text-[#4f7a54]">
          NO TRANSSHIPMENT
        </p>
      )}

      {!recorded &&
        !entry.locked &&
        (open ? (
          <div className="space-y-3 rounded-lg border border-[#b0203a]/40 bg-[#b0203a]/[0.06] p-3">
            <div className="flex gap-2 text-[#b0203a]">
              <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
              <p className="text-xs">
                <span className="font-semibold">WARNING — </span>
                {TRANSSHIPMENT_WARNING}
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {field(
                'Authorization / reference',
                <input
                  className={inputCls}
                  value={f.authorization}
                  onChange={(e) =>
                    setF({ ...f, authorization: e.target.value })
                  }
                />,
              )}
              {field(
                'Vessel involved',
                <input
                  className={inputCls}
                  value={f.vessel}
                  onChange={(e) => setF({ ...f, vessel: e.target.value })}
                />,
              )}
              {field(
                'Date & time',
                <input
                  type="datetime-local"
                  className={inputCls}
                  value={f.at}
                  onChange={(e) => setF({ ...f, at: e.target.value })}
                />,
              )}
            </div>
            {field(
              'Details (species, quantity)',
              <textarea
                className={inputCls}
                rows={2}
                value={f.details}
                onChange={(e) => setF({ ...f, details: e.target.value })}
              />,
            )}
            <label className="flex items-start gap-2 text-xs text-foreground">
              <input
                type="checkbox"
                className="mt-0.5"
                checked={ack}
                onChange={(e) => setAck(e.target.checked)}
              />
              <span>
                I confirm legal authorization has been verified and I am
                authorized to record this transshipment.
              </span>
            </label>
            <div className="flex gap-2">
              <Button
                size="sm"
                onClick={save}
                disabled={pending || !ack || !f.authorization.trim()}
              >
                {pending ? 'Saving…' : 'Record transshipment'}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setOpen(false)
                  setAck(false)
                }}
              >
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <Button
            size="sm"
            variant="outline"
            onClick={() => setOpen(true)}
            className="gap-1.5 text-[#b0203a]"
          >
            <TriangleAlert className="h-3.5 w-3.5" /> Record transshipment
          </Button>
        ))}
    </section>
  )
}

function ApproveBlock({ entry }: { entry: FishingLogEntry }) {
  const [pending, start] = useTransition()
  const [ack, setAck] = useState(false)
  const unconfirmed = entry.protected.filter((p) => !p.captainConfirmed).length

  function approve() {
    start(async () => {
      await approveFishingLog(entry.tripId, entry.boat, CAPTAIN)
    })
  }

  return (
    <section className="space-y-2 border-t border-border pt-4">
      <SectionTitle>Captain review</SectionTitle>
      {unconfirmed > 0 && (
        <p className="flex items-center gap-1.5 text-xs text-[#b0203a]">
          <ShieldAlert className="h-3.5 w-3.5" />
          {unconfirmed} protected-species interaction
          {unconfirmed === 1 ? '' : 's'} still need captain confirmation.
        </p>
      )}
      <label className="flex items-start gap-2 text-sm text-foreground">
        <input
          type="checkbox"
          className="mt-0.5"
          checked={ack}
          onChange={(e) => setAck(e.target.checked)}
        />
        <span>
          I confirm this fishing log is complete and accurate for the record.
        </span>
      </label>
      <Button
        size="sm"
        onClick={approve}
        disabled={pending || !ack || unconfirmed > 0}
        className="gap-1.5"
      >
        <Lock className="h-3.5 w-3.5" />
        {pending ? 'Locking…' : 'Approve & lock'}
      </Button>
    </section>
  )
}
