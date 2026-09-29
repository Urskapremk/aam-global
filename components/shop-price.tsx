'use client'

import useSWR from 'swr'
import { getShopFxRates } from '@/app/actions/shop-fx'
import type { ConversionRates } from '@/lib/currency'

export function useShopFx() {
  const { data } = useSWR('shop-fx-rates', getShopFxRates, {
    revalidateOnFocus: false,
    dedupingInterval: 60 * 60 * 1000,
  })
  return data
}

export function shopFxText(
  eur: number,
  fx: ConversionRates | null | undefined,
  exactAr?: number,
): string | null {
  if (!fx || !fx.arPerEur || !fx.arPerZar) return null
  const ar = exactAr && exactAr > 0 ? exactAr : Math.round(eur * fx.arPerEur)
  if (!(ar > 0)) return null
  const zar = Math.round(ar / fx.arPerZar)
  return `Ar ${ar.toLocaleString('en-GB')} · R ${zar.toLocaleString('en-GB')}`
}

export function ShopPriceAlt({
  eur,
  ar,
  className = '',
}: {
  eur: number
  /** Exact Ariary amount when known (base currency) */
  ar?: number
  className?: string
}) {
  const fx = useShopFx()
  const text = shopFxText(eur, fx, ar)
  if (!text) return null
  return (
    <span
      className={`block text-xs tabular-nums text-muted-foreground ${className}`}
    >
      {text}
    </span>
  )
}
