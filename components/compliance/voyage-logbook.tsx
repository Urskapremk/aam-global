'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  ChevronDown,
  Lock,
  Plus,
  ShieldCheck,
  TriangleAlert,
} from 'lucide-react'

import {
  VOYAGE_EVENT_TYPES,
  voyageEventLabel,
  voyagePurposeLabel,
  OFFICIAL_STATUS_LABEL,
  type OfficialStatus,
  UNSCHEDULED_REASONS,
  NOTIFY_AUTHORITIES,
  personsOnBoard,
} from '@/lib/compliance'
import {
  addVoyageEvent,
  approveVoyageLog,
  recordUnscheduledEntry,
  saveOfficialValidation,
  saveVoyageLog,
  type VoyageLogRow,
} from '@/app/actions/voyage-log'

function fmtDateTime(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Indian/Antananarivo',
  })
}

function fmtGps(lat: number | null, lon: number | null): string {
  if (lat == null || lon == null) return '—'
  return `${lat.toFixed(4)}, ${lon.toFixed(4)}`
}

export function VoyageLogbook({
  boats,
  logsByBoat,
}: {
  boats: { boat: string; label: string }[]
  logsByBoat: Record<string, VoyageLogRow[]>
}) {
  const [activeBoat, setActiveBoat] = useState(boats[0]?.boat ?? '')
  const rows = logsByBoat[activeBoat] ?? []

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap gap-2">
        {boats.map((b) => {
          const on = b.boat === activeBoat
          return (
            <button
              key={b.boat}
              type="button"
              onClick={() => setActiveBoat(b.boat)}
              className={
                'rounded-lg border px-4 py-2 text-sm transition-colors ' +
                (on
                  ? 'border-primary/25 bg-primary/10 font-medium text-foreground'
                  : 'border-border bg-card text-muted-foreground hover:bg-muted')
              }
            >
              {b.label}
            </button>
          )
        })}
      </div>

      {rows.length === 0 ? (
        <p className="rounded-xl border border-border bg-card p-6 text-sm text-muted-foreground">
          No voyages recorded for this vessel yet. Each trip creates a logbook
          entry automatically.
        </p>
      ) : (
        <div className="space-y-3">
          {rows.map((r) => (
            <VoyageEntry key={r.tripId} row={r} />
          ))}
        </div>
      )}
    </div>
  )
}

function VoyageEntry({ row }: { row: VoyageLogRow }) {
  const [open, setOpen] = useState(false)
  const pob = personsOnBoard(row.crewCount, row.passengerCount)

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-3 px-4 py-3 text-left"
      >
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-border text-xs tabular-nums text-muted-foreground">
          {row.entryNumber ?? '—'}
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-baseline gap-x-2">
            <span className="font-serif text-lg text-foreground">
              {voyagePurposeLabel(row.purpose)}
            </span>
            <span className="text-xs text-muted-foreground">
              {row.date ?? '—'}
            </span>
          </span>
          <span className="mt-0.5 block text-xs text-muted-foreground">
            {row.captainName ?? 'No captain'} · {pob} on board
            {row.distanceNm != null
              ? ` · ${row.distanceNm.toFixed(1)} nm`
              : ''}
          </span>
        </span>
        {row.locked && (
          <span className="flex items-center gap-1 rounded-full bg-[#4f7a54]/12 px-2 py-1 text-[10px] uppercase tracking-[0.1em] text-[#3a5c3f]">
            <Lock className="h-3 w-3" /> Locked
          </span>
        )}
        {row.unscheduled && (
          <span className="flex items-center gap-1 rounded-full bg-[#b0203a]/12 px-2 py-1 text-[10px] uppercase tracking-[0.1em] text-[#8f1a2f]">
            <TriangleAlert className="h-3 w-3" /> Port entry
          </span>
        )}
        <ChevronDown
          className={
            'h-4 w-4 shrink-0 text-muted-foreground transition-transform ' +
            (open ? 'rotate-180' : '')
          }
        />
      </button>

      {open && (
        <div className="border-t border-border px-4 py-4">
          <EntryDetail row={row} pob={pob} />
        </div>
      )}
    </div>
  )
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
        {label}
      </p>
      <p className="mt-0.5 text-sm text-foreground">{value}</p>
    </div>
  )
}

