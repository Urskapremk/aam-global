'use client'

import {
  AlertTriangle,
  Check,
  ClipboardList,
  Gauge,
  Loader2,
  Plus,
  Wrench,
  X,
} from 'lucide-react'
import { useState } from 'react'
import useSWR from 'swr'

import {
  getMaintenance,
  logWork,
  saveTask,
  setEngineHours,
  type EngineRow,
  type TaskRow,
} from '@/app/actions/maintenance'
import { BOATS } from '@/lib/boats'
import { DUE_TONE, fmtHours, type DueState } from '@/lib/maintenance'

const dateFmt = (iso: string | null) =>
  iso
    ? new Date(iso).toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      })
    : '—'

function StateBadge({ state, text }: { state: DueState; text?: string }) {
  const tone = DUE_TONE[state]
  return (
    <span
      className="inline-flex flex-shrink-0 items-center rounded-full border px-2.5 py-1 text-[9px] font-semibold uppercase tracking-[0.14em]"
      style={{
        color: tone.fg,
        backgroundColor: tone.bg,
        borderColor: tone.border,
      }}
    >
      {text ?? tone.label}
    </span>
  )
}

export function MaintenanceTab() {
  const data = useSWR('maintenance', () => getMaintenance(), {
    refreshInterval: 120000,
    revalidateOnFocus: true,
  })

  const [hoursFor, setHoursFor] = useState<string | null>(null)
  const [logFor, setLogFor] = useState<TaskRow | null>(null)
  const [addingTask, setAddingTask] = useState(false)
  const [boatFilter, setBoatFilter] = useState<string>('all')

  const d = data.data
  const engines = d?.engines ?? []
  const tasks = (d?.tasks ?? []).filter(
    (t) => boatFilter === 'all' || t.boat === boatFilter,
  )

  // Sorted worst-first: the point of this page is that the thing about to
  // break is the first thing read, not buried under twenty healthy rows.
  const rank: DueState[] = ['overdue', 'due', 'soon', 'unknown', 'ok']
  const sorted = [...tasks].sort((a, b) => {
    const r = rank.indexOf(a.state) - rank.indexOf(b.state)
    if (r !== 0) return r
    return (a.hoursLeft ?? a.daysLeft ?? 0) - (b.hoursLeft ?? b.daysLeft ?? 0)
  })

  const attention = sorted.filter(
    (t) => t.state === 'overdue' || t.state === 'due',
  )
  const noBaseline = engines.filter((e) => e.hoursAt == null)

  return (
    <section className="overflow-hidden rounded-2xl border border-border bg-card">
      <header className="flex flex-wrap items-center justify-between gap-4 bg-panel-header p-5">
        <div>
          <p className="text-[10px] uppercase tracking-[0.22em] text-panel-header-foreground/40">
            Maintenance
          </p>
          <h2 className="mt-1 font-serif text-xl text-panel-header-foreground">
            Service schedule
          </h2>
        </div>
        <div className="flex items-center gap-2">
          {d && <StateBadge state={d.worst} />}
          <button
            type="button"
            onClick={() => setAddingTask((v) => !v)}
            className="flex min-h-11 cursor-pointer items-center gap-1.5 rounded-full border border-panel-header-foreground/25 px-4 text-[10px] font-semibold uppercase tracking-[0.14em] text-panel-header-foreground/80 transition-colors hover:bg-panel-header-hover"
          >
            <Plus className="h-3.5 w-3.5" aria-hidden />
            Task
          </button>
        </div>
      </header>

      <div className="space-y-6 p-5">
        {data.isLoading && (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            Reading the schedule…
          </p>
        )}

        {data.error && (
          <p className="text-sm" style={{ color: DUE_TONE.overdue.fg }}>
            Could not load the schedule.
          </p>
        )}

        {/* The baseline warning comes first and is unmissable: until an engine
            has a real hour-meter reading, every hour-based interval on it is
            guesswork, and a schedule nobody can trust is worse than none. */}
        {noBaseline.length > 0 && (
          <div
            className="rounded-xl border p-4"
            style={{
              borderColor: DUE_TONE.due.border,
              backgroundColor: DUE_TONE.due.bg,
            }}
          >
            <p
              className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em]"
              style={{ color: DUE_TONE.due.fg }}
            >
              <AlertTriangle className="h-4 w-4" aria-hidden />
              {noBaseline.length === 1
                ? 'One engine has no hour reading'
                : `${noBaseline.length} engines have no hour reading`}
            </p>
            <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
              Read the hour meter on{' '}
              {noBaseline.map((e) => `${e.boatLabel} ${e.label}`).join(', ')} and
              enter it below. These boats ran for years before this app existed,
              so hour-based intervals stay blank until someone types in what the
              meter actually says.
            </p>
          </div>
        )}

        {attention.length > 0 && (
          <div>
            <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
              Needs attention
            </p>
            <div className="mt-3 space-y-2">
              {attention.map((t) => (
                <div
                  key={t.id}
                  className="flex flex-wrap items-center gap-3 rounded-xl border p-4"
                  style={{
                    borderColor: DUE_TONE[t.state].border,
                    backgroundColor: DUE_TONE[t.state].bg,
                  }}
                >
                  <StateBadge state={t.state} />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-foreground">
                      {t.name}
                    </p>
                    <p className="mt-0.5 text-[11px] text-muted-foreground">
                      {t.boatLabel}
                      {t.engineLabel ? ` · ${t.engineLabel}` : ''} ·{' '}
                      {t.assumed && t.state !== 'unknown' ? '~' : ''}
                      {t.summary}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setLogFor(t)}
                    className="flex min-h-11 flex-shrink-0 cursor-pointer items-center gap-1.5 rounded-full border border-border bg-card px-4 text-[10px] font-semibold uppercase tracking-[0.14em] text-foreground transition-colors hover:bg-secondary"
                  >
                    <Check className="h-3.5 w-3.5" aria-hidden />
                    Log done
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Engines --------------------------------------------------------- */}
        {engines.length > 0 && (
          <div>
            <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
              Engine hours
            </p>
            <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {engines.map((e) => (
                <EngineCard
                  key={e.id}
                  engine={e}
                  open={hoursFor === e.id}
                  onToggle={() => setHoursFor(hoursFor === e.id ? null : e.id)}
                  onSaved={() => {
                    setHoursFor(null)
                    data.mutate()
                  }}
                />
              ))}
            </div>
          </div>
        )}

        {/* Task list ------------------------------------------------------- */}
        <div>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
              All tasks
            </p>
            <div className="flex flex-wrap gap-2">
              {[{ id: 'all', label: 'Both boats' }, ...BOATS.map((b) => ({ id: b.id, label: b.name }))].map(
                (b) => (
                  <button
                    key={b.id}
                    type="button"
                    onClick={() => setBoatFilter(b.id)}
                    aria-pressed={boatFilter === b.id}
                    className={`min-h-11 cursor-pointer rounded-full border px-4 text-[10px] font-semibold uppercase tracking-[0.14em] transition-colors ${
                      boatFilter === b.id
                        ? 'border-accent bg-accent/15 text-accent'
                        : 'border-border bg-secondary/60 text-muted-foreground hover:bg-secondary'
                    }`}
                  >
                    {b.label}
                  </button>
                ),
              )}
            </div>
          </div>

          {addingTask && (
            <TaskForm
              onDone={() => {
                setAddingTask(false)
                data.mutate()
              }}
              onCancel={() => setAddingTask(false)}
              engines={engines}
            />
          )}

          <div className="mt-3 divide-y divide-border overflow-hidden rounded-xl border border-border">
            {sorted.length === 0 && !data.isLoading && (
              <p className="p-4 text-sm text-muted-foreground">
                No tasks for this boat yet.
              </p>
            )}
            {sorted.map((t) => (
              <div
                key={t.id}
                className="flex flex-wrap items-center gap-3 p-4 transition-colors hover:bg-secondary/40"
              >
                <StateBadge state={t.state} />
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-foreground">{t.name}</p>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">
                    {t.boatLabel}
                    {t.engineLabel ? ` · ${t.engineLabel}` : ''}
                    {' · '}
                    {t.intervalHours != null && `every ${t.intervalHours} h`}
                    {t.intervalHours != null && t.intervalDays != null && ' or '}
                    {t.intervalDays != null &&
                      `every ${
                        t.intervalDays % 365 === 0
                          ? `${t.intervalDays / 365} year${t.intervalDays > 365 ? 's' : ''}`
                          : `${t.intervalDays} days`
                      }`}
                  </p>
                </div>
                <div className="text-right">
                  <p
                    className="text-xs font-medium tabular-nums"
                    style={{ color: DUE_TONE[t.state].fg }}
                    // A tilde means "estimated", the same as everywhere else in
                    // these apps. Without it a countdown measured from the
                    // baseline instead of real work reads as a hard fact — and
                    // an engine already past its oil change before this app
                    // existed would look reassuringly green.
                    title={
                      t.assumed && t.state !== 'unknown'
                        ? 'Estimated: no service has been logged yet, so this counts from the meter reading, not from real work. Log one to make it exact.'
                        : undefined
                    }
                  >
                    {t.assumed && t.state !== 'unknown' ? '~' : ''}
                    {t.summary}
                  </p>
                  <p className="mt-0.5 text-[10px] text-muted-foreground">
                    {t.lastDoneAt
                      ? `Last done ${dateFmt(t.lastDoneAt)}`
                      : 'Never logged'}
                    {/* Saying so matters: an estimate can be out by a few hours
                        and the reader has to know which number is measured. */}
                    {t.estimatedHours && t.intervalHours != null && ' · est.'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setLogFor(t)}
                  className="flex min-h-11 flex-shrink-0 cursor-pointer items-center gap-1.5 rounded-full border border-border px-4 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground transition-colors hover:bg-secondary"
                >
                  <Wrench className="h-3.5 w-3.5" aria-hidden />
                  Log
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* History -------------------------------------------------------- */}
        {(d?.log?.length ?? 0) > 0 && (
          <div>
            <p className="flex items-center gap-2 text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
              <ClipboardList className="h-3.5 w-3.5" aria-hidden />
              Work history
            </p>
            <div className="mt-3 divide-y divide-border overflow-hidden rounded-xl border border-border">
              {(d?.log ?? []).map((l) => (
                <div key={l.id} className="flex flex-wrap gap-3 p-4">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-foreground">{l.name}</p>
                    <p className="mt-0.5 text-[11px] text-muted-foreground">
                      {l.boatLabel}
                      {l.engineLabel ? ` · ${l.engineLabel}` : ''} ·{' '}
                      {dateFmt(l.doneAt)}
                      {l.atHours != null && ` · at ${fmtHours(l.atHours)}`}
                      {l.doneBy && ` · ${l.doneBy}`}
                    </p>
                    {l.partsUsed && (
                      <p className="mt-1 text-[11px] text-muted-foreground/80">
                        {l.partsUsed}
                      </p>
                    )}
                  </div>
                  {l.costAr != null && (
                    <p className="text-xs tabular-nums text-muted-foreground">
                      {l.costAr.toLocaleString('fr-FR')} Ar
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        <p className="text-[11px] leading-relaxed text-muted-foreground">
          Hours come from the last meter reading plus the running time of trips
          logged since. Where a trip recorded its own meter readings those are
          used instead. Intervals with both an hour and a calendar figure fall
          due on whichever arrives first. A tilde marks a countdown measured from
          the meter reading because no service has been logged for that job yet —
          log one and it becomes exact.
        </p>
      </div>

      {logFor && (
        <LogWorkDialog
          task={logFor}
          onClose={() => setLogFor(null)}
          onDone={() => {
            setLogFor(null)
            data.mutate()
          }}
        />
      )}
    </section>
  )
}

function EngineCard({
  engine,
  open,
  onToggle,
  onSaved,
}: {
  engine: EngineRow
  open: boolean
  onToggle: () => void
  onSaved: () => void
}) {
  const [value, setValue] = useState(
    engine.hoursAt != null ? String(engine.hoursAt) : '',
  )
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const save = async () => {
    const n = Number(value.replace(',', '.'))
    if (!Number.isFinite(n) || n < 0) {
      setErr('Enter the number on the meter')
      return
    }
    setBusy(true)
    setErr(null)
    try {
      await setEngineHours(engine.id, n)
      onSaved()
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Could not save')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="rounded-xl border border-border bg-secondary/30 p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
            {engine.boatLabel}
          </p>
          <p className="mt-0.5 text-sm font-medium text-foreground">
            {engine.label}
            {engine.hp ? ` · ${engine.hp} hp` : ''}
          </p>
        </div>
        <StateBadge state={engine.worst} />
      </div>

      <p className="mt-3 font-serif text-2xl tabular-nums text-foreground">
        {engine.hours != null ? fmtHours(engine.hours) : '—'}
      </p>
      <p className="text-[10px] text-muted-foreground">
        {engine.hoursAt == null
          ? 'No meter reading yet'
          : engine.estimated
            ? `${fmtHours(engine.hoursAt)} read ${dateFmt(engine.readAt)} + ${fmtHours(engine.sinceHours)} estimated`
            : `Read ${dateFmt(engine.readAt)}`}
      </p>

      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="mt-3 flex min-h-11 w-full cursor-pointer items-center justify-center gap-1.5 rounded-full border border-border px-4 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground transition-colors hover:bg-secondary"
      >
        <Gauge className="h-3.5 w-3.5" aria-hidden />
        {open ? 'Cancel' : 'Enter meter reading'}
      </button>

      {open && (
        <div className="mt-3">
          <label className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
            Hours on the meter now
          </label>
          <div className="mt-1.5 flex gap-2">
            <input
              type="text"
              inputMode="decimal"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder="1284.5"
              className="min-h-11 min-w-0 flex-1 rounded-lg border border-border bg-card px-3 text-sm text-foreground"
            />
            <button
              type="button"
              onClick={save}
              disabled={busy}
              className="flex min-h-11 flex-shrink-0 cursor-pointer items-center gap-1.5 rounded-full bg-accent px-4 text-[10px] font-semibold uppercase tracking-[0.14em] text-accent-foreground disabled:opacity-60"
            >
              {busy ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
              ) : (
                <Check className="h-3.5 w-3.5" aria-hidden />
              )}
              Save
            </button>
          </div>
          {err && (
            <p className="mt-1.5 text-[11px]" style={{ color: DUE_TONE.overdue.fg }}>
              {err}
            </p>
          )}
        </div>
      )}
    </div>
  )
}

function TaskForm({
  engines,
  onDone,
  onCancel,
}: {
  engines: EngineRow[]
  onDone: () => void
  onCancel: () => void
}) {
  const [name, setName] = useState('')
  const [boat, setBoat] = useState<string>(BOATS[0]?.id ?? 'odyssey')
  const [engineId, setEngineId] = useState('')
  const [hours, setHours] = useState('')
  const [days, setDays] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const submit = async () => {
    setBusy(true)
    setErr(null)
    try {
      await saveTask({
        boat,
        engineId: engineId || null,
        name,
        intervalHours: hours ? Number(hours.replace(',', '.')) : null,
        intervalDays: days ? Number(days) : null,
      })
      onDone()
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Could not save')
    } finally {
      setBusy(false)
    }
  }

  const mine = engines.filter((e) => e.boat === boat)

  return (
    <div className="mt-3 rounded-xl border border-border bg-secondary/30 p-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
            What needs doing
          </label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Propeller inspection"
            className="mt-1.5 min-h-11 w-full rounded-lg border border-border bg-card px-3 text-sm text-foreground"
          />
        </div>
        <div>
          <label className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
            Boat
          </label>
          <select
            value={boat}
            onChange={(e) => {
              setBoat(e.target.value)
              setEngineId('')
            }}
            className="mt-1.5 min-h-11 w-full rounded-lg border border-border bg-card px-3 text-sm text-foreground"
          >
            {BOATS.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
            Engine
          </label>
          <select
            value={engineId}
            onChange={(e) => setEngineId(e.target.value)}
            className="mt-1.5 min-h-11 w-full rounded-lg border border-border bg-card px-3 text-sm text-foreground"
          >
            <option value="">Whole boat</option>
            {mine.map((e) => (
              <option key={e.id} value={e.id}>
                {e.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
            Every … hours
          </label>
          <input
            type="text"
            inputMode="decimal"
            value={hours}
            onChange={(e) => setHours(e.target.value)}
            placeholder="100"
            className="mt-1.5 min-h-11 w-full rounded-lg border border-border bg-card px-3 text-sm text-foreground"
          />
        </div>
        <div>
          <label className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
            … or every … days
          </label>
          <input
            type="text"
            inputMode="numeric"
            value={days}
            onChange={(e) => setDays(e.target.value)}
            placeholder="365"
            className="mt-1.5 min-h-11 w-full rounded-lg border border-border bg-card px-3 text-sm text-foreground"
          />
        </div>
      </div>

      <p className="mt-2 text-[11px] text-muted-foreground">
        Fill in one or both. With both, the job comes due on whichever arrives
        first — hours for a busy engine, the calendar for one that sits idle.
      </p>

      {err && (
        <p className="mt-2 text-[11px]" style={{ color: DUE_TONE.overdue.fg }}>
          {err}
        </p>
      )}

      <div className="mt-3 flex gap-2">
        <button
          type="button"
          onClick={submit}
          disabled={busy || !name.trim()}
          className="flex min-h-11 cursor-pointer items-center gap-1.5 rounded-full bg-accent px-5 text-[10px] font-semibold uppercase tracking-[0.14em] text-accent-foreground disabled:opacity-50"
        >
          {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />}
          Save task
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="min-h-11 cursor-pointer rounded-full border border-border px-5 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground"
        >
          Cancel
        </button>
      </div>
    </div>
  )
}

function LogWorkDialog({
  task,
  onClose,
  onDone,
}: {
  task: TaskRow
  onClose: () => void
  onDone: () => void
}) {
  const [atHours, setAtHours] = useState(
    task.currentHours != null ? String(Math.round(task.currentHours * 10) / 10) : '',
  )
  const [cost, setCost] = useState('')
  const [parts, setParts] = useState('')
  const [by, setBy] = useState('')
  const [notes, setNotes] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const submit = async () => {
    setBusy(true)
    setErr(null)
    try {
      await logWork({
        taskId: task.id,
        boat: task.boat,
        engineId: task.engineId,
        atHours: atHours ? Number(atHours.replace(',', '.')) : null,
        costAr: cost ? Number(cost.replace(/[^\d.]/g, '')) : null,
        partsUsed: parts || null,
        doneBy: by || null,
        notes: notes || null,
      })
      onDone()
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Could not save')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4 sm:items-center">
      <div className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-border bg-card">
        <header className="flex items-start justify-between gap-3 border-b border-border p-5">
          <div>
            <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
              Log completed work
            </p>
            <h3 className="mt-1 font-serif text-lg text-foreground">
              {task.name}
            </h3>
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              {task.boatLabel}
              {task.engineLabel ? ` · ${task.engineLabel}` : ''}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex h-11 w-11 flex-shrink-0 cursor-pointer items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-secondary"
          >
            <X className="h-4 w-4" aria-hidden />
          </button>
        </header>

        <div className="space-y-3 p-5">
          {task.intervalHours != null && (
            <div>
              <label className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                Hours on the meter
              </label>
              <input
                type="text"
                inputMode="decimal"
                value={atHours}
                onChange={(e) => setAtHours(e.target.value)}
                className="mt-1.5 min-h-11 w-full rounded-lg border border-border bg-card px-3 text-sm text-foreground"
              />
              <p className="mt-1 text-[10px] text-muted-foreground">
                {task.estimatedHours
                  ? 'Pre-filled from the estimate — correct it to what the meter says.'
                  : 'The next interval is measured from this number.'}
              </p>
            </div>
          )}

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                Cost (Ar)
              </label>
              <input
                type="text"
                inputMode="numeric"
                value={cost}
                onChange={(e) => setCost(e.target.value)}
                placeholder="180000"
                className="mt-1.5 min-h-11 w-full rounded-lg border border-border bg-card px-3 text-sm text-foreground"
              />
            </div>
            <div>
              <label className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                Done by
              </label>
              <input
                value={by}
                onChange={(e) => setBy(e.target.value)}
                placeholder="Mike / workshop"
                className="mt-1.5 min-h-11 w-full rounded-lg border border-border bg-card px-3 text-sm text-foreground"
              />
            </div>
          </div>

          <div>
            <label className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
              Parts used
            </label>
            <input
              value={parts}
              onChange={(e) => setParts(e.target.value)}
              placeholder="2× oil filter, 4 L 10W-40"
              className="mt-1.5 min-h-11 w-full rounded-lg border border-border bg-card px-3 text-sm text-foreground"
            />
          </div>

          <div>
            <label className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
              Notes
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className="mt-1.5 w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground"
            />
          </div>

          {err && (
            <p className="text-[11px]" style={{ color: DUE_TONE.overdue.fg }}>
              {err}
            </p>
          )}

          <button
            type="button"
            onClick={submit}
            disabled={busy}
            className="flex min-h-11 w-full cursor-pointer items-center justify-center gap-2 rounded-full bg-accent text-[10px] font-semibold uppercase tracking-[0.14em] text-accent-foreground disabled:opacity-60"
          >
            {busy ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            ) : (
              <Check className="h-4 w-4" aria-hidden />
            )}
            Save as done
          </button>
        </div>
      </div>
    </div>
  )
}
