/**
 * Shared L ↔ kg conversion for warehouse / caretaker fuel entry.
 * Density is kg per litre (petrol ≈ 0.74–0.76). Admin can override via fuel_config.
 */

export const DEFAULT_DENSITY_KG_PER_L = 0.75

export const WAREHOUSE_CAN_SIZES_L = [20, 25] as const
export const ODYSSEY_II_CAN_L = 25
export const ODYSSEY_II_MAX_CANS = 2

export function clampDensity(n: number | null | undefined): number {
  const v = Number(n)
  if (!Number.isFinite(v) || v <= 0) return DEFAULT_DENSITY_KG_PER_L
  // Guard absurd values so a typo cannot invert the conversion wildly.
  if (v < 0.5 || v > 1.2) return DEFAULT_DENSITY_KG_PER_L
  return v
}

export function litresFromKg(kg: number, densityKgPerL = DEFAULT_DENSITY_KG_PER_L): number {
  const d = clampDensity(densityKgPerL)
  return kg / d
}

export function kgFromLitres(litres: number, densityKgPerL = DEFAULT_DENSITY_KG_PER_L): number {
  const d = clampDensity(densityKgPerL)
  return litres * d
}

export function round1(n: number): number {
  return Math.round(n * 10) / 10
}
