'use client'

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { PRODUCTS, type Product } from '@/lib/products'

export type CartItem = {
  product: Product
  quantity: number
}

type CartContextValue = {
  catalog: Product[]
  items: CartItem[]
  count: number
  subtotal: number
  isOpen: boolean
  openCart: () => void
  closeCart: () => void
  addItem: (productId: string, quantity?: number) => void
  removeItem: (productId: string) => void
  setQuantity: (productId: string, quantity: number) => void
  clear: () => void
}

const CartContext = createContext<CartContextValue | null>(null)
const STORAGE_KEY = 'aam-cart-v1'

/** Stored shape: { [productId]: quantity } */
type StoredCart = Record<string, number>

export function CartProvider({
  children,
  catalog = PRODUCTS,
}: {
  children: ReactNode
  catalog?: Product[]
}) {
  const [quantities, setQuantities] = useState<StoredCart>({})
  const [isOpen, setIsOpen] = useState(false)
  const [hydrated, setHydrated] = useState(false)

  // Load persisted cart on mount
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (raw) setQuantities(JSON.parse(raw) as StoredCart)
    } catch {
      // ignore malformed storage
    }
    setHydrated(true)
  }, [])

  // Persist on change (after initial hydration)
  useEffect(() => {
    if (!hydrated) return
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(quantities))
    } catch {
      // ignore quota / privacy-mode errors
    }
  }, [quantities, hydrated])

  const items = useMemo<CartItem[]>(() => {
    return Object.entries(quantities)
      .map(([id, quantity]) => {
        const product = catalog.find((p) => p.id === id)
        return product && quantity > 0 ? { product, quantity } : null
      })
      .filter((x): x is CartItem => x !== null)
  }, [quantities, catalog])

  const count = useMemo(
    () => items.reduce((sum, i) => sum + i.quantity, 0),
    [items],
  )
  const subtotal = useMemo(
    () => items.reduce((sum, i) => sum + i.product.price * i.quantity, 0),
    [items],
  )

  const value: CartContextValue = {
    catalog,
    items,
    count,
    subtotal,
    isOpen,
    openCart: () => setIsOpen(true),
    closeCart: () => setIsOpen(false),
    addItem: (productId, quantity = 1) => {
      setQuantities((prev) => ({
        ...prev,
        [productId]: (prev[productId] ?? 0) + quantity,
      }))
      setIsOpen(true)
    },
    removeItem: (productId) => {
      setQuantities((prev) => {
        const next = { ...prev }
        delete next[productId]
        return next
      })
    },
    setQuantity: (productId, quantity) => {
      setQuantities((prev) => {
        const next = { ...prev }
        if (quantity <= 0) delete next[productId]
        else next[productId] = quantity
        return next
      })
    },
    clear: () => setQuantities({}),
  }

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>
}

export function useCart() {
  const ctx = useContext(CartContext)
  if (!ctx) throw new Error('useCart must be used within a CartProvider')
  return ctx
}
