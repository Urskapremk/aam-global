'use client'

import { useState } from 'react'
import { Plus } from 'lucide-react'
import { useCart } from '@/components/cart-context'
import { formatEur, type Product } from '@/lib/products'
import { ShopPriceAlt } from '@/components/shop-price'

export function ProductCard({ product }: { product: Product }) {
  const { addItem } = useCart()
  const [showSecond, setShowSecond] = useState(false)

  return (
    <article className="group flex flex-col overflow-hidden rounded-2xl border border-border bg-card transition-all hover:border-accent/40 hover:shadow-lg hover:shadow-primary/5">
      <div className="relative aspect-square overflow-hidden bg-secondary">
        <img
          src={(showSecond && product.image2) || product.image || '/placeholder.svg'}
          alt={product.alt}
          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
        />
        {product.image2 && (
          <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 gap-1.5 rounded-full bg-background/80 px-2 py-1.5 backdrop-blur">
            {[false, true].map((second) => (
              <button
                key={String(second)}
                type="button"
                onClick={() => setShowSecond(second)}
                aria-label={second ? 'Show second photo' : 'Show first photo'}
                aria-pressed={showSecond === second}
                className={`h-2 w-2 rounded-full transition-colors ${
                  showSecond === second ? 'bg-foreground' : 'bg-foreground/30 hover:bg-foreground/60'
                }`}
              />
            ))}
          </div>
        )}
        <span className="absolute left-3 top-3 rounded-full bg-background/90 px-3 py-1 text-xs font-medium tracking-wide text-muted-foreground backdrop-blur">
          {product.category}
        </span>
      </div>

      <div className="flex flex-1 flex-col p-5">
        <h3 className="font-serif text-lg font-medium leading-snug text-foreground">
          {product.name}
        </h3>
        <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-muted-foreground">
          {product.description}
        </p>

        <div className="mt-4 flex items-center justify-between pt-1">
          <div className="flex flex-col">
            <span className="font-serif text-xl font-medium tabular-nums text-foreground">
              {formatEur(product.price)}{' '}
              <span className="font-sans text-xs font-normal text-muted-foreground">
                / piece
              </span>
            </span>
            <ShopPriceAlt eur={product.price} ar={product.priceAr} />
          </div>
          {product.soldOut ? (
            <span className="rounded-full border border-border px-4 py-2.5 text-sm font-medium text-muted-foreground">
              Sold out
            </span>
          ) : (
            <button
              type="button"
              onClick={() => addItem(product.id)}
              className="inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
            >
              <Plus className="h-4 w-4" />
              Add
            </button>
          )}
        </div>
      </div>
    </article>
  )
}
