'use client'

import { useState } from 'react'
import useSWR from 'swr'
import {
  Plus,
  Trash2,
  Loader2,
  Check,
  X,
  Pencil,
  Users,
  Fish,
  Compass,
  Ship,
} from 'lucide-react'
import {
  createOdysseyTier,
  updateOdysseyTier,
  deleteOdysseyTier,
  createOdysseyActivity,
  updateOdysseyActivity,
  deleteOdysseyActivity,
  type OdysseyTier,
  type OdysseyActivity,
} from '@/app/actions/odyssey'
import { getFxRates } from '@/app/actions/fuel'
import { eurHint, type ConversionRates } from '@/lib/currency'

const inputCls =
  'w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none transition-colors focus:border-accent'

function priceLabel(priceEur: number | null, unit?: string): string {
  if (priceEur == null) return 'Cena še ni določena'
  const per = unit === 'per_person' ? ' / osebo' : unit === 'per_trip' ? ' / izlet' : ''
  return `€${priceEur}${per}`
}

// Ar + Rand reference under a EUR price. Prices here are billed in EUR; the
// reference makes their size legible in the local currency. Uses the Slovenian
// locale to match the rest of this (SL-only) screen.
function PriceRef({
  priceEur,
  rates,
}: {
  priceEur: number | null
  rates: ConversionRates | undefined
}) {
  if (priceEur == null) return null
  const hint = eurHint(priceEur, rates, 'sl')
  if (!hint) return null
  return <span className="text-[11px] tabular-nums text-muted-foreground">{hint}</span>
}

export function OdysseyPricingManager({
  initialTiers,
  initialActivities,
}: {
  initialTiers: OdysseyTier[]
  initialActivities: OdysseyActivity[]
}) {
  return (
    <div>
      <header className="mb-6">
        <div className="mb-1 flex items-center gap-2">
          <Ship className="h-5 w-5 text-accent" strokeWidth={1.5} />
          <h1 className="font-serif text-2xl font-medium text-foreground">Odyssey — cenik</h1>
        </div>
        <p className="text-sm text-muted-foreground">
          Odyssey izpluje enkrat na dan — za big game ribolov ali izlet. Cena čolna je odvisna
          od velikosti skupine. Vse spodaj lahko urejaš.
        </p>
      </header>

      <TiersSection initial={initialTiers} />
      <ActivitiesSection initial={initialActivities} />
    </div>
  )
}

/* -------------------- Charter price tiers -------------------- */

const EMPTY_TIER = { minPax: '', maxPax: '', priceEur: '', note: '' }

