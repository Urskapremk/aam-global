'use client'

import { useState, useTransition } from 'react'
import { CircleCheck, CircleDot, CircleX, Plus, ShieldCheck } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  CHECK_RESULT_LABEL,
  CHECK_RESULT_TONE,
  INCIDENT_CATEGORIES,
  SAFETY_CATEGORIES,
  incidentCategoryLabel,
  safetyCategoryLabel,
  type CheckResult,
} from '@/lib/compliance'
import {
  archiveSafetyItem,
  runPreDepartureCheck,
  saveIncident,
  saveSafetyItem,
  type IncidentRow,
  type PreDepartureResult,
  type SafetyItem,
} from '@/app/actions/safety'
import { BOATS } from '@/lib/boats'

const FIELD =
  'w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground'
const LABEL =
  'mb-1 block text-[11px] uppercase tracking-[0.12em] text-muted-foreground'

type Props = {
  boat: string
  safety: SafetyItem[]
  incidents: IncidentRow[]
}

const PURPOSES = [
  { id: 'fishing', label: 'Fishing' },
  { id: 'transfer', label: 'Passenger transport' },
  { id: 'charter', label: 'Charter' },
  { id: 'excursion', label: 'Excursion' },
  { id: 'other', label: 'Other' },
]

export function SafetyPanel({ boat, safety, incidents }: Props) {
  const [tab, setTab] = useState(boat)

  return (
    <div className="space-y-8">
      {/* Boat switch — the panel is rendered per boat but we keep a tab so the
          user can flip vessels without leaving the page. */}
      <div className="flex gap-2">
        {BOATS.map((b) => (
          <a
            key={b.id}
            href={`/admin/compliance/safety?boat=${b.id}`}
            className={`rounded-lg border px-4 py-2 text-sm transition-colors ${
              b.id === tab
                ? 'border-primary/40 bg-primary/10 text-foreground'
                : 'border-border bg-card text-muted-foreground hover:bg-muted'
            }`}
            onClick={() => setTab(b.id)}
          >
            {b.name}
          </a>
        ))}
      </div>

      <PreDepartureCard boat={boat} />
      <SafetyRegister boat={boat} items={safety} />
      <IncidentLog boat={boat} rows={incidents} />
    </div>
  )
}

// --- Pre-departure check ---------------------------------------------------

function ResultIcon({ state }: { state: string }) {
  if (state === 'pass')
    return <CircleCheck className="h-4 w-4 text-[#4f7a54]" strokeWidth={2} />
  if (state === 'fail')
    return <CircleX className="h-4 w-4 text-[#b0203a]" strokeWidth={2} />
  if (state === 'verify')
    return <CircleDot className="h-4 w-4 text-[#8f6d3a]" strokeWidth={2} />
  return <CircleDot className="h-4 w-4 text-muted-foreground" strokeWidth={1.5} />
}

