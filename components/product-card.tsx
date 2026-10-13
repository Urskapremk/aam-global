'use client'

import { useEffect, useId, useState } from 'react'
import { Plus, X, ZoomIn } from 'lucide-react'
import { useCart } from '@/components/cart-context'
import { formatEur, type Product } from '@/lib/products'
import { ShopPriceAlt } from '@/components/shop-price'

export function ProductCard({ product }: { product: Product }) {
  const { addItem } = useCart()
  const [showSecond, setShowSecond] = useState(false)
  const [lightboxOpen, setLightboxOpen] = useState(false)
  const titleId = useId()

  const imageSrc =
    (showSecond && product.image2) || product.image || '/placeholder.svg'

  useEffect(() => {
    if (!lightboxOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setLightboxOpen(false)
    }
    document.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [lightboxOpen])

  return (
    <article className="group flex flex-col overflow-hidden rounded-2xl border border-border bg-card transition-all hover:border-accent/40 hover:shadow-lg hover:shadow-primary/5">
      <div className="relative aspect-square overflow-hidden bg-secondary">
        <button
          type="button"
          onClick={() => setLightboxOpen(true)}
          className="absolute inset-0 z-0 cursor-zoom-in focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-inset"
          aria-label={`View full image of ${product.name}`}
        >
          <img
            src={imageSrc}
            alt={product.alt}
            className="h-full w-full object-contain transition-transform duration-500 group-hover:scale-[1.02]"
          />
          <span className="pointer-events-none absolute bottom-3 right-3 flex h-8 w-8 items-center justify-center rounded-full bg-background/85 text-muted-foreground opacity-0 shadow-sm backdrop-blur transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
            <ZoomIn className="h-4 w-4" strokeWidth={1.75} aria-hidden />
          </span>
        </button>
        {product.image2 && (
          <div className="absolute bottom-3 left-1/2 z-10 flex -translate-x-1/2 gap-1.5 rounded-full bg-background/80 px-2 py-1.5 backdrop-blur">
            {[false, true].map((second) => (
              <button
                key={String(second)}
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  setShowSecond(second)
                }}
                aria-label={second ? 'Show second photo' : 'Show first photo'}
                aria-pressed={showSecond === second}
                className={`h-2 w-2 rounded-full transition-colors ${
                  showSecond === second ? 'bg-foreground' : 'bg-foreground/30 hover:bg-foreground/60'
                }`}
              />
            ))}
          </div>
        )}
        <span className="pointer-events-none absolute left-3 top-3 z-10 rounded-full bg-background/90 px-3 py-1 text-xs font-medium tracking-wide text-muted-foreground backdrop-blur">
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

      {lightboxOpen && (
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm sm:p-8"
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          onClick={() => setLightboxOpen(false)}
        >
          <div
            className="relative flex max-h-full w-full max-w-4xl flex-col items-center"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex w-full items-center justify-between gap-3">
              <p
                id={titleId}
                className="truncate font-serif text-lg text-background sm:text-xl"
              >
                {product.name}
              </p>
              <button
                type="button"
                onClick={() => setLightboxOpen(false)}
                aria-label="Close full image"
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-background/15 text-background transition-colors hover:bg-background/25"
              >
                <X className="h-5 w-5" strokeWidth={1.5} />
              </button>
            </div>
            <img
              src={imageSrc}
              alt={product.alt}
              className="max-h-[min(80vh,720px)] w-full rounded-xl bg-secondary object-contain shadow-lg"
            />
            {product.image2 && (
              <div className="mt-4 flex gap-2">
                {[false, true].map((second) => (
                  <button
                    key={String(second)}
                    type="button"
                    onClick={() => setShowSecond(second)}
                    aria-label={second ? 'Show second photo' : 'Show first photo'}
                    aria-pressed={showSecond === second}
                    className={`h-2.5 w-2.5 rounded-full transition-colors ${
                      showSecond === second
                        ? 'bg-background'
                        : 'bg-background/40 hover:bg-background/70'
                    }`}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </article>
  )
}