function TiersSection({ initial }: { initial: OdysseyTier[] }) {
  const rates = useSWR('fx-rates', () => getFxRates()).data
  const [tiers, setTiers] = useState<OdysseyTier[]>(initial)
  const [draft, setDraft] = useState({ ...EMPTY_TIER })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [editId, setEditId] = useState<number | null>(null)
  const [busyId, setBusyId] = useState<number | null>(null)

  async function add() {
    setError('')
    const minPax = Number(draft.minPax)
    const maxPax = Number(draft.maxPax)
    if (!Number.isFinite(minPax) || !Number.isFinite(maxPax) || minPax < 1 || maxPax < minPax) {
      setError('Vnesi veljaven razpon oseb (npr. 1–4).')
      return
    }
    const priceEur = draft.priceEur.trim() === '' ? null : Number(draft.priceEur)
    if (priceEur != null && (!Number.isFinite(priceEur) || priceEur < 0)) {
      setError('Vnesi veljavno ceno v evrih ali pusti prazno.')
      return
    }
    setSaving(true)
    const res = await createOdysseyTier({ minPax, maxPax, priceEur, note: draft.note })
    setSaving(false)
    if (res.ok && res.tier) {
      setTiers((prev) => [...prev, res.tier!].sort((a, b) => a.minPax - b.minPax))
      setDraft({ ...EMPTY_TIER })
    }
  }

  async function remove(id: number) {
    setBusyId(id)
    setTiers((prev) => prev.filter((t) => t.id !== id))
    try {
      await deleteOdysseyTier(id)
    } finally {
      setBusyId(null)
    }
  }

  async function saveEdit(t: OdysseyTier) {
    setBusyId(t.id)
    setTiers((prev) => prev.map((x) => (x.id === t.id ? t : x)).sort((a, b) => a.minPax - b.minPax))
    try {
      await updateOdysseyTier(t.id, {
        minPax: t.minPax,
        maxPax: t.maxPax,
        priceEur: t.priceEur,
        note: t.note,
      })
    } finally {
      setBusyId(null)
      setEditId(null)
    }
  }

  return (
    <section className="mb-10">
      <div className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
        <Users className="h-4 w-4 text-accent" strokeWidth={1.5} />
        Cena čolna po velikosti skupine
      </div>

      {/* Add tier */}
      <div className="mb-4 rounded-2xl border border-border bg-card p-5">
        <div className="grid gap-3 sm:grid-cols-4">
          <Field label="Od (oseb)">
            <input
              value={draft.minPax}
              onChange={(e) => setDraft({ ...draft, minPax: e.target.value })}
              inputMode="numeric"
              placeholder="1"
              className={inputCls}
            />
          </Field>
          <Field label="Do (oseb)">
            <input
              value={draft.maxPax}
              onChange={(e) => setDraft({ ...draft, maxPax: e.target.value })}
              inputMode="numeric"
              placeholder="4"
              className={inputCls}
            />
          </Field>
          <Field label="Cena (EUR)">
            <input
              value={draft.priceEur}
              onChange={(e) => setDraft({ ...draft, priceEur: e.target.value })}
              inputMode="numeric"
              placeholder="800 (ali pusti prazno)"
              className={inputCls}
            />
          </Field>
          <Field label="Opomba">
            <input
              value={draft.note}
              onChange={(e) => setDraft({ ...draft, note: e.target.value })}
              placeholder="npr. osnovna cena"
              className={inputCls}
            />
          </Field>
        </div>
        {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
        <button
          type="button"
          onClick={add}
          disabled={saving}
          className="mt-4 inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-60"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" strokeWidth={2} />}
          Dodaj razred
        </button>
      </div>

      {tiers.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card p-10 text-center text-muted-foreground">
          Ni cenovnih razredov. Dodaj prvega zgoraj.
        </div>
      ) : (
        <ul className="flex flex-col gap-3">
          {tiers.map((t) => {
            const busy = busyId === t.id
            if (editId === t.id) {
              return (
                <li key={t.id} className="rounded-2xl border border-accent/40 bg-card p-5">
                  <TierEditor tier={t} busy={busy} onCancel={() => setEditId(null)} onSave={saveEdit} />
                </li>
              )
            }
            return (
              <li
                key={t.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-card p-5"
              >
                <div className="min-w-0">
                  <p className="font-serif text-lg text-foreground">
                    {t.minPax}–{t.maxPax} oseb
                  </p>
                  <p className="mt-0.5 text-sm">
                    <span
                      className={
                        t.priceEur == null
                          ? 'italic text-muted-foreground'
                          : 'font-medium text-accent'
                      }
                    >
                      {priceLabel(t.priceEur)}
                    </span>
                    {t.note ? <span className="text-muted-foreground"> · {t.note}</span> : ''}
                  </p>
                  <div className="mt-0.5">
                    <PriceRef priceEur={t.priceEur} rates={rates} />
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  <IconBtn label="Uredi razred" onClick={() => setEditId(t.id)}>
                    <Pencil className="h-4 w-4" strokeWidth={1.5} />
                  </IconBtn>
                  <IconBtn label="Izbriši razred" danger busy={busy} onClick={() => remove(t.id)}>
                    <Trash2 className="h-4 w-4" strokeWidth={1.5} />
                  </IconBtn>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}

function TierEditor({
  tier,
  busy,
  onCancel,
  onSave,
}: {
  tier: OdysseyTier
  busy: boolean
  onCancel: () => void
  onSave: (t: OdysseyTier) => void
}) {
  const [t, setT] = useState<OdysseyTier>(tier)
  return (
    <div>
      <div className="grid gap-3 sm:grid-cols-4">
        <Field label="Od (oseb)">
          <input
            value={String(t.minPax)}
            onChange={(e) => setT({ ...t, minPax: Number(e.target.value) || 1 })}
            inputMode="numeric"
            className={inputCls}
          />
        </Field>
        <Field label="Do (oseb)">
          <input
            value={String(t.maxPax)}
            onChange={(e) => setT({ ...t, maxPax: Number(e.target.value) || 1 })}
            inputMode="numeric"
            className={inputCls}
          />
        </Field>
        <Field label="Cena (EUR)">
          <input
            value={t.priceEur == null ? '' : String(t.priceEur)}
            onChange={(e) =>
              setT({ ...t, priceEur: e.target.value.trim() === '' ? null : Number(e.target.value) || 0 })
            }
            inputMode="numeric"
            placeholder="prazno = cena kasneje"
            className={inputCls}
          />
        </Field>
        <Field label="Opomba">
          <input
            value={t.note}
            onChange={(e) => setT({ ...t, note: e.target.value })}
            className={inputCls}
          />
        </Field>
      </div>
      <EditActions busy={busy} onCancel={onCancel} onSave={() => onSave(t)} />
    </div>
  )
}

/* -------------------- Activities -------------------- */

const EMPTY_ACT = {
  label: '',
  category: 'excursion',
  note: '',
  priceEur: '',
  priceUnit: 'per_person',
}

function ActivitiesSection({ initial }: { initial: OdysseyActivity[] }) {
  const rates = useSWR('fx-rates', () => getFxRates()).data
  const [items, setItems] = useState<OdysseyActivity[]>(initial)
  const [draft, setDraft] = useState({ ...EMPTY_ACT })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [editId, setEditId] = useState<number | null>(null)
  const [busyId, setBusyId] = useState<number | null>(null)

  async function add() {
    setError('')
    if (!draft.label.trim()) {
      setError('Vnesi ime aktivnosti.')
      return
    }
    const priceEur = draft.priceEur.trim() === '' ? null : Number(draft.priceEur)
    setSaving(true)
    const res = await createOdysseyActivity({
      label: draft.label,
      category: draft.category,
      note: draft.note,
      priceEur,
      priceUnit: draft.priceUnit,
    })
    setSaving(false)
    if (res.ok && res.activity) {
      setItems((prev) => [...prev, res.activity!])
      setDraft({ ...EMPTY_ACT })
    } else if (res.error) {
      setError(res.error)
    }
  }

  async function remove(id: number) {
    setBusyId(id)
    setItems((prev) => prev.filter((a) => a.id !== id))
    try {
      await deleteOdysseyActivity(id)
    } finally {
      setBusyId(null)
    }
  }

  async function saveEdit(a: OdysseyActivity) {
    setBusyId(a.id)
    setItems((prev) => prev.map((x) => (x.id === a.id ? a : x)))
    try {
      await updateOdysseyActivity(a.id, {
        label: a.label,
        category: a.category,
        note: a.note,
        priceEur: a.priceEur,
        priceUnit: a.priceUnit,
        published: a.published,
      })
    } finally {
      setBusyId(null)
      setEditId(null)
    }
  }

  return (
    <section>
      <div className="mb-1 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
        <Compass className="h-4 w-4 text-accent" strokeWidth={1.5} />
        Aktivnosti dneva (ribolov in izleti)
      </div>
      <p className="mb-3 text-xs text-muted-foreground">
        Kaj lahko Odyssey počne na dnevni vožnji. Ribolov je označen z ribo, izleti s kompasom.
      </p>

      {/* Add activity */}
      <div className="mb-4 rounded-2xl border border-border bg-card p-5">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Ime aktivnosti">
            <input
              value={draft.label}
              onChange={(e) => setDraft({ ...draft, label: e.target.value })}
              placeholder="npr. Nosy Iranja — Day Trip"
              className={inputCls}
            />
          </Field>
          <Field label="Vrsta">
            <select
              value={draft.category}
              onChange={(e) => setDraft({ ...draft, category: e.target.value })}
              className={inputCls}
            >
              <option value="fishing">Ribolov (big game)</option>
              <option value="excursion">Izlet</option>
            </select>
          </Field>
          <Field label="Cena (EUR, neobvezno)">
            <input
              value={draft.priceEur}
              onChange={(e) => setDraft({ ...draft, priceEur: e.target.value })}
              inputMode="numeric"
              placeholder="npr. 90 (ali prazno)"
              className={inputCls}
            />
          </Field>
          <Field label="Enota cene">
            <select
              value={draft.priceUnit}
              onChange={(e) => setDraft({ ...draft, priceUnit: e.target.value })}
              className={inputCls}
            >
              <option value="per_person">Na osebo</option>
              <option value="per_trip">Na izlet</option>
            </select>
          </Field>
        </div>
        <Field label="Opomba (neobvezno)">
          <input
            value={draft.note}
            onChange={(e) => setDraft({ ...draft, note: e.target.value })}
            placeholder="npr. celodnevni izlet"
            className={inputCls}
          />
        </Field>
        {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
        <button
          type="button"
          onClick={add}
          disabled={saving}
          className="mt-4 inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-60"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" strokeWidth={2} />}
          Dodaj aktivnost
        </button>
      </div>

      {items.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card p-10 text-center text-muted-foreground">
          Ni aktivnosti. Dodaj prvo zgoraj.
        </div>
      ) : (
        <ul className="flex flex-col gap-3">
          {items.map((a) => {
            const busy = busyId === a.id
            if (editId === a.id) {
              return (
                <li key={a.id} className="rounded-2xl border border-accent/40 bg-card p-5">
                  <ActivityEditor
                    activity={a}
                    busy={busy}
                    onCancel={() => setEditId(null)}
                    onSave={saveEdit}
                  />
                </li>
              )
            }
            const isFishing = a.category === 'fishing'
            return (
              <li
                key={a.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-card p-5"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <span
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent/15 text-accent"
                    aria-hidden="true"
                  >
                    {isFishing ? (
                      <Fish className="h-4 w-4" strokeWidth={1.5} />
                    ) : (
                      <Compass className="h-4 w-4" strokeWidth={1.5} />
                    )}
                  </span>
                  <div className="min-w-0">
                    <p className="font-serif text-lg text-foreground">
                      {a.label}
                      {!a.published ? (
                        <span className="ml-2 align-middle text-xs text-muted-foreground">· skrito</span>
                      ) : null}
                    </p>
                    <p className="mt-0.5 text-sm text-muted-foreground">
                      {isFishing ? 'Ribolov' : 'Izlet'}
                      {' · '}
                      <span className={a.priceEur == null ? 'italic' : 'font-medium text-accent'}>
                        {priceLabel(a.priceEur, a.priceUnit)}
                      </span>
                      {a.note ? ` · ${a.note}` : ''}
                    </p>
                    <div className="mt-0.5">
                      <PriceRef priceEur={a.priceEur} rates={rates} />
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  <IconBtn label="Uredi aktivnost" onClick={() => setEditId(a.id)}>
                    <Pencil className="h-4 w-4" strokeWidth={1.5} />
                  </IconBtn>
                  <IconBtn label="Izbriši aktivnost" danger busy={busy} onClick={() => remove(a.id)}>
                    <Trash2 className="h-4 w-4" strokeWidth={1.5} />
                  </IconBtn>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}

function ActivityEditor({
  activity,
  busy,
  onCancel,
  onSave,
}: {
  activity: OdysseyActivity
  busy: boolean
  onCancel: () => void
  onSave: (a: OdysseyActivity) => void
}) {
  const [a, setA] = useState<OdysseyActivity>(activity)
  return (
    <div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Ime aktivnosti">
          <input value={a.label} onChange={(e) => setA({ ...a, label: e.target.value })} className={inputCls} />
        </Field>
        <Field label="Vrsta">
          <select
            value={a.category}
            onChange={(e) => setA({ ...a, category: e.target.value })}
            className={inputCls}
          >
            <option value="fishing">Ribolov (big game)</option>
            <option value="excursion">Izlet</option>
          </select>
        </Field>
        <Field label="Cena (EUR, neobvezno)">
          <input
            value={a.priceEur == null ? '' : String(a.priceEur)}
            onChange={(e) =>
              setA({ ...a, priceEur: e.target.value.trim() === '' ? null : Number(e.target.value) || 0 })
            }
            inputMode="numeric"
            placeholder="prazno = ni cene"
            className={inputCls}
          />
        </Field>
        <Field label="Enota cene">
          <select
            value={a.priceUnit}
            onChange={(e) => setA({ ...a, priceUnit: e.target.value })}
            className={inputCls}
          >
            <option value="per_person">Na osebo</option>
            <option value="per_trip">Na izlet</option>
          </select>
        </Field>
      </div>
      <Field label="Opomba (neobvezno)">
        <input value={a.note} onChange={(e) => setA({ ...a, note: e.target.value })} className={inputCls} />
      </Field>
      <label className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
        <input
          type="checkbox"
          checked={a.published}
          onChange={(e) => setA({ ...a, published: e.target.checked })}
          className="h-4 w-4 rounded border-border"
        />
        Prikaži kot razpoložljivo aktivnost
      </label>
      <EditActions busy={busy} onCancel={onCancel} onSave={() => onSave(a)} />
    </div>
  )
}

/* -------------------- shared bits -------------------- */

function EditActions({
  busy,
  onCancel,
  onSave,
}: {
  busy: boolean
  onCancel: () => void
  onSave: () => void
}) {
  return (
    <div className="mt-4 flex gap-2">
      <button
        type="button"
        onClick={onSave}
        disabled={busy}
        className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-60"
      >
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" strokeWidth={2} />}
        Shrani
      </button>
      <button
        type="button"
        onClick={onCancel}
        className="inline-flex items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
      >
        <X className="h-4 w-4" strokeWidth={1.5} />
        Prekliči
      </button>
    </div>
  )
}

function IconBtn({
  label,
  onClick,
  danger,
  busy,
  children,
}: {
  label: string
  onClick: () => void
  danger?: boolean
  busy?: boolean
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy}
      aria-label={label}
      className={
        danger
          ? 'inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border text-muted-foreground transition-colors hover:border-red-300 hover:text-red-600 disabled:opacity-60'
          : 'inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border text-muted-foreground transition-colors hover:text-foreground disabled:opacity-60'
      }
    >
      {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : children}
    </button>
  )
}

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