function PreDepartureCard({ boat }: { boat: string }) {
  const [purpose, setPurpose] = useState('fishing')
  const [pob, setPob] = useState('')
  const [check, setCheck] = useState<PreDepartureResult | null>(null)
  const [pending, start] = useTransition()

  function run() {
    start(async () => {
      const res = await runPreDepartureCheck(boat, {
        purpose,
        personsOnBoard: pob ? Number(pob) : null,
      })
      setCheck(res)
    })
  }

  return (
    <section className="rounded-xl border border-border bg-card p-6">
      <div className="flex items-center gap-2">
        <ShieldCheck className="h-5 w-5 text-primary" strokeWidth={1.5} />
        <h2 className="font-serif text-xl text-foreground">
          Legal &amp; safety pre-departure check
        </h2>
      </div>
      <p className="mt-1 text-sm text-muted-foreground">
        Reads the live document register, safety inspection and capacity. Run
        this before every trip — a red result means the trip cannot be released.
      </p>

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <div>
          <label className={LABEL}>Trip purpose</label>
          <select
            value={purpose}
            onChange={(e) => setPurpose(e.target.value)}
            className={FIELD}
          >
            {PURPOSES.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={LABEL}>Persons on board</label>
          <input
            type="number"
            min={1}
            value={pob}
            onChange={(e) => setPob(e.target.value)}
            className={FIELD}
            placeholder="incl. captain"
          />
        </div>
        <div className="flex items-end">
          <Button onClick={run} disabled={pending} className="w-full">
            {pending ? 'Checking…' : 'Run check'}
          </Button>
        </div>
      </div>

      {check && (
        <div className="mt-5">
          <div
            className={`flex items-center gap-2 rounded-lg border px-4 py-3 text-sm font-medium uppercase tracking-[0.1em] ${
              CHECK_RESULT_TONE[check.result as CheckResult]
            }`}
          >
            <ResultIcon state={check.result === 'green' ? 'pass' : check.result === 'red' ? 'fail' : 'verify'} />
            {CHECK_RESULT_LABEL[check.result as CheckResult]}
          </div>

          {check.capacityExceeded && (
            <p className="mt-2 rounded-md bg-[#b0203a]/10 px-3 py-2 text-sm font-medium text-[#8f1a2f]">
              CAPACITY EXCEEDED — TRIP CANNOT START
            </p>
          )}

          <ul className="mt-4 divide-y divide-border">
            {check.items.map((item) => (
              <li key={item.key} className="flex items-start gap-3 py-2.5">
                <span className="mt-0.5">
                  <ResultIcon state={item.state} />
                </span>
                <span className="flex-1">
                  <span className="block text-sm text-foreground">{item.label}</span>
                  {item.detail && (
                    <span className="block text-xs text-muted-foreground">
                      {item.detail}
                    </span>
                  )}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  )
}

// --- Safety equipment register --------------------------------------------

function SafetyRegister({ boat, items }: { boat: string; items: SafetyItem[] }) {
  const [adding, setAdding] = useState(false)
  const [form, setForm] = useState({
    category: 'life-jackets',
    name: '',
    quantity: '',
    inspectionDate: '',
    expiryDate: '',
    condition: '',
    nextInspection: '',
  })
  const [pending, start] = useTransition()

  function save() {
    start(async () => {
      await saveSafetyItem({
        boat,
        category: form.category,
        name: form.name || null,
        quantity: form.quantity ? Number(form.quantity) : null,
        inspectionDate: form.inspectionDate || null,
        expiryDate: form.expiryDate || null,
        condition: form.condition || null,
        nextInspection: form.nextInspection || null,
      })
      setAdding(false)
      setForm({
        category: 'life-jackets',
        name: '',
        quantity: '',
        inspectionDate: '',
        expiryDate: '',
        condition: '',
        nextInspection: '',
      })
    })
  }

  return (
    <section className="rounded-xl border border-border bg-card p-6">
      <div className="flex items-center justify-between">
        <h2 className="font-serif text-xl text-foreground">Safety equipment</h2>
        <Button variant="outline" size="sm" onClick={() => setAdding((v) => !v)}>
          <Plus className="mr-1 h-4 w-4" /> Add item
        </Button>
      </div>

      {adding && (
        <div className="mt-4 grid gap-3 rounded-lg border border-border bg-muted/40 p-4 sm:grid-cols-2">
          <div>
            <label className={LABEL}>Category</label>
            <select
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
              className={FIELD}
            >
              {SAFETY_CATEGORIES.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={LABEL}>Name / detail</label>
            <input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className={FIELD}
            />
          </div>
          <div>
            <label className={LABEL}>Quantity</label>
            <input
              type="number"
              value={form.quantity}
              onChange={(e) => setForm({ ...form, quantity: e.target.value })}
              className={FIELD}
            />
          </div>
          <div>
            <label className={LABEL}>Condition</label>
            <input
              value={form.condition}
              onChange={(e) => setForm({ ...form, condition: e.target.value })}
              className={FIELD}
            />
          </div>
          <div>
            <label className={LABEL}>Inspection date</label>
            <input
              type="date"
              value={form.inspectionDate}
              onChange={(e) => setForm({ ...form, inspectionDate: e.target.value })}
              className={FIELD}
            />
          </div>
          <div>
            <label className={LABEL}>Next inspection</label>
            <input
              type="date"
              value={form.nextInspection}
              onChange={(e) => setForm({ ...form, nextInspection: e.target.value })}
              className={FIELD}
            />
          </div>
          <div className="sm:col-span-2">
            <Button onClick={save} disabled={pending || !form.category}>
              {pending ? 'Saving…' : 'Save item'}
            </Button>
          </div>
        </div>
      )}

      {items.length === 0 ? (
        <p className="mt-4 text-sm text-muted-foreground">
          No safety equipment recorded yet.
        </p>
      ) : (
        <ul className="mt-4 divide-y divide-border">
          {items.map((it) => (
            <li key={it.id} className="flex items-center justify-between py-3">
              <span>
                <span className="block text-sm text-foreground">
                  {safetyCategoryLabel(it.category)}
                  {it.name ? ` — ${it.name}` : ''}
                  {it.quantity != null ? ` (×${it.quantity})` : ''}
                </span>
                <span className="block text-xs text-muted-foreground">
                  {it.condition ? `${it.condition} · ` : ''}
                  {it.nextInspection
                    ? `next inspection ${it.nextInspection}`
                    : it.expiryDate
                      ? `expires ${it.expiryDate}`
                      : 'no date set'}
                </span>
              </span>
              <button
                onClick={() => archiveSafetyItem(it.id)}
                className="text-xs text-muted-foreground hover:text-[#b0203a]"
              >
                Archive
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

// --- Incident log ----------------------------------------------------------

function IncidentLog({ boat, rows }: { boat: string; rows: IncidentRow[] }) {
  const [adding, setAdding] = useState(false)
  const [form, setForm] = useState({
    category: 'injury',
    captain: '',
    at: '',
    description: '',
    immediateActions: '',
    authorityNotified: false,
    authorityName: '',
  })
  const [pending, start] = useTransition()

  function save() {
    start(async () => {
      await saveIncident({
        boat,
        category: form.category,
        captain: form.captain || null,
        at: form.at || null,
        description: form.description || null,
        immediateActions: form.immediateActions || null,
        authorityNotified: form.authorityNotified,
        authorityName: form.authorityName || null,
      })
      setAdding(false)
      setForm({
        category: 'injury',
        captain: '',
        at: '',
        description: '',
        immediateActions: '',
        authorityNotified: false,
        authorityName: '',
      })
    })
  }

  return (
    <section className="rounded-xl border border-border bg-card p-6">
      <div className="flex items-center justify-between">
        <h2 className="font-serif text-xl text-foreground">
          Incident / accident log
        </h2>
        <Button variant="outline" size="sm" onClick={() => setAdding((v) => !v)}>
          <Plus className="mr-1 h-4 w-4" /> Record incident
        </Button>
      </div>

      {adding && (
        <div className="mt-4 grid gap-3 rounded-lg border border-border bg-muted/40 p-4 sm:grid-cols-2">
          <div>
            <label className={LABEL}>Category</label>
            <select
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
              className={FIELD}
            >
              {INCIDENT_CATEGORIES.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={LABEL}>Captain</label>
            <input
              value={form.captain}
              onChange={(e) => setForm({ ...form, captain: e.target.value })}
              className={FIELD}
            />
          </div>
          <div>
            <label className={LABEL}>Date &amp; time</label>
            <input
              type="datetime-local"
              value={form.at}
              onChange={(e) => setForm({ ...form, at: e.target.value })}
              className={FIELD}
            />
          </div>
          <div className="flex items-end gap-2">
            <label className="flex items-center gap-2 text-sm text-foreground">
              <input
                type="checkbox"
                checked={form.authorityNotified}
                onChange={(e) =>
                  setForm({ ...form, authorityNotified: e.target.checked })
                }
              />
              Authority notified
            </label>
          </div>
          {form.authorityNotified && (
            <div className="sm:col-span-2">
              <label className={LABEL}>Authority notified</label>
              <input
                value={form.authorityName}
                onChange={(e) => setForm({ ...form, authorityName: e.target.value })}
                className={FIELD}
                placeholder="Marine authority / gendarmerie…"
              />
            </div>
          )}
          <div className="sm:col-span-2">
            <label className={LABEL}>Description</label>
            <textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              className={`${FIELD} min-h-20`}
            />
          </div>
          <div className="sm:col-span-2">
            <label className={LABEL}>Immediate actions taken</label>
            <textarea
              value={form.immediateActions}
              onChange={(e) =>
                setForm({ ...form, immediateActions: e.target.value })
              }
              className={`${FIELD} min-h-16`}
            />
          </div>
          <div className="sm:col-span-2">
            <Button onClick={save} disabled={pending}>
              {pending ? 'Saving…' : 'Save incident'}
            </Button>
          </div>
        </div>
      )}

      {rows.length === 0 ? (
        <p className="mt-4 text-sm text-muted-foreground">
          No incidents recorded. Long may it stay that way.
        </p>
      ) : (
        <ul className="mt-4 divide-y divide-border">
          {rows.map((r) => (
            <li key={r.id} className="py-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-foreground">
                  {incidentCategoryLabel(r.category)}
                </span>
                <span className="text-xs text-muted-foreground">
                  {r.at ? new Date(r.at).toLocaleString('en-GB') : ''}
                </span>
              </div>
              {r.description && (
                <p className="mt-1 text-sm text-muted-foreground">
                  {r.description}
                </p>
              )}
              {r.authorityNotified && (
                <p className="mt-1 text-xs text-[#1a5c7d]">
                  Authority notified{r.authorityName ? `: ${r.authorityName}` : ''}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
