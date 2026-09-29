'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Pencil, Trash2, Loader2, EyeOff, Star } from 'lucide-react'
import { ImageUpload } from '@/components/admin/image-upload'
import { PRODUCT_CATEGORIES } from '@/lib/products'
import { useShopFx } from '@/components/shop-price'
import {
  createProduct,
  updateProduct,
  deleteProduct,
} from '@/app/actions/shop-products'

export type AdminProduct = {
  id: number
  name: string
  category: string
  price: number
  priceAr: number
  image: string | null
  alt: string
  description: string
  featured: boolean
  published: boolean
  sortOrder: number
}

type Draft = Omit<AdminProduct, 'id'> & { id?: number }

const EMPTY: Draft = {
  name: '',
  category: 'Lures & Baits',
  price: 0,
  priceAr: 0,
  image: null,
  alt: '',
  description: '',
  featured: false,
  published: true,
  sortOrder: 0,
}

export function ProductsManager({
  initial,
  emptyAction,
}: {
  initial: AdminProduct[]
  emptyAction?: React.ReactNode
}) {
  const router = useRouter()
  const fx = useShopFx()
  const [draft, setDraft] = useState<Draft | null>(null)

  const arOf = (p: { price: number; priceAr: number }) =>
    p.priceAr > 0 ? p.priceAr : fx?.arPerEur ? Math.round(p.price * fx.arPerEur) : 0
  const eurOf = (ar: number) =>
    fx?.arPerEur ? Math.round((ar / fx.arPerEur) * 100) / 100 : 0
  const zarOf = (ar: number) => (fx?.arPerZar ? Math.round(ar / fx.arPerZar) : 0)
  const fmt = (n: number) => n.toLocaleString('en-GB')
  const [saving, setSaving] = useState(false)
  const [deletingId, setDeletingId] = useState<number | null>(null)

  async function save() {
    if (!draft || !draft.name.trim()) return
    setSaving(true)
    try {
      const payload = {
        name: draft.name.trim(),
        category: draft.category,
        priceAr: Math.round(Number(draft.priceAr) || 0),
        image: draft.image,
        alt: draft.alt || draft.name.trim(),
        description: draft.description,
        featured: draft.featured,
        published: draft.published,
        sortOrder: Number(draft.sortOrder) || 0,
      }
      if (draft.id) await updateProduct(draft.id, payload)
      else await createProduct(payload)
      setDraft(null)
      router.refresh()
    } finally {
      setSaving(false)
    }
  }

  async function remove(id: number) {
    if (!confirm('Delete this product?')) return
    setDeletingId(id)
    try {
      await deleteProduct(id)
      router.refresh()
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="font-serif text-2xl text-foreground">Shop products</h1>
          <p className="text-sm text-muted-foreground">
            Shown in the AAM Shop.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setDraft({ ...EMPTY, sortOrder: initial.length })}
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          <Plus className="h-4 w-4" /> Add product
        </button>
      </div>

      {initial.length === 0 && !draft && (
        <div className="flex flex-col items-center gap-4 rounded-lg border border-dashed border-border p-8 text-center">
          <p className="text-muted-foreground">
            No products yet. Add one, or import the current catalogue.
          </p>
          {emptyAction}
        </div>
      )}

      <div className="grid gap-3">
        {initial.map((p) => (
          <div
            key={p.id}
            className="flex items-center gap-4 rounded-xl border border-border bg-background p-3"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={p.image || '/placeholder.svg?height=80&width=80&query=product'}
              alt={p.alt || p.name}
              className="h-16 w-16 shrink-0 rounded-lg object-cover"
            />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <p className="truncate font-medium text-foreground">{p.name}</p>
                {p.featured && (
                  <Star className="h-3.5 w-3.5 shrink-0 fill-accent text-accent" />
                )}
                {!p.published && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-secondary px-2 py-0.5 text-xs text-muted-foreground">
                    <EyeOff className="h-3 w-3" /> Hidden
                  </span>
                )}
              </div>
              <p className="truncate text-sm text-muted-foreground">
                {p.category} · Ar {fmt(arOf(p))} · €{fmt(eurOf(arOf(p)) || p.price)} · R{' '}
                {fmt(zarOf(arOf(p)))}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setDraft({ ...p, priceAr: arOf(p) })}
              aria-label="Edit"
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground hover:bg-secondary hover:text-foreground"
            >
              <Pencil className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => remove(p.id)}
              disabled={deletingId === p.id}
              aria-label="Delete"
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground hover:bg-red-50 hover:text-red-600"
            >
              {deletingId === p.id ? (
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
              {draft.id ? 'Edit product' : 'New product'}
            </h2>

            <div className="flex flex-col gap-4">
              <Field label="Name">
                <input
                  value={draft.name}
                  onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                  className="input"
                  placeholder="e.g. Bite Me Big Game Lure"
                />
              </Field>

              <div className="grid grid-cols-2 gap-4">
                <Field label="Category">
                  <select
                    value={draft.category}
                    onChange={(e) =>
                      setDraft({ ...draft, category: e.target.value })
                    }
                    className="input"
                  >
                    {PRODUCT_CATEGORIES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Price (Ar)">
                  <input
                    type="number"
                    min={0}
                    step={1000}
                    value={draft.priceAr || ''}
                    onChange={(e) =>
                      setDraft({ ...draft, priceAr: Number(e.target.value) })
                    }
                    className="input"
                    placeholder="e.g. 150000"
                  />
                  <p className="mt-1.5 text-xs tabular-nums text-muted-foreground">
                    {fx
                      ? `≈ € ${fmt(eurOf(draft.priceAr))} · R ${fmt(zarOf(draft.priceAr))}`
                      : 'Loading rate…'}
                  </p>
                </Field>
              </div>

              <Field label="Description">
                <textarea
                  value={draft.description}
                  onChange={(e) =>
                    setDraft({ ...draft, description: e.target.value })
                  }
                  rows={3}
                  className="input"
                  placeholder="Short product description…"
                />
              </Field>

              <ImageUpload
              value={draft.image}
              onChange={(url) => setDraft({ ...draft, image: url })}
              listenPaste
                label="Photo"
              />

              <div className="flex flex-col gap-2">
                <label className="flex items-center gap-2 text-sm text-foreground">
                  <input
                    type="checkbox"
                    checked={draft.featured}
                    onChange={(e) =>
                      setDraft({ ...draft, featured: e.target.checked })
                    }
                    className="h-4 w-4"
                  />
                  Featured
                </label>
                <label className="flex items-center gap-2 text-sm text-foreground">
                  <input
                    type="checkbox"
                    checked={draft.published}
                    onChange={(e) =>
                      setDraft({ ...draft, published: e.target.checked })
                    }
                    className="h-4 w-4"
                  />
                  Published (visible in the shop)
                </label>
              </div>
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
                disabled={saving || !draft.name.trim()}
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
