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
): string | null {
  if (!fx || !fx.arPerEur || !fx.arPerZar || !(eur > 0)) return null
  const ar = Math.round(eur * fx.arPerEur)
  const zar = Math.round((eur * fx.arPerEur) / fx.arPerZar)
  return `Ar ${ar.toLocaleString('en-GB')} · R ${zar.toLocaleString('en-GB')}`
}

export function ShopPriceAlt({
  eur,
  className = '',
}: {
  eur: number
  className?: string
}) {
  const fx = useShopFx()
  const text = shopFxText(eur, fx)
  if (!text) return null
  return (
    <span
      className={`block text-xs tabular-nums text-muted-foreground ${className}`}
    >
      {text}
    </span>
  )
}
