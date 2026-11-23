'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import { Search, ShoppingBag } from 'lucide-react'
import { ProductCard } from '@/components/product-card'
import {
  PRODUCT_CATEGORIES,
  type Product,
  type ProductCategory,
} from '@/lib/products'
import { useCart } from '@/components/cart-context'
import { getBusiness } from '@/lib/businesses'
import { useT } from '@/lib/i18n/context'

const business = getBusiness('shop')!

type Filter = 'All' | ProductCategory

const RODS_CATEGORY: ProductCategory = 'Rods & Reels'

/** Keep catalogue order, but pull every Rods & Reels item into one contiguous block at the first rods position. */
function clusterRodsAndReels(items: Product[]): Product[] {
  const first = items.findIndex((p) => p.category === RODS_CATEGORY)
  if (first < 0) return items

  const rods = items.filter((p) => p.category === RODS_CATEGORY)
  const result: Product[] = []
  let rodsPlaced = false
  for (const product of items) {
    if (product.category === RODS_CATEGORY) {
      if (!rodsPlaced) {
        result.push(...rods)
        rodsPlaced = true
      }
      continue
    }
    result.push(product)
  }
  return result
}

function matchesQuery(product: Product, query: string): boolean {
  const q = query.trim().toLowerCase()
  if (!q) return true
  const haystack = [product.name, product.description, product.alt, product.category]
    .join(' ')
    .toLowerCase()
  return q.split(/\s+/).every((word) => haystack.includes(word))
}

export function ShopStorefront() {
  const { catalog } = useCart()
  const t = useT()
  const [filter, setFilter] = useState<Filter>('All')
  const [query, setQuery] = useState('')

  // Only show categories that actually have products.
  const filters: Filter[] = [
    'All',
    ...PRODUCT_CATEGORIES.filter((c) => catalog.some((p) => p.category === c)),
  ]
  const visible = useMemo(() => {
    const byCategory =
      filter === 'All'
        ? clusterRodsAndReels(catalog)
        : catalog.filter((p) => p.category === filter)
    return byCategory.filter((p) => matchesQuery(p, query))
  }, [filter, catalog, query])

  return (
    <main>
      {/* Hero */}
      <section className="relative overflow-hidden bg-primary">
        <div className="mx-auto max-w-7xl px-6 pb-16 pt-36 lg:px-10 lg:pb-20 lg:pt-44">
          <nav className="mb-6 flex items-center gap-2 text-sm text-background/70">
            <Link href="/" className="transition-colors hover:text-background">
              AAM
            </Link>
            <span aria-hidden>/</span>
            <span className="text-background">{business.name}</span>
          </nav>
          <p className="mb-5 flex items-center gap-3 text-sm uppercase tracking-[0.3em] text-background/70">
            <ShoppingBag className="h-5 w-5" strokeWidth={1.5} />
            {business.eyebrow}
          </p>
          <h1 className="max-w-3xl text-balance font-serif text-5xl font-medium leading-[1.05] text-background sm:text-6xl">
            {business.tagline}
          </h1>
          <p className="mt-6 max-w-xl text-pretty text-lg leading-relaxed text-background/85">
            {business.description}
          </p>
        </div>
      </section>

      {/* Catalogue */}
      <section className="bg-background py-16 lg:py-20">
        <div className="mx-auto max-w-7xl px-6 lg:px-10">
          {/* Category filter + word search */}
          <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
            <div className="flex flex-wrap gap-2.5">
              {filters.map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => setFilter(f)}
                  className={`rounded-full border px-4 py-2 text-sm font-medium transition-colors ${
                    filter === f
                      ? 'border-primary bg-primary text-primary-foreground'
                      : 'border-border bg-card text-muted-foreground hover:border-accent/40 hover:text-foreground'
                  }`}
                >
                  {t(f)}
                </button>
              ))}
            </div>
            <div className="relative w-full sm:max-w-xs">
              <Search
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
                aria-hidden
              />
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t('Search by name or description…')}
                aria-label={t('Search by name or description…')}
                className="w-full rounded-full border border-border bg-card py-2 pl-9 pr-4 text-sm text-foreground placeholder:text-muted-foreground outline-none transition-colors focus:border-accent/40"
              />
            </div>
          </div>

          {/* Grid */}
          {visible.length === 0 ? (
            <p className="mt-10 text-sm text-muted-foreground">
              {t('No results for your search.')}
            </p>
          ) : (
            <div className="mt-10 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {visible.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          )}
        </div>
      </section>
    </main>
  )
}
