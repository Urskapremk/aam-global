'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Pencil, Trash2, Loader2, EyeOff, Star } from 'lucide-react'
import { ImageUpload } from '@/components/admin/image-upload'
import { PRODUCT_CATEGORIES } from '@/lib/products'
import { useShopFx } from '@/components/shop-price'
import { ProductStock } from '@/components/admin/product-stock'
import { useT } from '@/lib/i18n/context'
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
  costAr: number
  transportAr: number
  customsAr: number
  marginPct: number
  stock: number | null
  image: string | null
  image2: string | null
  alt: string
  description: string
  featured: boolean
  published: boolean
  sortOrder: number
}

const landedOf = (p: { costAr: number; transportAr: number; customsAr: number }) =>
  (Number(p.costAr) || 0) + (Number(p.transportAr) || 0) + (Number(p.customsAr) || 0)

const sellingOf = (landed: number, marginPct: number) =>
  Math.round(landed * (1 + (Number(marginPct) || 0) / 100))

type Draft = Omit<AdminProduct, 'id'> & { id?: number }

const EMPTY: Draft = {
  name: '',
  category: 'Lures & Baits',
  price: 0,
  priceAr: 0,
  costAr: 0,
  transportAr: 0,
  customsAr: 0,
  marginPct: 0,
  stock: null,
  image: null,
  image2: null,
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
  const t = useT()
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
        costAr: Math.round(Number(draft.costAr) || 0),
        transportAr: Math.round(Number(draft.transportAr) || 0),
        customsAr: Math.round(Number(draft.customsAr) || 0),
        marginPct: Number(draft.marginPct) || 0,
        image: draft.image,
        image2: draft.image2 ?? null,
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
    if (!confirm(t('Delete this product?'))) return
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
          <h1 className="font-serif text-2xl text-foreground">{t('Shop products')}</h1>
          <p className="text-sm text-muted-foreground">
            {t('Shown in the AAM Shop.')}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setDraft({ ...EMPTY, sortOrder: initial.length })}
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          <Plus className="h-4 w-4" /> {t('Add product')}
        </button>
      </div>

      {initial.length === 0 && !draft && (
        <div className="flex flex-col items-center gap-4 rounded-lg border border-dashed border-border p-8 text-center">
          <p className="text-muted-foreground">
            {t('No products yet. Add one, or import the current catalogue.')}
          </p>
          {emptyAction}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {initial.map((p) => {
          const sellAr = arOf(p)
          const landed = landedOf(p)
          const profit = sellAr - landed
          return (
            <article
              key={p.id}
              className="flex flex-col overflow-hidden rounded-xl border border-border bg-background"
            >
              <div className="relative aspect-[4/3] bg-secondary">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={p.image || '/placeholder.svg?height=300&width=400&query=product'}
                  alt={p.alt || p.name}
                  className="h-full w-full object-cover"
                />
                <div className="absolute left-2 top-2 flex gap-1.5">
                  {p.featured && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-background/90 px-2 py-0.5 text-xs text-foreground">
                      <Star className="h-3 w-3 fill-accent text-accent" /> {t('Featured')}
                    </span>
                  )}
                  {!p.published && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-background/90 px-2 py-0.5 text-xs text-muted-foreground">
                      <EyeOff className="h-3 w-3" /> {t('Hidden')}
                    </span>
                  )}
                </div>
              </div>

              <div className="flex flex-1 flex-col gap-3 p-4">
                <div>
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">
                    {t(p.category)}
                  </p>
                  <h3 className="font-medium leading-snug text-foreground">{p.name}</h3>
                </div>

                <dl className="grid grid-cols-2 gap-x-3 gap-y-1 rounded-lg bg-secondary/60 p-3 text-sm tabular-nums">
                  <dt className="col-span-2 mb-1 text-[11px] uppercase tracking-wide text-muted-foreground">
                    {t('All prices per piece')}
                  </dt>
                  <dt className="text-muted-foreground">{t('Purchase price')}</dt>
                  <dd className="text-right">Ar {fmt(Number(p.costAr) || 0)}</dd>
                  <dt className="text-muted-foreground">{t('Transport')}</dt>
                  <dd className="text-right">Ar {fmt(Number(p.transportAr) || 0)}</dd>
                  <dt className="text-muted-foreground">{t('Customs')}</dt>
                  <dd className="text-right">Ar {fmt(Number(p.customsAr) || 0)}</dd>
                  <dt className="border-t border-border pt-1 font-medium text-foreground">
                    {t('Total landed cost')}
                  </dt>
                  <dd className="border-t border-border pt-1 text-right font-medium">
                    Ar {fmt(landed)}
                  </dd>
                  <dt className="text-muted-foreground">{t('Margin')}</dt>
                  <dd className="text-right">{Number(p.marginPct) || 0} %</dd>
                  <dt className="text-muted-foreground">{t('Profit')}</dt>
                  <dd
                    className={`text-right ${profit < 0 ? 'text-red-600' : 'text-foreground'}`}
                  >
                    Ar {fmt(profit)}
                  </dd>
                </dl>

                <ProductStock
                  productId={p.id}
                  productName={p.name}
                  stock={p.stock}
                  priceAr={sellAr}
                />

                <div className="mt-auto flex items-end justify-between gap-2">
                  <div>
                    <p className="text-xs text-muted-foreground">{t('Selling price')}</p>
                    <p className="text-lg font-semibold tabular-nums text-foreground">
                      Ar {fmt(sellAr)}{' '}
                      <span className="text-xs font-normal text-muted-foreground">
                        / {t('per piece')}
                      </span>
                    </p>
                    <p className="text-xs tabular-nums text-muted-foreground">
                      € {fmt(eurOf(sellAr) || p.price)} · R {fmt(zarOf(sellAr))}
                    </p>
                  </div>
                  <div className="flex gap-1">
                    <button
                      type="button"
                      onClick={() => setDraft({ ...p, priceAr: sellAr })}
                      aria-label={`${t('Edit')} ${p.name}`}
                      className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground hover:bg-secondary hover:text-foreground"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => remove(p.id)}
                      disabled={deletingId === p.id}
                      aria-label={`${t('Delete')} ${p.name}`}
                      className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground hover:bg-red-50 hover:text-red-600"
                    >
                      {deletingId === p.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Trash2 className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </article>
          )
        })}
      </div>

      {draft && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4">
          <div className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-2xl bg-background p-6 sm:rounded-2xl">
            <h2 className="mb-4 font-serif text-xl text-foreground">
              {draft.id ? t('Edit product') : t('New product')}
            </h2>

            <div className="flex flex-col gap-4">
              <Field label={t('Name')}>
                <input
                  value={draft.name}
                  onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                  className="input"
                  placeholder={t('e.g. Bite Me Big Game Lure')}
                />
              </Field>

              <div className="grid grid-cols-2 gap-4">
                <Field label={t('Category')}>
                  <select
                    value={draft.category}
                    onChange={(e) =>
                      setDraft({ ...draft, category: e.target.value })
                    }
                    className="input"
                  >
                    {PRODUCT_CATEGORIES.map((c) => (
                      <option key={c} value={c}>
                        {t(c)}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label={t('Selling price (Ar, per piece)')}>
                  <input
                    type="number"
                    min={0}
                    step={1000}
                    value={draft.priceAr || ''}
                    onChange={(e) => {
                      const priceAr = Number(e.target.value)
                      const landed = landedOf(draft)
                      // Editing the selling price back-calculates the margin.
                      const marginPct =
                        landed > 0
                          ? Math.round(((priceAr - landed) / landed) * 1000) / 10
                          : draft.marginPct
                      setDraft({ ...draft, priceAr, marginPct })
                    }}
                    className="input"
                    placeholder={t('e.g. 150000')}
                  />
                  <p className="mt-1.5 text-xs tabular-nums text-muted-foreground">
                    {fx
                      ? `≈ € ${fmt(eurOf(draft.priceAr))} · R ${fmt(zarOf(draft.priceAr))}`
                      : t('Loading rate…')}
                  </p>
                </Field>
              </div>

              <CostingBlock draft={draft} setDraft={setDraft} fmt={fmt} t={t} />

              <Field label={t('Description')}>
                <textarea
                  value={draft.description}
                  onChange={(e) =>
                    setDraft({ ...draft, description: e.target.value })
                  }
                  rows={3}
                  className="input"
                  placeholder={t('Short product description…')}
                />
              </Field>

              <div className="grid gap-4 sm:grid-cols-2">
                <ImageUpload
                  value={draft.image}
                  onChange={(url) => setDraft({ ...draft, image: url })}
                  listenPaste
                  label={t('Photo')}
                />
                <ImageUpload
                  value={draft.image2 ?? null}
                  onChange={(url) => setDraft({ ...draft, image2: url })}
                  label={t('Second photo')}
                />
              </div>

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
                  {t('Featured')}
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
                  {t('Published (visible in the shop)')}
                </label>
              </div>
            </div>

            <div className="mt-6 flex gap-3">
              <button
                type="button"
                onClick={() => setDraft(null)}
                className="flex-1 rounded-lg border border-border px-4 py-2.5 text-sm font-medium text-foreground hover:bg-secondary"
              >
                {t('Cancel')}
              </button>
              <button
                type="button"
                onClick={save}
                disabled={saving || !draft.name.trim()}
                className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
              >
                {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                {t('Save')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function CostingBlock({
  draft,
  setDraft,
  fmt,
  t,
}: {
  draft: Draft
  setDraft: (d: Draft) => void
  fmt: (n: number) => string
  t: (s: string) => string
}) {
  const landed = landedOf(draft)

  // Any cost/margin change recalculates the selling price.
  function update(patch: Partial<Draft>) {
    const next = { ...draft, ...patch }
    const nextLanded = landedOf(next)
    setDraft(
      nextLanded > 0
        ? { ...next, priceAr: sellingOf(nextLanded, next.marginPct) }
        : next,
    )
  }

  const costField = (
    key: 'costAr' | 'transportAr' | 'customsAr',
    label: string,
  ) => (
    <Field label={label}>
      <input
        type="number"
        min={0}
        step={1000}
        value={draft[key] || ''}
        onChange={(e) => update({ [key]: Number(e.target.value) })}
        className="input"
        placeholder="0"
      />
    </Field>
  )

  return (
    <div className="rounded-xl border border-border bg-secondary/40 p-4">
      <div className="mb-3 flex items-baseline justify-between gap-2">
        <p className="text-sm font-medium text-foreground">{t('Cost calculation')}</p>
        <p className="text-xs text-muted-foreground">{t('Admin only · in Ar · per piece')}</p>
      </div>
      <div className="grid grid-cols-3 gap-3">
        {costField('costAr', t('Purchase price'))}
        {costField('transportAr', t('Transport'))}
        {costField('customsAr', t('Customs'))}
      </div>
      <div className="mt-3 grid grid-cols-2 gap-3">
        <div>
          <p className="mb-1.5 block text-sm font-medium text-foreground">
            {t('Total landed cost')}
          </p>
          <p className="flex h-10 items-center rounded-lg bg-background px-3 text-sm font-semibold tabular-nums text-foreground">
            Ar {fmt(landed)}
          </p>
        </div>
        <Field label={t('Margin (%)')}>
          <input
            type="number"
            min={0}
            step={1}
            value={draft.marginPct || ''}
            onChange={(e) => update({ marginPct: Number(e.target.value) })}
            className="input"
            placeholder={t('e.g. 30')}
          />
        </Field>
      </div>
      {landed > 0 && (
        <p className="mt-3 text-xs tabular-nums text-muted-foreground">
          {t('Selling price')} = Ar {fmt(landed)} + {draft.marginPct || 0}% ={' '}
          <span className="font-semibold text-foreground">
            Ar {fmt(sellingOf(landed, draft.marginPct))}
          </span>{' '}
          · {t('profit')} Ar {fmt(sellingOf(landed, draft.marginPct) - landed)}
        </p>
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
