'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import { ShoppingBag } from 'lucide-react'
import { ProductCard } from '@/components/product-card'
import { PRODUCT_CATEGORIES, type ProductCategory } from '@/lib/products'
import { useCart } from '@/components/cart-context'
import { getBusiness } from '@/lib/businesses'

const business = getBusiness('shop')!

type Filter = 'All' | ProductCategory

export function ShopStorefront() {
  const { catalog } = useCart()
  const [filter, setFilter] = useState<Filter>('All')

  // Only show categories that actually have products.
  const filters: Filter[] = [
    'All',
    ...PRODUCT_CATEGORIES.filter((c) => catalog.some((p) => p.category === c)),
  ]
  const visible = useMemo(
    () =>
      filter === 'All'
        ? catalog
        : catalog.filter((p) => p.category === filter),
    [filter, catalog],
  )

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
          {/* Category filter */}
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
                {f}
              </button>
            ))}
          </div>

          {/* Grid */}
          <div className="mt-10 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {visible.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        </div>
      </section>
    </main>
  )
}
