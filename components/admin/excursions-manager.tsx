'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Pencil, Trash2, Loader2, GripVertical, EyeOff } from 'lucide-react'
import { ImageUpload } from '@/components/admin/image-upload'
import {
  createExcursion,
  updateExcursion,
  deleteExcursion,
} from '@/app/actions/excursions'

export type Excursion = {
  id: number
  title: string
  description: string
  duration: string
  price: number
  priceUnit: string
  image: string | null
  published: boolean
  sortOrder: number
}

type Draft = Omit<Excursion, 'id'> & { id?: number }

const EMPTY: Draft = {
  title: '',
  description: '',
  duration: '',
  price: 0,
  priceUnit: 'per person',
  image: null,
  published: true,
  sortOrder: 0,
}

export function ExcursionsManager({
  initial,
  emptyAction,
}: {
  initial: Excursion[]
  emptyAction?: React.ReactNode
}) {
  const router = useRouter()
  const [draft, setDraft] = useState<Draft | null>(null)
  const [saving, setSaving] = useState(false)
  const [deletingId, setDeletingId] = useState<number | null>(null)

  async function save() {
    if (!draft || !draft.title.trim()) return
    setSaving(true)
    try {
      const payload = {
        title: draft.title.trim(),
        description: draft.description,
        duration: draft.duration,
        price: Number(draft.price) || 0,
        priceUnit: draft.priceUnit,
        image: draft.image,
        published: draft.published,
        sortOrder: Number(draft.sortOrder) || 0,
      }
      if (draft.id) await updateExcursion(draft.id, payload)
      else await createExcursion(payload)
      setDraft(null)
      router.refresh()
    } finally {
      setSaving(false)
    }
  }

  async function remove(id: number) {
    if (!confirm('Delete this excursion?')) return
    setDeletingId(id)
    try {
      await deleteExcursion(id)
      router.refresh()
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="font-serif text-2xl text-foreground">Excursions</h1>
          <p className="text-sm text-muted-foreground">
            Shown on the AAM Charters page.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setDraft({ ...EMPTY, sortOrder: initial.length })}
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          <Plus className="h-4 w-4" /> Add excursion
        </button>
      </div>

      {initial.length === 0 && !draft && (
        <div className="flex flex-col items-center gap-4 rounded-lg border border-dashed border-border p-8 text-center">
          <p className="text-muted-foreground">
            No excursions yet. Add one, or start from a few suggestions.
          </p>
          {emptyAction}
        </div>
      )}

      <div className="grid gap-3">
        {initial.map((ex) => (
          <div
            key={ex.id}
            className="flex items-center gap-4 rounded-xl border border-border bg-background p-3"
          >
            <GripVertical className="hidden h-5 w-5 shrink-0 text-muted-foreground sm:block" />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={ex.image || '/placeholder.svg?height=80&width=120&query=excursion'}
              alt={ex.title}
              className="h-16 w-24 shrink-0 rounded-lg object-cover"
            />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <p className="truncate font-medium text-foreground">{ex.title}</p>
                {!ex.published && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-secondary px-2 py-0.5 text-xs text-muted-foreground">
                    <EyeOff className="h-3 w-3" /> Hidden
                  </span>
                )}
              </div>
              <p className="truncate text-sm text-muted-foreground">
                {ex.duration && `${ex.duration} · `}
                {ex.price > 0 ? `€${ex.price} ${ex.priceUnit}` : 'Price on request'}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setDraft({ ...ex })}
              aria-label="Edit"
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground hover:bg-secondary hover:text-foreground"
            >
              <Pencil className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => remove(ex.id)}
              disabled={deletingId === ex.id}
              aria-label="Delete"
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground hover:bg-red-50 hover:text-red-600"
            >
              {deletingId === ex.id ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="h-4 w-4" />
              )}
            </button>
          </div>
        ))}
      </div>

      {draft && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4">
          <div className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-2xl bg-background p-6 sm:rounded-2xl">
            <h2 className="mb-4 font-serif text-xl text-foreground">
              {draft.id ? 'Edit excursion' : 'New excursion'}
            </h2>

            <div className="flex flex-col gap-4">
              <Field label="Title">
                <input
                  value={draft.title}
                  onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                  className="input"
                  placeholder="e.g. Nosy Iranja day trip"
                />
              </Field>

              <Field label="Description">
                <textarea
                  value={draft.description}
                  onChange={(e) =>
                    setDraft({ ...draft, description: e.target.value })
                  }
                  rows={3}
                  className="input"
                  placeholder="What the trip includes…"
                />
              </Field>

              <div className="grid grid-cols-2 gap-4">
                <Field label="Duration">
                  <input
                    value={draft.duration}
                    onChange={(e) =>
                      setDraft({ ...draft, duration: e.target.value })
                    }
                    className="input"
                    placeholder="e.g. Full day"
                  />
                </Field>
                <Field label="Price (€)">
                  <input
                    type="number"
                    min={0}
                    value={draft.price}
                    onChange={(e) =>
                      setDraft({ ...draft, price: Number(e.target.value) })
                    }
                    className="input"
                  />
                </Field>
              </div>

              <Field label="Price unit">
                <input
                  value={draft.priceUnit}
                  onChange={(e) =>
                    setDraft({ ...draft, priceUnit: e.target.value })
                  }
                  className="input"
                  placeholder="per person / per boat"
                />
              </Field>

              <ImageUpload
                value={draft.image}
                onChange={(url) => setDraft({ ...draft, image: url })}
                label="Photo"
              />

              <label className="flex items-center gap-2 text-sm text-foreground">
                <input
                  type="checkbox"
                  checked={draft.published}
                  onChange={(e) =>
                    setDraft({ ...draft, published: e.target.checked })
                  }
                  className="h-4 w-4"
                />
                Published (visible on the site)
              </label>
            </div>

            <div className="mt-6 flex gap-3">
              <button
                type="button"
                onClick={() => setDraft(null)}
                className="flex-1 rounded-lg border border-border px-4 py-2.5 text-sm font-medium text-foreground hover:bg-secondary"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={save}
                disabled={saving || !draft.title.trim()}
                className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
              >
                {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function Field({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <div>
      <label className="mb-1.5 block text-sm font-medium text-foreground">
        {label}
      </label>
      {children}
    </div>
  )
}
