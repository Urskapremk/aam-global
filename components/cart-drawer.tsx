'use client'

import { useEffect } from 'react'
import { X, Minus, Plus, Trash2, ShoppingBag, MessageCircle } from 'lucide-react'
import { useCart } from '@/components/cart-context'
import { formatEur } from '@/lib/products'
import { saveInboundMessage } from '@/app/actions/messages'

// AAM WhatsApp order line (digits only, international format)
const WHATSAPP_NUMBER = '27827777324'

export function CartDrawer() {
  const { items, subtotal, count, isOpen, closeCart, setQuantity, removeItem } =
    useCart()

  // Lock body scroll while the drawer is open
  useEffect(() => {
    if (!isOpen) return
    const original = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = original
    }
  }, [isOpen])

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeCart()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [isOpen, closeCart])

  function handleCheckout() {
    const lines = items.map(
      (i) =>
        `• ${i.quantity} × ${i.product.name} — ${formatEur(i.product.price * i.quantity)}`,
    )
    const message = [
      'Hello AAM, I would like to order:',
      '',
      ...lines,
      '',
      `Total: ${formatEur(subtotal)}`,
    ].join('\n')

    // Keep a copy of the order in the admin inbox (best-effort, non-blocking).
    void saveInboundMessage({
      source: 'order',
      name: 'Website order (WhatsApp)',
      email: '',
      subject: `New order — ${formatEur(subtotal)}`,
      body: message,
      meta: {
        lines: items.map((i) => ({
          name: i.product.name,
          quantity: i.quantity,
          lineTotal: i.product.price * i.quantity,
        })),
        total: subtotal,
      },
    }).catch(() => {})

    const url = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`
    window.open(url, '_blank', 'noopener,noreferrer')
  }

  return (
    <div
      className={`fixed inset-0 z-[60] ${isOpen ? '' : 'pointer-events-none'}`}
      aria-hidden={!isOpen}
    >
      {/* Overlay */}
      <div
        onClick={closeCart}
        className={`absolute inset-0 bg-primary/40 backdrop-blur-sm transition-opacity duration-300 ${
          isOpen ? 'opacity-100' : 'opacity-0'
        }`}
      />

      {/* Panel */}
      <aside
        role="dialog"
        aria-label="Shopping cart"
        className={`absolute right-0 top-0 flex h-full w-full max-w-md flex-col bg-background shadow-2xl transition-transform duration-300 ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <header className="flex items-center justify-between border-b border-border px-6 py-5">
          <div className="flex items-center gap-2.5">
            <ShoppingBag className="h-5 w-5 text-accent" strokeWidth={1.5} />
            <h2 className="font-serif text-xl font-medium text-foreground">
              Your cart{count > 0 ? ` (${count})` : ''}
            </h2>
          </div>
          <button
            type="button"
            onClick={closeCart}
              aria-label="Close cart"
              className="inline-flex h-11 w-11 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
          >
            <X className="h-5 w-5" />
          </button>
        </header>

        {items.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
            <span className="flex h-16 w-16 items-center justify-center rounded-full bg-secondary text-muted-foreground">
              <ShoppingBag className="h-7 w-7" strokeWidth={1.5} />
            </span>
            <p className="text-lg font-medium text-foreground">
              Your cart is empty
            </p>
            <p className="max-w-xs text-pretty text-sm leading-relaxed text-muted-foreground">
              Browse the gear store and add tackle, apparel, and accessories to
              your cart.
            </p>
            <button
              type="button"
              onClick={closeCart}
              className="mt-2 rounded-full bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
            >
              Continue shopping
            </button>
          </div>
        ) : (
          <>
            <ul className="flex-1 divide-y divide-border overflow-y-auto px-6">
              {items.map(({ product, quantity }) => (
                <li key={product.id} className="flex gap-4 py-5">
                  <div className="h-20 w-20 shrink-0 overflow-hidden rounded-lg border border-border bg-secondary">
                    <img
                      src={product.image || '/placeholder.svg'}
                      alt={product.alt}
                      className="h-full w-full object-cover"
                    />
                  </div>
                  <div className="flex min-w-0 flex-1 flex-col">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <h3 className="truncate text-sm font-medium text-foreground">
                          {product.name}
                        </h3>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {product.category}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeItem(product.id)}
                        aria-label={`Remove ${product.name}`}
                        className="-mr-2 inline-flex h-10 w-10 shrink-0 items-center justify-center text-muted-foreground transition-colors hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                    <div className="mt-auto flex items-center justify-between pt-2">
                      <div className="inline-flex items-center rounded-full border border-border">
                        <button
                          type="button"
                          onClick={() => setQuantity(product.id, quantity - 1)}
                          aria-label="Decrease quantity"
                          className="inline-flex h-10 w-10 items-center justify-center rounded-full text-muted-foreground transition-colors hover:text-foreground"
                        >
                          <Minus className="h-3.5 w-3.5" />
                        </button>
                        <span className="w-8 text-center text-sm font-medium tabular-nums text-foreground">
                          {quantity}
                        </span>
                        <button
                          type="button"
                          onClick={() => setQuantity(product.id, quantity + 1)}
                          aria-label="Increase quantity"
                          className="inline-flex h-10 w-10 items-center justify-center rounded-full text-muted-foreground transition-colors hover:text-foreground"
                        >
                          <Plus className="h-3.5 w-3.5" />
                        </button>
                      </div>
                      <span className="text-sm font-semibold tabular-nums text-foreground">
                        {formatEur(product.price * quantity)}
                      </span>
                    </div>
                  </div>
                </li>
              ))}
            </ul>

            <footer className="border-t border-border px-6 py-5">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Subtotal</span>
                <span className="font-serif text-2xl font-medium text-foreground tabular-nums">
                  {formatEur(subtotal)}
                </span>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                Shipping and duties calculated when we confirm your order.
              </p>
              <button
                type="button"
                onClick={handleCheckout}
                className="mt-4 flex w-full items-center justify-center gap-2 rounded-full bg-primary px-6 py-3.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
              >
                <MessageCircle className="h-4 w-4" />
                Place order via WhatsApp
              </button>
              <p className="mt-3 text-center text-xs text-muted-foreground">
                We confirm availability and payment directly with you.
              </p>
            </footer>
          </>
        )}
      </aside>
    </div>
  )
}