function EntryDetail({ row, pob }: { row: VoyageLogRow; pob: number }) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const locked = row.locked

  return (
    <div className="space-y-5">
      {locked && (
        <div className="flex items-start gap-2 rounded-lg bg-[#4f7a54]/10 p-3 text-xs text-[#3a5c3f]">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            Approved by {row.approvedBy} on {fmtDateTime(row.approvedAt)}. This
            entry is locked; a change now requires a formal correction.
          </span>
        </div>
      )}

      {/* Vessel / departure / arrival / persons */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Field label="Vessel" value={row.boatLabel} />
        <Field label="Captain" value={row.captainName ?? '—'} />
        <Field
          label="Crew"
          value={row.crew.length ? row.crew.join(', ') : '—'}
        />
        <Field label="Persons on board" value={String(pob)} />
        <Field
          label="Departure"
          value={row.departureLocation ?? '—'}
        />
        <Field label="Departure GPS" value={fmtGps(row.departureLat, row.departureLon)} />
        <Field label="Departure time" value={fmtDateTime(row.startedAt)} />
        <Field label="Purpose" value={voyagePurposeLabel(row.purpose)} />
        <Field label="Arrival" value={row.arrivalLocation ?? '—'} />
        <Field label="Arrival GPS" value={fmtGps(row.arrivalLat, row.arrivalLon)} />
        <Field label="Arrival time" value={fmtDateTime(row.endedAt)} />
        <Field
          label="Distance / engine h"
          value={
            (row.distanceNm != null ? `${row.distanceNm.toFixed(1)} nm` : '—') +
            (row.engineHoursStart != null && row.engineHoursEnd != null
              ? ` · ${(row.engineHoursEnd - row.engineHoursStart).toFixed(1)} h`
              : '')
          }
        />
      </div>

      {!locked && (
        <EditCompliance row={row} pending={pending} start={start} router={router} />
      )}

      {/* Voyage events */}
      <VoyageEventsBlock row={row} locked={locked} pending={pending} start={start} router={router} />

      {/* Official validation */}
      <OfficialValidationBlock row={row} locked={locked} pending={pending} start={start} router={router} />

      {/* Unscheduled entry */}
      <UnscheduledBlock row={row} locked={locked} pending={pending} start={start} router={router} />

      {/* Captain approval */}
      {!locked && (
        <ApproveBlock row={row} pending={pending} start={start} router={router} />
      )}
    </div>
  )
}

type BlockProps = {
  row: VoyageLogRow
  locked: boolean
  pending: boolean
  start: (fn: () => void) => void
  router: ReturnType<typeof useRouter>
}

function labelCls() {
  return 'text-[10px] uppercase tracking-[0.12em] text-muted-foreground'
}
function inputCls() {
  return 'mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground'
}

function EditCompliance({
  row,
  pending,
  start,
  router,
}: {
  row: VoyageLogRow
  pending: boolean
  start: (fn: () => void) => void
  router: ReturnType<typeof useRouter>
}) {
  const [dep, setDep] = useState(row.departureLocation ?? '')
  const [arr, setArr] = useState(row.arrivalLocation ?? '')
  const [crew, setCrew] = useState(String(row.crewCount))
  const [pax, setPax] = useState(String(row.passengerCount))

  return (
    <div className="rounded-lg border border-border bg-muted/40 p-3">
      <p className={labelCls()}>Logbook details</p>
      <div className="mt-2 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <label className="block">
          <span className={labelCls()}>Departure location</span>
          <input className={inputCls()} value={dep} onChange={(e) => setDep(e.target.value)} placeholder="Port de Nosy Be" />
        </label>
        <label className="block">
          <span className={labelCls()}>Arrival location</span>
          <input className={inputCls()} value={arr} onChange={(e) => setArr(e.target.value)} placeholder="Port de Nosy Be" />
        </label>
        <label className="block">
          <span className={labelCls()}>Crew count</span>
          <input type="number" min={0} className={inputCls()} value={crew} onChange={(e) => setCrew(e.target.value)} />
        </label>
        <label className="block">
          <span className={labelCls()}>Passenger count</span>
          <input type="number" min={0} className={inputCls()} value={pax} onChange={(e) => setPax(e.target.value)} />
        </label>
      </div>
      <div className="mt-3">
        <button
          type="button"
          disabled={pending}
          onClick={() =>
            start(async () => {
              await saveVoyageLog({
                tripId: row.tripId,
                departureLocation: dep,
                arrivalLocation: arr,
                crewCount: Number(crew) || 0,
                passengerCount: Number(pax) || 0,
                notes: row.notes,
              })
              router.refresh()
            })
          }
          className="rounded-lg bg-primary px-4 py-2 text-sm text-primary-foreground disabled:opacity-50"
        >
          Save details
        </button>
      </div>
    </div>
  )
}

