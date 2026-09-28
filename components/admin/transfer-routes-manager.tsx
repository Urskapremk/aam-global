'use client'

import { useState } from 'react'
import { Plus, Trash2, Loader2, Route, Check, X, Pencil } from 'lucide-react'
import {
  createRoute,
  updateRoute,
  deleteRoute,
  type TransferRoute,
} from '@/app/actions/transfers'
import { formatEur } from '@/lib/transfers'
import { cn } from '@/lib/utils'

const EMPTY = { fromLocation: '', toLocation: '', priceEur: '', priceType: 'flat', note: '' }

export function TransferRoutesManager({ initial }: { initial: TransferRoute[] }) {
  const [routes, setRoutes] = useState<TransferRoute[]>(initial)
  const [draft, setDraft] = useState({ ...EMPTY })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [editId, setEditId] = useState<number | null>(null)
  const [busyId, setBusyId] = useState<number | null>(null)

  async function add() {
    setError('')
    const price = Number(draft.priceEur)
    if (!draft.fromLocation.trim() || !draft.toLocation.trim()) {
      setError('Enter both a from and a to location.')
      return
    }
    if (!Number.isFinite(price) || price < 0) {
      setError('Enter a valid price in euros.')
      return
    }
    setSaving(true)
    const res = await createRoute({
      fromLocation: draft.fromLocation,
      toLocation: draft.toLocation,
      priceEur: price,
      priceType: draft.priceType,
      note: draft.note,
    })
    setSaving(false)
    if (res.ok && res.route) {
      setRoutes((prev) => [...prev, res.route])
      setDraft({ ...EMPTY })
    }
  }

  async function remove(id: number) {
    setBusyId(id)
    setRoutes((prev) => prev.filter((r) => r.id !== id))
    try {
      await deleteRoute(id)
    } finally {
      setBusyId(null)
    }
  }

  async function saveEdit(r: TransferRoute) {
    setBusyId(r.id)
    setRoutes((prev) => prev.map((x) => (x.id === r.id ? r : x)))
    try {
      await updateRoute(r.id, {
        fromLocation: r.fromLocation,
        toLocation: r.toLocation,
        priceEur: r.priceEur,
        priceType: r.priceType,
        note: r.note,
        published: r.published,
      })
    } finally {
      setBusyId(null)
      setEditId(null)
    }
  }

  return (
    <div>
      <header className="mb-6">
        <h1 className="font-serif text-2xl font-medium text-foreground">
          Routes &amp; prices
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Your reusable price list. Pick a route when creating a transfer and the
          price fills in automatically — you can still override it per booking.
        </p>
      </header>

      {/* New route form */}
      <div className="mb-6 rounded-2xl border border-border bg-card p-5">
        <div className="mb-3 flex items-center gap-2 text-sm font-medium text-foreground">
          <Route className="h-4 w-4 text-accent" strokeWidth={1.5} />
          Add a route
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="From">
            <input
              value={draft.fromLocation}
              onChange={(e) => setDraft({ ...draft, fromLocation: e.target.value })}
              placeholder="Big Port Nosy Be"
              className={inputCls}
            />
          </Field>
          <Field label="To">
            <input
              value={draft.toLocation}
              onChange={(e) => setDraft({ ...draft, toLocation: e.target.value })}
              placeholder="Nosy Komba — Ampangorina"
              className={inputCls}
            />
          </Field>
          <Field label="Price (EUR)">
            <input
              value={draft.priceEur}
              onChange={(e) => setDraft({ ...draft, priceEur: e.target.value })}
              inputMode="numeric"
              placeholder="60"
              className={inputCls}
            />
          </Field>
          <Field label="Price type">
            <select
              value={draft.priceType}
              onChange={(e) => setDraft({ ...draft, priceType: e.target.value })}
              className={inputCls}
            >
              <option value="flat">Flat (per trip)</option>
              <option value="per_person">Per person</option>
            </select>
          </Field>
        </div>
        <Field label="Note (optional)">
          <input
            value={draft.note}
            onChange={(e) => setDraft({ ...draft, note: e.target.value })}
            placeholder="e.g. up to 2 guests, one way"
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
          {saving ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Plus className="h-4 w-4" strokeWidth={2} />
          )}
          Add route
        </button>
      </div>

      {/* Route list */}
      {routes.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card p-12 text-center text-muted-foreground">
          No routes yet. Add your first one above.
        </div>
      ) : (
        <ul className="flex flex-col gap-3">
          {routes.map((r) => {
            const busy = busyId === r.id
            if (editId === r.id) {
              return (
                <li key={r.id} className="rounded-2xl border border-accent/40 bg-card p-5">
                  <RouteEditor
                    route={r}
                    onCancel={() => setEditId(null)}
                    onSave={saveEdit}
                    busy={busy}
                  />
                </li>
              )
            }
            return (
              <li
                key={r.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-card p-5"
              >
                <div className="min-w-0">
                  <p className="font-serif text-lg text-foreground">
                    {r.fromLocation} <span className="text-muted-foreground">→</span>{' '}
                    {r.toLocation}
                  </p>
                  <p className="mt-0.5 text-sm text-muted-foreground">
                    {formatEur(r.priceEur)}{' '}
                    {r.priceType === 'per_person' ? 'per person' : 'per trip'}
                    {r.note ? ` · ${r.note}` : ''}
                    {!r.published ? ' · hidden' : ''}
                  </p>
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setEditId(r.id)}
                    aria-label="Edit route"
                    className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border text-muted-foreground transition-colors hover:text-foreground"
                  >
                    <Pencil className="h-4 w-4" strokeWidth={1.5} />
                  </button>
                  <button
                    type="button"
                    onClick={() => remove(r.id)}
                    disabled={busy}
                    aria-label="Delete route"
                    className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border text-muted-foreground transition-colors hover:border-red-300 hover:text-red-600 disabled:opacity-60"
                  >
                    {busy ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Trash2 className="h-4 w-4" strokeWidth={1.5} />
                    )}
                  </button>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

function RouteEditor({
  route,
  onCancel,
  onSave,
  busy,
}: {
  route: TransferRoute
  onCancel: () => void
  onSave: (r: TransferRoute) => void
  busy: boolean
}) {
  const [r, setR] = useState<TransferRoute>(route)
  return (
    <div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="From">
          <input
            value={r.fromLocation}
            onChange={(e) => setR({ ...r, fromLocation: e.target.value })}
            className={inputCls}
          />
        </Field>
        <Field label="To">
          <input
            value={r.toLocation}
            onChange={(e) => setR({ ...r, toLocation: e.target.value })}
            className={inputCls}
          />
        </Field>
        <Field label="Price (EUR)">
          <input
            value={String(r.priceEur)}
            onChange={(e) => setR({ ...r, priceEur: Number(e.target.value) || 0 })}
            inputMode="numeric"
            className={inputCls}
          />
        </Field>
        <Field label="Price type">
          <select
            value={r.priceType}
            onChange={(e) => setR({ ...r, priceType: e.target.value })}
            className={inputCls}
          >
            <option value="flat">Flat (per trip)</option>
            <option value="per_person">Per person</option>
          </select>
        </Field>
      </div>
      <Field label="Note (optional)">
        <input
          value={r.note}
          onChange={(e) => setR({ ...r, note: e.target.value })}
          className={inputCls}
        />
      </Field>
      <label className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
        <input
          type="checkbox"
          checked={r.published}
          onChange={(e) => setR({ ...r, published: e.target.checked })}
          className="h-4 w-4 rounded border-border"
        />
        Show on the public request form
      </label>
      <div className="mt-4 flex gap-2">
        <button
          type="button"
          onClick={() => onSave(r)}
          disabled={busy}
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-60"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" strokeWidth={2} />}
          Save
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="inline-flex items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          <X className="h-4 w-4" strokeWidth={1.5} />
          Cancel
        </button>
      </div>
    </div>
  )
}

const inputCls =
  'w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none transition-colors focus:border-accent'

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
