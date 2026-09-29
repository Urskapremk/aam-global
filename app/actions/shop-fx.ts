'use server'

import { getFxRates } from './fuel'
import type { ConversionRates } from '@/lib/currency'

// Public, read-only subset of the exchange rate for the storefront — exposes
// only the two conversion factors, not the admin's manual-rate metadata.
export async function getShopFxRates(): Promise<ConversionRates> {
  const fx = await getFxRates()
  return { arPerEur: fx.arPerEur, arPerZar: fx.arPerZar }
}