function VoyageEventsBlock({ row, locked, pending, start, router }: BlockProps) {
  const [adding, setAdding] = useState(false)
  const [type, setType] = useState(VOYAGE_EVENT_TYPES[0].id as string)
  const [desc, setDesc] = useState('')
  const [action, setAction] = useState('')

  return (
    <div>
      <div className="flex items-center justify-between">
        <p className={labelCls()}>Voyage events</p>
        {!locked && (
          <button
            type="button"
            onClick={() => setAdding((v) => !v)}
            className="flex items-center gap-1 text-xs text-primary"
          >
            <Plus className="h-3 w-3" /> Add event
          </button>
        )}
      </div>

      {row.events.length === 0 && !adding && (
        <p className="mt-1 text-sm text-muted-foreground">No events logged.</p>
      )}

      <ul className="mt-2 space-y-2">
        {row.events.map((e) => (
          <li
            key={e.id}
            className="rounded-lg border border-border bg-background p-3"
          >
            <div className="flex flex-wrap items-baseline justify-between gap-x-2">
              <span className="text-sm font-medium text-foreground">
                {voyageEventLabel(e.type)}
              </span>
              <span className="text-xs text-muted-foreground">
                {fmtDateTime(e.at)} · {fmtGps(e.lat, e.lon)}
              </span>
            </div>
            {e.description && (
              <p className="mt-1 text-sm text-foreground">{e.description}</p>
            )}
            {e.actionTaken && (
              <p className="mt-1 text-xs text-muted-foreground">
                Action: {e.actionTaken}
              </p>
            )}
          </li>
        ))}
      </ul>

      {adding && !locked && (
        <div className="mt-2 rounded-lg border border-border bg-muted/40 p-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className={labelCls()}>Event type</span>
              <select className={inputCls()} value={type} onChange={(e) => setType(e.target.value)}>
                {VOYAGE_EVENT_TYPES.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className={labelCls()}>Action taken</span>
              <input className={inputCls()} value={action} onChange={(e) => setAction(e.target.value)} />
            </label>
          </div>
          <label className="mt-3 block">
            <span className={labelCls()}>Description</span>
            <textarea className={inputCls()} rows={2} value={desc} onChange={(e) => setDesc(e.target.value)} />
          </label>
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              disabled={pending}
              onClick={() =>
                start(async () => {
                  await addVoyageEvent({
                    tripId: row.tripId,
                    boat: row.boat,
                    type,
                    description: desc,
                    actionTaken: action,
                    captain: row.captainName,
                    lat: row.arrivalLat,
                    lon: row.arrivalLon,
                  })
                  setDesc('')
                  setAction('')
                  setAdding(false)
                  router.refresh()
                })
              }
              className="rounded-lg bg-primary px-4 py-2 text-sm text-primary-foreground disabled:opacity-50"
            >
              Log event
            </button>
            <button
              type="button"
              onClick={() => setAdding(false)}
              className="rounded-lg border border-border px-4 py-2 text-sm text-muted-foreground"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function OfficialValidationBlock({ row, locked, pending, start, router }: BlockProps) {
  const [status, setStatus] = useState<OfficialStatus>(
    (row.officialStatus as OfficialStatus) ?? 'not-required',
  )
  const [authType, setAuthType] = useState(row.officialAuthorityType ?? '')
  const [office, setOffice] = useState(row.officialAuthorityOffice ?? '')
  const [officer, setOfficer] = useState(row.officialOfficer ?? '')
  const [date, setDate] = useState(row.officialDate ?? '')
  const [ref, setRef] = useState(row.officialReference ?? '')
  const [notes, setNotes] = useState(row.officialNotes ?? '')

  return (
    <div className="rounded-lg border border-border bg-muted/40 p-3">
      <p className={labelCls()}>Official validation</p>
      <p className="mt-0.5 text-[11px] text-muted-foreground">
        A record only that the logbook was presented — not an official state
        visa.
      </p>
      <div className="mt-2 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <label className="block">
          <span className={labelCls()}>Status</span>
          <select
            className={inputCls()}
            value={status}
            disabled={locked}
            onChange={(e) => setStatus(e.target.value as OfficialStatus)}
          >
            {(Object.keys(OFFICIAL_STATUS_LABEL) as OfficialStatus[]).map((s) => (
              <option key={s} value={s}>
                {OFFICIAL_STATUS_LABEL[s]}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className={labelCls()}>Authority type</span>
          <input className={inputCls()} value={authType} disabled={locked} onChange={(e) => setAuthType(e.target.value)} placeholder="APMF / Gendarmerie" />
        </label>
        <label className="block">
          <span className={labelCls()}>Office</span>
          <input className={inputCls()} value={office} disabled={locked} onChange={(e) => setOffice(e.target.value)} />
        </label>
        <label className="block">
          <span className={labelCls()}>Officer</span>
          <input className={inputCls()} value={officer} disabled={locked} onChange={(e) => setOfficer(e.target.value)} />
        </label>
        <label className="block">
          <span className={labelCls()}>Date</span>
          <input type="date" className={inputCls()} value={date} disabled={locked} onChange={(e) => setDate(e.target.value)} />
        </label>
        <label className="block">
          <span className={labelCls()}>Reference</span>
          <input className={inputCls()} value={ref} disabled={locked} onChange={(e) => setRef(e.target.value)} />
        </label>
      </div>
      <label className="mt-3 block">
        <span className={labelCls()}>Notes</span>
        <input className={inputCls()} value={notes} disabled={locked} onChange={(e) => setNotes(e.target.value)} />
      </label>
      {!locked && (
        <div className="mt-3">
          <button
            type="button"
            disabled={pending}
            onClick={() =>
              start(async () => {
                await saveOfficialValidation({
                  tripId: row.tripId,
                  status,
                  authorityType: authType,
                  authorityOffice: office,
                  officer,
                  date,
                  reference: ref,
                  notes,
                })
                router.refresh()
              })
            }
            className="rounded-lg bg-primary px-4 py-2 text-sm text-primary-foreground disabled:opacity-50"
          >
            Save validation
          </button>
        </div>
      )}
    </div>
  )
}

function UnscheduledBlock({ row, locked, pending, start, router }: BlockProps) {
  const existing = row.unscheduled
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState(existing?.reason ?? UNSCHEDULED_REASONS[0].id)
  const [port, setPort] = useState(existing?.actualPort ?? '')
  const [origDest, setOrigDest] = useState(existing?.originalDestination ?? '')
  const [reasonNotes, setReasonNotes] = useState(existing?.reasonNotes ?? '')
  const [authority, setAuthority] = useState(existing?.authorityNotified ?? '')
  const [authRef, setAuthRef] = useState(existing?.authorityReference ?? '')

  if (existing && !open) {
    return (
      <div className="rounded-lg border border-[#b0203a]/25 bg-[#b0203a]/[0.06] p-3">
        <div className="flex items-center justify-between">
          <p className="flex items-center gap-1 text-[10px] uppercase tracking-[0.12em] text-[#8f1a2f]">
            <TriangleAlert className="h-3 w-3" /> Unscheduled port entry
          </p>
          {!locked && (
            <button type="button" onClick={() => setOpen(true)} className="text-xs text-primary">
              Edit
            </button>
          )}
        </div>
        <p className="mt-1 text-sm text-foreground">
          {UNSCHEDULED_REASONS.find((r) => r.id === existing.reason)?.label ??
            existing.reason}{' '}
          — {existing.actualPort || '—'}
        </p>
        {existing.authorityNotified && (
          <p className="mt-1 text-xs text-muted-foreground">
            Notified:{' '}
            {NOTIFY_AUTHORITIES.find((a) => a.id === existing.authorityNotified)
              ?.label ?? existing.authorityNotified}
            {existing.authorityReference ? ` · ${existing.authorityReference}` : ''}
          </p>
        )}
      </div>
    )
  }

  if (!open) {
    return locked ? null : (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center gap-1 text-xs text-[#8f1a2f]"
      >
        <TriangleAlert className="h-3 w-3" /> Record unscheduled / emergency port
        entry
      </button>
    )
  }

  return (
    <div className="rounded-lg border border-[#b0203a]/25 bg-[#b0203a]/[0.06] p-3">
      <p className="flex items-center gap-1 text-[10px] uppercase tracking-[0.12em] text-[#8f1a2f]">
        <TriangleAlert className="h-3 w-3" /> Unscheduled / emergency port entry
      </p>
      <div className="mt-2 grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className={labelCls()}>Reason</span>
          <select className={inputCls()} value={reason} onChange={(e) => setReason(e.target.value)}>
            {UNSCHEDULED_REASONS.map((r) => (
              <option key={r.id} value={r.id}>
                {r.label}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className={labelCls()}>Actual port / landing</span>
          <input className={inputCls()} value={port} onChange={(e) => setPort(e.target.value)} />
        </label>
        <label className="block">
          <span className={labelCls()}>Original destination</span>
          <input className={inputCls()} value={origDest} onChange={(e) => setOrigDest(e.target.value)} />
        </label>
        <label className="block">
          <span className={labelCls()}>Authority notified</span>
          <select className={inputCls()} value={authority} onChange={(e) => setAuthority(e.target.value)}>
            <option value="">None</option>
            {NOTIFY_AUTHORITIES.map((a) => (
              <option key={a.id} value={a.id}>
                {a.label}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className={labelCls()}>Authority reference</span>
          <input className={inputCls()} value={authRef} onChange={(e) => setAuthRef(e.target.value)} />
        </label>
      </div>
      <label className="mt-3 block">
        <span className={labelCls()}>Reason notes</span>
        <textarea className={inputCls()} rows={2} value={reasonNotes} onChange={(e) => setReasonNotes(e.target.value)} />
      </label>
      <div className="mt-3 flex gap-2">
        <button
          type="button"
          disabled={pending}
          onClick={() =>
            start(async () => {
              await recordUnscheduledEntry({
                tripId: row.tripId,
                entry: {
                  reason,
                  actualPort: port,
                  originalDestination: origDest,
                  reasonNotes,
                  authorityNotified: authority || null,
                  authorityReference: authRef,
                  lat: row.arrivalLat,
                  lon: row.arrivalLon,
                },
              })
              setOpen(false)
              router.refresh()
            })
          }
          className="rounded-lg bg-[#b0203a] px-4 py-2 text-sm text-white disabled:opacity-50"
        >
          Save port entry
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded-lg border border-border px-4 py-2 text-sm text-muted-foreground"
        >
          Cancel
        </button>
      </div>
    </div>
  )
}

function ApproveBlock({
  row,
  pending,
  start,
  router,
}: {
  row: VoyageLogRow
  pending: boolean
  start: (fn: () => void) => void
  router: ReturnType<typeof useRouter>
}) {
  const [captain, setCaptain] = useState(row.captainName ?? '')
  const [confirmed, setConfirmed] = useState(false)

  return (
    <div className="rounded-lg border border-border bg-background p-3">
      <p className={labelCls()}>Captain review</p>
      <label className="mt-2 flex items-start gap-2 text-sm text-foreground">
        <input
          type="checkbox"
          className="mt-1"
          checked={confirmed}
          onChange={(e) => setConfirmed(e.target.checked)}
        />
        <span>
          I confirm that the information recorded in this log is complete and
          accurate to the best of my knowledge.
        </span>
      </label>
      <div className="mt-3 flex flex-wrap items-end gap-3">
        <label className="block">
          <span className={labelCls()}>Captain</span>
          <input className={inputCls()} value={captain} onChange={(e) => setCaptain(e.target.value)} />
        </label>
        <button
          type="button"
          disabled={pending || !confirmed || !captain.trim()}
          onClick={() =>
            start(async () => {
              await approveVoyageLog({ tripId: row.tripId, captain: captain.trim() })
              router.refresh()
            })
          }
          className="flex items-center gap-1 rounded-lg bg-[#4f7a54] px-4 py-2 text-sm text-white disabled:opacity-50"
        >
          <Lock className="h-4 w-4" /> Approve &amp; lock entry
        </button>
      </div>
    </div>
  )
}
