'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import useSWR from 'swr'
import { ShoppingCart, PackagePlus, ClipboardList, History, Loader2, X } from 'lucide-react'
import {
  recordStockMove,
  getStockMoves,
  type StockMoveKind,
} from '@/app/actions/shop-products'
import { useLang } from '@/lib/i18n/context'

const KIND_LABEL: Record<StockMoveKind, string> = {
  sale: 'Sale',
  receipt: 'Receipt',
  count: 'Stock count',
}

const CONFIRM_LABEL: Record<StockMoveKind, string> = {
  sale: 'Confirm sale',
  receipt: 'Confirm receipt',
  count: 'Confirm stock count',
}

const fmt = (n: number) => n.toLocaleString('en-GB')

export function ProductStock({
  productId,
  productName,
  stock,
  priceAr,
}: {
  productId: number
  productName: string
  stock: number | null
  priceAr: number
}) {
  const router = useRouter()
  const { t, lang } = useLang()
  const [mode, setMode] = useState<StockMoveKind | null>(null)
  const [qty, setQty] = useState('1')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showHistory, setShowHistory] = useState(false)

  const { data: moves, mutate } = useSWR(
    showHistory ? ['stock-moves', productId] : null,
    () => getStockMoves(productId),
  )

  const tone =
    stock === null
      ? 'text-muted-foreground'
      : stock <= 0
        ? 'text-red-600'
        : stock <= 2
          ? 'text-amber-600'
          : 'text-emerald-700'

  function open(kind: StockMoveKind) {
    setMode(kind)
    setQty(kind === 'count' ? String(stock ?? 0) : '1')
    setNote('')
    setError(null)
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!mode) return
    setBusy(true)
    setError(null)
    try {
      const res = await recordStockMove(productId, mode, Number(qty), note)
      if (!res.ok) {
        setError(res.error)
        return
      }
      setMode(null)
      router.refresh()
      if (showHistory) mutate()
    } finally {
      setBusy(false)
    }
  }

  const qtyNum = Math.max(0, Math.round(Number(qty) || 0))
  const pcs = t('pcs')

  return (
    <div className="rounded-lg border border-border p-3">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-sm text-muted-foreground">{t('Stock')}</span>
        <span className={`text-base font-semibold tabular-nums ${tone}`}>
          {stock === null ? t('not set') : `${fmt(stock)} ${pcs}`}
        </span>
      </div>

      <div className="mt-2 grid grid-cols-3 gap-1.5">
        <button
          type="button"
          onClick={() => open('sale')}
          disabled={stock === null || stock <= 0}
          className="inline-flex items-center justify-center gap-1 rounded-md bg-primary px-2 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-40"
        >
          <ShoppingCart className="h-3.5 w-3.5" /> {t('Sale')}
        </button>
        <button
          type="button"
          onClick={() => open('receipt')}
          className="inline-flex items-center justify-center gap-1 rounded-md border border-border px-2 py-1.5 text-xs font-medium text-foreground hover:bg-secondary"
        >
          <PackagePlus className="h-3.5 w-3.5" /> {t('Receipt')}
        </button>
        <button
          type="button"
          onClick={() => open('count')}
          className="inline-flex items-center justify-center gap-1 rounded-md border border-border px-2 py-1.5 text-xs font-medium text-foreground hover:bg-secondary"
        >
          <ClipboardList className="h-3.5 w-3.5" /> {t('Stock count')}
        </button>
      </div>

      {mode && (
        <form onSubmit={submit} className="mt-3 flex flex-col gap-2 rounded-md bg-secondary/60 p-2.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-foreground">
              {t(KIND_LABEL[mode])} · {productName}
            </span>
            <button
              type="button"
              onClick={() => setMode(null)}
              aria-label={t('Close')}
              className="text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <label className="flex items-center gap-2 text-xs text-muted-foreground">
            {mode === 'count' ? t('Actual count') : t('Quantity')}
            <input
              type="number"
              min={mode === 'count' ? 0 : 1}
              max={mode === 'sale' && stock !== null ? stock : undefined}
              value={qty}
              onChange={(e) => setQty(e.target.value)}
              className="w-20 rounded-md border border-border bg-background px-2 py-1 text-sm tabular-nums text-foreground"
              autoFocus
            />
            {pcs}
          </label>
          <input
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder={mode === 'sale' ? t('Buyer / note (optional)') : t('Note (optional)')}
            className="rounded-md border border-border bg-background px-2 py-1 text-sm text-foreground"
          />
          {mode === 'sale' && (
            <p className="text-xs tabular-nums text-muted-foreground">
              {qtyNum} × Ar {fmt(priceAr)} = Ar {fmt(qtyNum * priceAr)} · {t('left')}{' '}
              {Math.max(0, (stock ?? 0) - qtyNum)} {pcs}
            </p>
          )}
          {mode === 'receipt' && (
            <p className="text-xs tabular-nums text-muted-foreground">
              {t('New stock:')} {(stock ?? 0) + qtyNum} {pcs}
            </p>
          )}
          {error && <p className="text-xs text-red-600">{t(error)}</p>}
          <button
            type="submit"
            disabled={busy}
            className="inline-flex items-center justify-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            {t(CONFIRM_LABEL[mode])}
          </button>
        </form>
      )}

      <button
        type="button"
        onClick={() => setShowHistory((v) => !v)}
        className="mt-2 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
        aria-expanded={showHistory}
      >
        <History className="h-3.5 w-3.5" />
        {showHistory ? t('Hide history') : t('Stock history')}
      </button>

      {showHistory && (
        <ul className="mt-2 max-h-48 divide-y divide-border overflow-y-auto text-xs">
          {!moves && (
            <li className="py-2 text-muted-foreground">
              <Loader2 className="inline h-3.5 w-3.5 animate-spin" /> {t('Loading…')}
            </li>
          )}
          {moves?.length === 0 && (
            <li className="py-2 text-muted-foreground">{t('No stock movements yet.')}</li>
          )}
          {moves?.map((m) => (
            <li key={m.id} className="flex items-start justify-between gap-2 py-1.5">
              <div className="min-w-0">
                <p className="text-foreground">
                  {t(KIND_LABEL[m.kind])}
                  {m.kind === 'sale' && m.priceAr > 0 && (
                    <span className="text-muted-foreground">
                      {' '}
                      · Ar {fmt(Math.abs(m.delta) * m.priceAr)}
                    </span>
                  )}
                </p>
                <p className="truncate text-muted-foreground">
                  {new Date(m.createdAt).toLocaleDateString(lang === 'sl' ? 'sl-SI' : 'en-GB')}
                  {m.note && ` · ${m.note}`}
                </p>
              </div>
              <div className="shrink-0 text-right tabular-nums">
                <p className={m.delta < 0 ? 'text-red-600' : 'text-emerald-700'}>
                  {m.delta > 0 ? '+' : ''}
                  {m.delta}
                </p>
                <p className="text-muted-foreground">→ {m.stockAfter}</p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
