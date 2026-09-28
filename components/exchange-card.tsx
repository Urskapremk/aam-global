'use client'

import { Check, Loader2, RefreshCw } from 'lucide-react'
import { useEffect, useState } from 'react'
import useSWR, { useSWRConfig } from 'swr'

import { getFxRates, setManualFxRates } from '@/app/actions/fuel'
import { numLocale } from '@/lib/currency'
import { useLang, useT } from '@/lib/i18n/context'

const inputCls =
  'min-h-11 w-full rounded-lg border border-border bg-card px-3 text-sm text-foreground'
const labelCls =
  'text-[10px] uppercase tracking-[0.14em] text-muted-foreground'

export function ExchangeCard() {
  const t = useT()
  const { lang } = useLang()
  const loc = numLocale(lang)
  const { mutate } = useSWRConfig()
  const fx = useSWR('fx-rates', getFxRates, {
    revalidateOnFocus: true,
    refreshInterval: 60 * 60 * 1000, // refresh hourly so the rate stays current
  })

  // Manual fallback edit fields. Seeded from the stored values once loaded.
  const [eur, setEur] = useState('')
  const [zar, setZar] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const d = fx.data
  useEffect(() => {
    if (d) {
      setEur(String(Math.round(d.manualArPerEur)))
      setZar(String(Math.round(d.manualArPerZar)))
    }
  }, [d])

  const num = (n: number) => Math.round(n).toLocaleString(loc)

  const save = async () => {
    const e = Number(eur.replace(',', '.'))
    const z = Number(zar.replace(',', '.'))
    if (!Number.isFinite(e) || !Number.isFinite(z) || e <= 0 || z <= 0) {
      setError(t('Enter a rate greater than zero for both.'))
      return
    }
    setError(null)
    setSaving(true)
    try {
      await setManualFxRates(e, z)
      await fx.mutate()
      // Every screen reads the rate through this same SWR key.
      await mutate('fx-rates')
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    } catch {
      setError(t('Could not save the rate.'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="overflow-hidden rounded-2xl border border-border bg-card">
      <header className="flex flex-wrap items-center justify-between gap-4 bg-panel-header p-5">
        <div>
          <p className="text-[10px] uppercase tracking-[0.22em] text-panel-header-foreground/40">
            {t('Exchange rate')}
          </p>
          <h2 className="mt-1 font-serif text-xl text-panel-header-foreground">
            {t('Ariary, Euro and Rand')}
          </h2>
        </div>
        {d && (
          <span
            className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.1em] ${
              d.live
                ? 'border-panel-header-foreground/30 bg-panel-header-foreground/15 text-panel-header-foreground'
                : 'border-accent/40 bg-accent/15 text-accent'
            }`}
          >
            <RefreshCw className="h-3.5 w-3.5" aria-hidden />
            {d.live ? t('Live rate') : t('Manual rate')}
          </span>
        )}
      </header>

      <div className="space-y-6 p-5">
        {fx.isLoading && (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            {t('Loading the rate…')}
          </p>
        )}

        {d && (
          <>
            {/* The effective rate in use, shown big so it is always visible. */}
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl border border-border bg-secondary/30 p-4">
                <p className={labelCls}>{t('Euro')}</p>
                <p className="mt-1 font-serif text-2xl text-foreground">
                  1 € = {num(d.arPerEur)} Ar
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  1 Ar = {(1 / d.arPerEur).toLocaleString(loc, {
                    maximumSignificantDigits: 2,
                  })}{' '}
                  €
                </p>
              </div>
              <div className="rounded-xl border border-border bg-secondary/30 p-4">
                <p className={labelCls}>{t('Rand')}</p>
                <p className="mt-1 font-serif text-2xl text-foreground">
                  1 R = {num(d.arPerZar)} Ar
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  1 € ≈ {num(d.arPerEur / d.arPerZar)} R
                </p>
              </div>
            </div>

            <p className="rounded-xl border border-border bg-secondary/40 p-3 text-[11px] leading-relaxed text-muted-foreground">
              {d.live
                ? t(
                    'The live market rate is used across all calculations. Your manual rate below is the fallback used only when the live rate cannot be fetched.',
                  )
                : t(
                    'The live rate could not be fetched, so your manual rate below is currently in use across all calculations.',
                  )}
            </p>

            {/* Manual fallback editor. */}
            <div>
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-accent">
                {t('Manual rate (fallback)')}
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className={labelCls}>{t('Ar per 1 EUR')}</label>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={eur}
                    onChange={(e) => setEur(e.target.value)}
                    placeholder="4800"
                    className={`mt-1.5 ${inputCls}`}
                  />
                </div>
                <div>
                  <label className={labelCls}>{t('Ar per 1 Rand')}</label>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={zar}
                    onChange={(e) => setZar(e.target.value)}
                    placeholder="250"
                    className={`mt-1.5 ${inputCls}`}
                  />
                </div>
              </div>
              {error && (
                <p className="mt-2 text-xs text-destructive">{error}</p>
              )}
              <div className="mt-3 flex items-center gap-3">
                <button
                  type="button"
                  onClick={save}
                  disabled={saving}
                  className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-lg bg-panel-header px-4 text-sm font-medium text-panel-header-foreground transition-colors hover:bg-panel-header-hover disabled:opacity-60"
                >
                  {saving ? (
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                  ) : saved ? (
                    <Check className="h-4 w-4" aria-hidden />
                  ) : null}
                  {saved ? t('Saved') : t('Save rate')}
                </button>
                {d.manualUpdatedAt && (
                  <span className="text-xs text-muted-foreground">
                    {t('Updated')}{' '}
                    {new Date(d.manualUpdatedAt).toLocaleDateString(loc, {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                    })}
                  </span>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </section>
  )
}
