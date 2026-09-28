// Shared currency helpers.
//
// Ariary (Ar / MGA) is the only currency the lodge bills and stores. EUR and
// ZAR (Rand) are shown alongside Ar amounts purely as a reference so the owner
// can gauge the size of a cost. The conversion rate comes from getFxRates()
// (live daily rate, manual fallback) — see app/actions/fuel.ts.
//
// These helpers are intentionally decoupled from the FxRates server type: they
// take a plain { arPerEur, arPerZar } object so both server components and
// client components can import them without pulling in a 'use server' module.

export type ConversionRates = { arPerEur: number; arPerZar: number }

export const numLocale = (lang: string) => (lang === 'sl' ? 'sl-SI' : 'en-GB')

// "1.234.567 Ar" (sl) / "1,234,567 Ar" (en). Rounds to whole Ariary.
export const formatAr = (n: number, lang: string) =>
  `${Math.round(n).toLocaleString(numLocale(lang))} Ar`

// Informational EUR + ZAR alongside an Ariary amount,
// e.g. "≈ 188 € · ≈ 3.600 R". Returns null when the amount or rates are
// missing (or non-positive rates) so callers can skip rendering it.
export const fxHint = (
  ar: number | null | undefined,
  fx: ConversionRates | null | undefined,
  lang: string,
): string | null => {
  if (ar == null || !fx || !fx.arPerEur || !fx.arPerZar) return null
  const eur = Math.round(ar / fx.arPerEur)
  const zar = Math.round(ar / fx.arPerZar)
  const loc = numLocale(lang)
  return `≈ ${eur.toLocaleString(loc)} € · ≈ ${zar.toLocaleString(loc)} R`
}

// Informational Ariary + ZAR alongside a EUR amount, e.g.
// "≈ 900.000 Ar · ≈ 3.600 R". For screens (like Odyssey pricing) whose base
// currency is EUR rather than Ar. Returns null when missing/non-positive.
export const eurHint = (
  eur: number | null | undefined,
  fx: ConversionRates | null | undefined,
  lang: string,
): string | null => {
  if (eur == null || !fx || !fx.arPerEur || !fx.arPerZar) return null
  const ar = Math.round(eur * fx.arPerEur)
  const zar = Math.round((eur * fx.arPerEur) / fx.arPerZar)
  const loc = numLocale(lang)
  return `≈ ${ar.toLocaleString(loc)} Ar · ≈ ${zar.toLocaleString(loc)} R`
}
