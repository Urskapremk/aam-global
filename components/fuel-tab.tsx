'use client'

import {
  AlertTriangle,
  Archive,
  Banknote,
  Camera,
  Check,
  ChevronDown,
  Container,
  CreditCard,
  Droplet,
  Gauge,
  ImageIcon,
  Loader2,
  Receipt,
  RotateCcw,
  Ship,
  Smartphone,
  Trash2,
  TrendingDown,
  TrendingUp,
  Truck,
  Warehouse,
  X,
} from 'lucide-react'
import { useRef, useState } from 'react'
import useSWR, { useSWRConfig } from 'swr'

import {
  deleteBoatFuelReading,
  deleteFuelEntry,
  deleteFuelProcurement,
  getArchivedBoatReadings,
  getArchivedFuelEntries,
  getArchivedFuelProcurements,
  getBoatFuelState,
  getFuelProcurements,
  getFuelState,
  getFuelTotals,
  getFxRates,
  type FxRates,
  logBoatFuelReading,
  logFuelAdjustment,
  logFuelDelivery,
  logFuelPurchase,
  logFuelRefuel,
  receiveFuelPurchase,
  restoreBoatFuelReading,
  restoreFuelEntry,
  restoreFuelProcurement,
  setFuelReorderLevel,
  type BoatFuelReading,
  type BoatFuelSummary,
  type FuelEntry,
  type FuelInputUnit,
  type FuelProcurement,
  type FuelReadingKind,
  type PaymentMethod,
} from '@/app/actions/fuel'
import { uploadImage } from '@/app/actions/upload'
import { BOATS, boatEngineSlots, type EngineSlot } from '@/lib/boats'
import { shrinkImageToDataUrl, dataUrlToFile } from '@/lib/image-client'
import { DUE_TONE } from '@/lib/maintenance'
import { useLang, useT } from '@/lib/i18n/context'

// Number/date locale follows the chosen language: Slovenian uses a dot for
// thousands and a comma for decimals, which the drum figures should respect.
const numLocale = (lang: string) => (lang === 'sl' ? 'sl-SI' : 'en-GB')

const dateFmt = (iso: string, lang: string) =>
  new Date(iso).toLocaleDateString(numLocale(lang), {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })

// Date + time in the lodge's timezone, for the expanded entry detail.
const dateTimeFmt = (iso: string, lang: string) =>
  new Date(iso).toLocaleString(numLocale(lang), {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Indian/Antananarivo',
  })

const litres = (n: number, lang: string) =>
  // At most one decimal — kg/cans conversions can produce long fractions.
  `${(Math.round(n * 10) / 10).toLocaleString(numLocale(lang), { maximumFractionDigits: 1 })} L`
const ariary = (n: number, lang: string) =>
  `${Math.round(n).toLocaleString(numLocale(lang))} Ar`

// Informational EUR + ZAR alongside an Ariary amount, e.g. "≈ 188 € · ≈ 3.600 R".
// Returns null when the amount or rates are missing so callers can skip it.
const fxHint = (ar: number | null, fx: FxRates | undefined, lang: string) => {
  if (ar == null || !fx) return null
  const eur = Math.round(ar / fx.arPerEur)
  const zar = Math.round(ar / fx.arPerZar)
  const loc = numLocale(lang)
  return `≈ ${eur.toLocaleString(loc)} € · ≈ ${zar.toLocaleString(loc)} R`
}

// Petrol weighs ~0.74–0.76 kg per litre, so a full 25 L can is ≈ 18.5–19 kg.
// Shown as a range to help judge how heavy a canister load is to carry.
const PETROL_KG_PER_L_LOW = 0.74
const PETROL_KG_PER_L_HIGH = 0.76
// Single midpoint density used to auto-convert litres <-> kilograms in the
// reading form. Sits inside the 0.74–0.76 range above.
const PETROL_KG_PER_L = 0.75
const weightHint = (litresVal: number | null, lang: string) => {
  if (litresVal == null || litresVal <= 0) return null
  const loc = numLocale(lang)
  const low = Math.round(litresVal * PETROL_KG_PER_L_LOW)
  const high = Math.round(litresVal * PETROL_KG_PER_L_HIGH)
  const range =
    low === high
      ? low.toLocaleString(loc)
      : `${low.toLocaleString(loc)}–${high.toLocaleString(loc)}`
  return `≈ ${range} kg`
}

// Human summary of how a refuel was entered, e.g. "3 × 20 L cans" or "25 kg".
// Returns null when the entry was a plain litres entry (or a legacy row), since
// then the signed litres figure already says everything.
const inputSummary = (e: FuelEntry, lang: string): string | null => {
  if (!e.inputUnit || e.inputQty == null || e.inputUnit === 'litres') return null
  const loc = numLocale(lang)
  const q = e.inputQty.toLocaleString(loc)
  if (e.inputUnit === 'kg') return `${q} kg`
  const size = (e.canSizeL ?? 0).toLocaleString(loc)
  const canWord = lang === 'sl' ? 'kant' : 'cans'
  return `${q} × ${size} L ${canWord}`
}

// The three ways the owner pays at the station. Labels are English source
// strings (translated through t()); Orange Money keeps its brand name.
const PAYMENT_METHODS = [
  { key: 'cash' as const, label: 'Cash', icon: Banknote },
  { key: 'orange_money' as const, label: 'Orange Money', icon: Smartphone },
  { key: 'card' as const, label: 'Card', icon: CreditCard },
]
const paymentLabel = (m: PaymentMethod | null) =>
  PAYMENT_METHODS.find((p) => p.key === m)?.label ?? null

// Stock health maps onto the app's established tones: sage when comfortable,
// amber at/under the reorder level, bordeaux when empty. Grey when no level is
// set, because then "healthy" is not something we can honestly claim.
function stockTone(stockLitres: number, reorderLitres: number) {
  if (reorderLitres <= 0) return DUE_TONE.unknown
  if (stockLitres <= 0) return DUE_TONE.overdue
  if (stockLitres <= reorderLitres) return DUE_TONE.due
  return DUE_TONE.ok
}

type Mode = 'delivery' | 'refuel' | 'adjust' | 'reorder' | null

export function FuelTab() {
  const { t, lang } = useLang()
  const { mutate: globalMutate } = useSWRConfig()
  const data = useSWR('fuel', () => getFuelState(), {
    refreshInterval: 120000,
    revalidateOnFocus: true,
  })
  const [mode, setMode] = useState<Mode>(null)

  // Any warehouse change also shifts the combined total, so refresh it too.
  const refresh = () => {
    data.mutate()
    globalMutate('fuel-totals')
  }

  const d = data.data
  const tone = d ? stockTone(d.stockLitres, d.reorderLitres) : DUE_TONE.unknown

  const monthLabel = d
    ? new Date(`${d.month}-01T00:00:00Z`).toLocaleDateString(
        lang === 'sl' ? 'sl-SI' : 'en-GB',
        { month: 'long', year: 'numeric' },
      )
    : ''

  return (
    <div className="space-y-6">
    {/* Combined stock: warehouse + every boat, at the very top. */}
    <FuelTotalsPanel />

    <section className="overflow-hidden rounded-2xl border border-border bg-card">
      <header className="flex flex-wrap items-center justify-between gap-4 bg-panel-header p-5">
        <div>
          <p className="text-[10px] uppercase tracking-[0.22em] text-panel-header-foreground/40">
            {t('Fuel')}
          </p>
          <h2 className="mt-1 font-serif text-xl text-panel-header-foreground">
            {t('Fuel store')}
          </h2>
        </div>
        {d && (
          <span
            className="inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-semibold"
            style={{ color: tone.fg, backgroundColor: tone.bg, borderColor: tone.border }}
          >
            <Droplet className="h-4 w-4" aria-hidden />
            {litres(d.stockLitres, lang)}
          </span>
        )}
      </header>

      <div className="space-y-6 p-5">
        {data.isLoading && (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            {t('Reading the fuel log…')}
          </p>
        )}
        {data.error && (
          <p className="text-sm" style={{ color: DUE_TONE.overdue.fg }}>
            {t('Could not load the fuel log.')}
          </p>
        )}

        {d && (
          <>
            {/* Low / empty banner, first and unmissable. */}
            {d.low && (
              <div
                className="rounded-xl border p-4"
                style={{ borderColor: tone.border, backgroundColor: tone.bg }}
              >
                <p
                  className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em]"
                  style={{ color: tone.fg }}
                >
                  <AlertTriangle className="h-4 w-4" aria-hidden />
                  {d.stockLitres <= 0
                    ? t('Fuel drums are empty')
                    : t('Fuel is low')}
                </p>
                <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                  {t('Stock is')} {litres(d.stockLitres, lang)},{' '}
                  {t('at or below the reorder level of')}{' '}
                  {litres(d.reorderLitres, lang)}. {t('Time to order fuel.')}
                </p>
              </div>
            )}

            {/* The honesty note: stock is litres in the drums, kept by hand.
                It is deliberately not tied to the boats' fuel %, because no tank
                capacity in litres is known — a converted figure would be made up. */}
            <p className="rounded-xl border border-border bg-secondary/40 p-3 text-[11px] leading-relaxed text-muted-foreground">
              {t(
                "Stock is the fuel in the drums on land, in litres, kept from the deliveries and refuels logged here. The boats' own fuel gauges read in percentage and are recorded per trip — they are not the same measure and are not mixed in.",
              )}
            </p>

            {/* This month at a glance. */}
            <div>
              <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                {monthLabel}
              </p>
              <div className="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-4">
                <Stat
                  label={t('Delivered')}
                  value={litres(d.thisMonth.deliveredLitres, lang)}
                  icon={<TrendingUp className="h-4 w-4" aria-hidden />}
                />
                <Stat
                  label={t('Into boats')}
                  value={litres(d.thisMonth.refuelledLitres, lang)}
                  icon={<TrendingDown className="h-4 w-4" aria-hidden />}
                />
                <Stat
                  label={t('Fuel spend')}
                  value={
                    d.thisMonth.spendAr > 0
                      ? ariary(d.thisMonth.spendAr, lang)
                      : '����'
                  }
                  hint={
                    d.thisMonth.spendAr > 0
                      ? undefined
                      : d.thisMonth.deliveries > 0
                        ? t('no cost entered')
                        : undefined
                  }
                />
                <Stat
                  label={t('Reorder level')}
                  value={
                    d.reorderLitres > 0
                      ? litres(d.reorderLitres, lang)
                      : t('not set')
                  }
                />
              </div>
            </div>

            {/* Quick actions. */}
            <div className="flex flex-wrap gap-2">
              <ActionButton
                active={mode === 'delivery'}
                onClick={() => setMode(mode === 'delivery' ? null : 'delivery')}
              >
                <TrendingUp className="h-3.5 w-3.5" aria-hidden />
                {t('Log delivery')}
              </ActionButton>
              <ActionButton
                active={mode === 'refuel'}
                onClick={() => setMode(mode === 'refuel' ? null : 'refuel')}
              >
                <Ship className="h-3.5 w-3.5" aria-hidden />
                {t('Log refuel')}
              </ActionButton>
              <ActionButton
                active={mode === 'adjust'}
                onClick={() => setMode(mode === 'adjust' ? null : 'adjust')}
              >
                {t('Adjust')}
              </ActionButton>
              <ActionButton
                active={mode === 'reorder'}
                onClick={() => setMode(mode === 'reorder' ? null : 'reorder')}
              >
                {t('Reorder level')}
              </ActionButton>
            </div>

            {mode && (
              <FuelForm
                mode={mode}
                current={d.reorderLitres}
                onDone={() => {
                  setMode(null)
                  refresh()
                }}
                onCancel={() => setMode(null)}
              />
            )}

            {/* Ledger. */}
            <div>
              <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                {t('Recent movements')}
              </p>
              {d.entries.length === 0 ? (
                <p className="mt-3 text-sm text-muted-foreground">
                  {t(
                    'Nothing logged yet. Log a delivery to set your starting stock.',
                  )}
                </p>
              ) : (
                <ul className="mt-3 divide-y divide-border">
                  {d.entries.map((e) => (
                    <LedgerRow key={e.id} entry={e} onDeleted={refresh} />
                  ))}
                </ul>
              )}
            </div>

            {/* Archive: nothing is ever hard-deleted, it moves here. */}
            <WarehouseArchive onRestored={refresh} />
          </>
        )}
      </div>
    </section>

      {/* Fuel procurement — pay at the station, then receive in cans. */}
      <ProcurementSection />

      {/* Per-boat fuel ledger — separate evidence for each boat. */}
      <BoatFuelSection />
    </div>
  )
}

function BoatFuelSection() {
  const { t } = useLang()
  const { mutate: globalMutate } = useSWRConfig()
  const data = useSWR('boat-fuel', () => getBoatFuelState(), {
    refreshInterval: 120000,
    revalidateOnFocus: true,
  })
  const d = data.data

  // A boat reading also shifts the combined total.
  const refresh = () => {
    data.mutate()
    globalMutate('fuel-totals')
  }

  return (
    <section className="overflow-hidden rounded-2xl border border-border bg-card">
      <header className="bg-panel-header p-5">
        <p className="text-[10px] uppercase tracking-[0.22em] text-panel-header-foreground/40">
          {t('Fuel')}
        </p>
        <h2 className="mt-1 font-serif text-xl text-panel-header-foreground">
          {t('Fuel on board — per boat')}
        </h2>
      </header>

      <div className="space-y-5 p-5">
        <p className="rounded-xl border border-border bg-secondary/40 p-3 text-[11px] leading-relaxed text-muted-foreground">
          {t(
            'Each boat keeps its own record of the fuel on board — measured before a trip, after a trip, or on a surprise spot-check. Fuel is tracked in litres and kilograms side by side (some checks are weighed, others gauged); the two are never converted into each other.',
          )}
        </p>

        {data.isLoading && (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            {t('Reading the fuel log…')}
          </p>
        )}
        {data.error && (
          <p className="text-sm" style={{ color: DUE_TONE.overdue.fg }}>
            {t('Could not load the fuel log.')}
          </p>
        )}

        {d &&
          d.boats.map((b) => (
            <BoatFuelCard key={b.boat} boat={b} onChanged={refresh} />
          ))}

        {/* Archive of removed per-boat readings, restorable. */}
        <BoatArchive onRestored={refresh} />
      </div>
    </section>
  )
}

const READING_KIND_LABELS: Record<FuelReadingKind, string> = {
  'trip-start': 'Before trip',
  'trip-end': 'After trip',
  'spot-check': 'Spot-check',
}

// Tank/engine labels for twin-engine boats. These mirror the engine names in
// the Maintenance tab (Port = left hull, Starboard = right hull) so the two
// screens agree. Kept in English in both languages, exactly like Maintenance,
// which stores them as free text and does not translate them.
const ENGINE_LABELS: Record<EngineSlot, string> = {
  left: 'Port engine',
  right: 'Starboard engine',
}

// Litres / kilograms formatters that stay silent when the figure is absent.
function fmtL(n: number | null, lang: string) {
  return n == null ? null : `${n.toLocaleString(numLocale(lang))} L`
}
function fmtKg(n: number | null, lang: string) {
  return n == null ? null : `${n.toLocaleString(numLocale(lang))} kg`
}
function bothOrDash(l: string | null, kg: string | null) {
  const parts = [l, kg].filter(Boolean) as string[]
  return parts.length ? parts.join(' · ') : '—'
}

function BoatFuelCard({
  boat,
  onChanged,
}: {
  boat: BoatFuelSummary
  onChanged: () => void
}) {
  const { t, lang } = useLang()
  const [adding, setAdding] = useState(false)
  const [open, setOpen] = useState(false)

  const onBoard = bothOrDash(
    fmtL(boat.lastLitres, lang),
    fmtKg(boat.lastKilograms, lang),
  )
  const used = boat.lastTrip
    ? bothOrDash(
        fmtL(boat.lastTrip.usedLitres, lang),
        fmtKg(boat.lastTrip.usedKilograms, lang),
      )
    : null

  return (
    <div className="rounded-xl border border-border bg-secondary/20">
      {/* Card header: boat name + current on-board figure. */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border p-4">
        <div className="flex items-center gap-2">
          <Ship className="h-4 w-4 text-accent" aria-hidden />
          <span className="font-serif text-lg text-foreground">
            {boat.boatLabel}
          </span>
          {boat.internal && (
            <span className="rounded-full border border-border px-2 py-0.5 text-[9px] uppercase tracking-[0.14em] text-muted-foreground">
              {t('Internal')}
            </span>
          )}
        </div>
        <div className="text-right">
          <p className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
            {t('On board')}
          </p>
          <p className="text-base font-semibold tabular-nums text-foreground">
            {onBoard}
          </p>
          {/* Per-engine breakdown on twin-engine boats: the total above is the
              sum of these two tanks. */}
          {boat.engines && (
            <div className="mt-1 flex flex-col items-end gap-0.5">
              {boat.engines.map((e) => (
                <p
                  key={e.slot}
                  className="text-[10px] tabular-nums text-muted-foreground"
                >
                  <span className="uppercase tracking-[0.1em]">
                    {t(ENGINE_LABELS[e.slot])}
                  </span>{' '}
                  <span className="text-foreground">
                    {bothOrDash(
                      fmtL(e.lastLitres, lang),
                      fmtKg(e.lastKilograms, lang),
                    )}
                  </span>
                </p>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Last completed trip's consumption, when known. */}
      {boat.lastTrip && (
        <div className="flex items-center gap-2 border-b border-border px-4 py-2.5">
          <TrendingDown
            className="h-3.5 w-3.5 flex-shrink-0"
            style={{ color: DUE_TONE.soon.fg }}
            aria-hidden
          />
          <span className="text-[11px] text-muted-foreground">
            {t('Last trip used')}{' '}
            <span className="font-semibold text-foreground">{used}</span>
            {' · '}
            {dateFmt(boat.lastTrip.endAt, lang)}
          </span>
        </div>
      )}

      <div className="p-4">
        <div className="flex flex-wrap items-center gap-2">
          <ActionButton active={adding} onClick={() => setAdding((v) => !v)}>
            <Droplet className="h-3.5 w-3.5" aria-hidden />
            {t('Add reading')}
          </ActionButton>
          {boat.readings.length > 0 && (
            <button
              type="button"
              onClick={() => setOpen((v) => !v)}
              className="min-h-11 cursor-pointer rounded-full border border-border bg-card px-4 text-[10px] font-semibold uppercase tracking-[0.14em] text-foreground hover:bg-secondary"
            >
              {open
                ? t('Hide history')
                : `${t('History')} · ${boat.readings.length}`}
            </button>
          )}
        </div>

        {adding && (
          <BoatReadingForm
            boat={boat.boat}
            onDone={() => {
              setAdding(false)
              onChanged()
            }}
            onCancel={() => setAdding(false)}
          />
        )}

        {open && boat.readings.length > 0 && (
          <ul className="mt-3 divide-y divide-border">
            {boat.readings.map((r) => (
              <BoatReadingRow key={r.id} reading={r} onDeleted={onChanged} />
            ))}
          </ul>
        )}

        {boat.readings.length === 0 && !adding && (
          <p className="mt-3 text-[11px] text-muted-foreground">
            {t('No readings yet. Add a before-trip reading to start.')}
          </p>
        )}
      </div>
    </div>
  )
}

function BoatReadingForm({
  boat,
  onDone,
  onCancel,
}: {
  boat: string
  onDone: () => void
  onCancel: () => void
}) {
  const t = useT()
  const slots = boatEngineSlots(boat)
  // Field groups: one per tank on a twin-engine boat, or a single unlabelled
  // group ('_') on a one-tank boat.
  const groups: (EngineSlot | '_')[] = slots.length ? slots : ['_']

  const [kind, setKind] = useState<FuelReadingKind>('trip-start')
  // Litres/kilograms are held per group so each tank is independent.
  const [vals, setVals] = useState<Record<string, { l: string; kg: string }>>(
    () => Object.fromEntries(groups.map((g) => [g, { l: '', kg: '' }])),
  )
  const [who, setWho] = useState('')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const kinds: FuelReadingKind[] = ['trip-start', 'trip-end', 'spot-check']

  // Litres and kilograms are linked: typing one fills the other via the petrol
  // density. Clearing one clears both. A non-numeric partial entry (e.g. "12,")
  // leaves the paired field untouched until it parses. The programmatic update
  // does not fire onChange, so there is no feedback loop.
  const setVal = (g: string, field: 'l' | 'kg', v: string) =>
    setVals((prev) => {
      const cur = prev[g] ?? { l: '', kg: '' }
      const next = { ...cur, [field]: v }
      const other = field === 'l' ? 'kg' : 'l'
      const trimmed = v.trim()
      if (trimmed === '') {
        next[other] = ''
      } else {
        const num = Number(trimmed.replace(',', '.'))
        if (Number.isFinite(num) && num >= 0) {
          const converted =
            field === 'l' ? num * PETROL_KG_PER_L : num / PETROL_KG_PER_L
          next[other] = String(Math.round(converted * 10) / 10)
        }
      }
      return { ...prev, [g]: next }
    })

  async function submit() {
    setBusy(true)
    setErr(null)
    try {
      // Save each tank that has at least one figure as its own reading.
      const toSave = groups
        .map((g) => ({ g, l: vals[g]?.l ?? '', kg: vals[g]?.kg ?? '' }))
        .filter((x) => x.l !== '' || x.kg !== '')
      if (toSave.length === 0) {
        throw new Error(t('Enter litres, kilograms, or both'))
      }
      for (const x of toSave) {
        await logBoatFuelReading({
          boat,
          kind,
          engineSlot: x.g === '_' ? null : (x.g as EngineSlot),
          litres: x.l === '' ? null : Number(x.l),
          kilograms: x.kg === '' ? null : Number(x.kg),
          loggedBy: who,
          note,
        })
      }
      onDone()
    } catch (e) {
      setErr(e instanceof Error ? e.message : t('Could not save'))
      setBusy(false)
    }
  }

  return (
    <div className="mt-3 rounded-xl border border-border bg-secondary/30 p-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-foreground">
          {t('New fuel reading')}
        </p>
        <button
          type="button"
          onClick={onCancel}
          aria-label={t('Close')}
          className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full text-muted-foreground hover:bg-secondary"
        >
          <X className="h-4 w-4" aria-hidden />
        </button>
      </div>

      {/* Reading kind — the surprise spot-check is a first-class option. */}
      <div className="mt-3 flex flex-wrap gap-2">
        {kinds.map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => setKind(k)}
            aria-pressed={kind === k}
            className={`min-h-11 cursor-pointer rounded-full border px-4 text-[10px] font-semibold uppercase tracking-[0.14em] transition-colors ${
              kind === k
                ? 'border-accent bg-accent/15 text-accent'
                : 'border-border bg-card text-foreground hover:bg-secondary'
            }`}
          >
            {t(READING_KIND_LABELS[k])}
          </button>
        ))}
      </div>

      {/* One litres/kilograms pair per tank. Twin-engine boats wrap each engine
          in its own sand-panelled frame with a heading; single-tank boats show
          one unlabelled pair with no frame. */}
      {groups.map((g) => {
        const labelled = g !== '_'
        return (
          <div
            key={g}
            className={
              labelled
                ? 'mt-3 rounded-lg border border-border bg-[#efe8da] p-3'
                : 'mt-3'
            }
          >
            {labelled && (
              <p className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-accent">
                <Ship className="h-3.5 w-3.5" aria-hidden />
                {t(ENGINE_LABELS[g])}
              </p>
            )}
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className={labelCls}>{t('Litres')}</label>
                <input
                  type="text"
                  inputMode="decimal"
                  value={vals[g]?.l ?? ''}
                  onChange={(e) => setVal(g, 'l', e.target.value)}
                  placeholder="120"
                  className={`mt-1.5 ${inputCls}`}
                />
              </div>
              <div>
                <label className={labelCls}>{t('Kilograms')}</label>
                <input
                  type="text"
                  inputMode="decimal"
                  value={vals[g]?.kg ?? ''}
                  onChange={(e) => setVal(g, 'kg', e.target.value)}
                  placeholder="86"
                  className={`mt-1.5 ${inputCls}`}
                />
              </div>
            </div>
          </div>
        )
      })}

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <div>
          <label className={labelCls}>{t('Note (optional)')}</label>
          <input
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder={t('Trip, drum, …')}
            className={`mt-1.5 ${inputCls}`}
          />
        </div>
        <div>
          <label className={labelCls}>{t('Logged by (optional)')}</label>
          <input
            type="text"
            value={who}
            onChange={(e) => setWho(e.target.value)}
            placeholder={t('Your name')}
            className={`mt-1.5 ${inputCls}`}
          />
        </div>
      </div>

      <p className="mt-2 text-[10px] text-muted-foreground">
        {t('Litres and kilograms convert automatically (≈ 0.75 kg/L).')}
      </p>

      {err && (
        <p className="mt-2 text-[11px]" style={{ color: DUE_TONE.overdue.fg }}>
          {err}
        </p>
      )}

      <button
        type="button"
        onClick={submit}
        disabled={busy}
        className="mt-3 flex min-h-11 cursor-pointer items-center gap-1.5 rounded-full bg-accent px-5 text-[10px] font-semibold uppercase tracking-[0.14em] text-accent-foreground disabled:opacity-60"
      >
        {busy ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
        ) : (
          <Check className="h-3.5 w-3.5" aria-hidden />
        )}
        {t('Save')}
      </button>
    </div>
  )
}

function BoatReadingRow({
  reading,
  onDeleted,
}: {
  reading: BoatFuelReading
  onDeleted: () => void
}) {
  const { t, lang } = useLang()
  const [busy, setBusy] = useState(false)

  const value = bothOrDash(
    fmtL(reading.litres, lang),
    fmtKg(reading.kilograms, lang),
  )
  const tone =
    reading.kind === 'trip-start'
      ? DUE_TONE.ok.fg
      : reading.kind === 'trip-end'
        ? DUE_TONE.soon.fg
        : DUE_TONE.due.fg

  async function remove() {
    setBusy(true)
    try {
      await deleteBoatFuelReading(reading.id)
      onDeleted()
    } catch {
      setBusy(false)
    }
  }

  return (
    <li className="flex items-center gap-3 py-3">
      <span
        className="w-28 flex-shrink-0 text-sm font-semibold tabular-nums"
        style={{ color: tone }}
      >
        {value}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm text-foreground">
          {t(READING_KIND_LABELS[reading.kind])}
          {reading.engineSlot ? (
            <span className="text-accent">
              {' · '}
              {t(ENGINE_LABELS[reading.engineSlot])}
            </span>
          ) : (
            ''
          )}
        </p>
        <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
          {dateFmt(reading.occurredAt, lang)}
          {reading.loggedBy ? ` · ${reading.loggedBy}` : ''}
          {reading.note ? ` · ${reading.note}` : ''}
        </p>
      </div>
      <button
        type="button"
        onClick={remove}
        disabled={busy}
        aria-label={t('Delete entry')}
        className="flex h-11 w-11 flex-shrink-0 cursor-pointer items-center justify-center rounded-full text-muted-foreground transition-colors hover:text-[#b0203a] disabled:opacity-50"
      >
        {busy ? (
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
        ) : (
          <Trash2 className="h-4 w-4" aria-hidden />
        )}
      </button>
    </li>
  )
}

function Stat({
  label,
  value,
  hint,
  icon,
}: {
  label: string
  value: string
  hint?: string
  icon?: React.ReactNode
}) {
  return (
    <div className="rounded-xl border border-border bg-secondary/30 p-3">
      <p className="flex items-center gap-1.5 text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
        {icon}
        {label}
      </p>
      <p className="mt-1 text-lg font-semibold tabular-nums text-foreground">
        {value}
      </p>
      {hint && <p className="text-[10px] text-muted-foreground">{hint}</p>}
    </div>
  )
}

function ActionButton({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex min-h-11 cursor-pointer items-center gap-1.5 rounded-full border px-4 text-[10px] font-semibold uppercase tracking-[0.14em] transition-colors ${
        active
          ? 'border-accent bg-accent/15 text-accent'
          : 'border-border bg-card text-foreground hover:bg-secondary'
      }`}
    >
      {children}
    </button>
  )
}

const inputCls =
  'min-h-11 w-full rounded-lg border border-border bg-card px-3 text-sm text-foreground'
const labelCls =
  'text-[10px] uppercase tracking-[0.14em] text-muted-foreground'

function FuelForm({
  mode,
  current,
  onDone,
  onCancel,
}: {
  mode: Exclude<Mode, null>
  current: number
  onDone: () => void
  onCancel: () => void
}) {
  const { t, lang } = useLang()
  const [amount, setAmount] = useState(mode === 'reorder' ? String(current || '') : '')
  const [boat, setBoat] = useState<string>(BOATS[0]?.id ?? 'odyssey')
  const [cost, setCost] = useState('')
  const [who, setWho] = useState('')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  // Refuel only: the amount can be entered in litres, kilograms or cans.
  const [unit, setUnit] = useState<FuelInputUnit>('litres')
  const [cans, setCans] = useState('')
  const [canSize, setCanSize] = useState('20')

  // Live litres the current refuel entry resolves to, or null when incomplete.
  const refuelLitres = (() => {
    if (mode !== 'refuel') return null
    if (unit === 'cans') {
      const c = Number(cans) || 0
      const s = Number(canSize) || 0
      return c > 0 && s > 0 ? c * s : null
    }
    const q = Number(amount) || 0
    if (q <= 0) return null
    return unit === 'kg' ? q / PETROL_KG_PER_L : q
  })()

  const title =
    mode === 'delivery'
      ? t('Fuel delivered to the drums')
      : mode === 'refuel'
        ? t('Fuel put into a boat')
        : mode === 'adjust'
          ? t('Manual correction')
          : t('Reorder level')

  async function submit() {
    setBusy(true)
    setErr(null)
    try {
      if (mode === 'delivery') {
        await logFuelDelivery({
          litres: Number(amount),
          costAr: cost === '' ? null : Number(cost),
          loggedBy: who,
          note,
        })
      } else if (mode === 'refuel') {
        await logFuelRefuel({
          boat,
          inputUnit: unit,
          inputQty: unit === 'cans' ? Number(cans) : Number(amount),
          canSizeL: unit === 'cans' ? Number(canSize) : null,
          loggedBy: who,
          note,
        })
      } else if (mode === 'adjust') {
        await logFuelAdjustment({ litres: Number(amount), loggedBy: who, note })
      } else {
        await setFuelReorderLevel(Number(amount))
      }
      onDone()
    } catch (e) {
      setErr(e instanceof Error ? e.message : t('Could not save'))
      setBusy(false)
    }
  }

  return (
    <div className="rounded-xl border border-border bg-secondary/30 p-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-foreground">{title}</p>
        <button
          type="button"
          onClick={onCancel}
          aria-label={t('Close')}
          className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full text-muted-foreground hover:bg-secondary"
        >
          <X className="h-4 w-4" aria-hidden />
        </button>
      </div>

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        {mode === 'refuel' ? (
          <div className="sm:col-span-2">
            {/* How the amount is entered: litres, kilograms or cans. Whichever
                is chosen, it is converted to litres (shown live below). */}
            <label className={labelCls}>{t('Amount taken')}</label>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {(
                [
                  ['litres', t('Litres')],
                  ['kg', t('Kilograms')],
                  ['cans', t('Cans')],
                ] as [FuelInputUnit, string][]
              ).map(([u, label]) => (
                <button
                  key={u}
                  type="button"
                  onClick={() => setUnit(u)}
                  aria-pressed={unit === u}
                  className={`min-h-11 cursor-pointer rounded-full border px-4 text-[11px] font-semibold uppercase tracking-[0.12em] transition-colors ${
                    unit === u
                      ? 'border-accent bg-accent/15 text-accent'
                      : 'border-border bg-card text-muted-foreground hover:bg-secondary'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            {unit === 'cans' ? (
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <div>
                  <label className={labelCls}>{t('Number of cans')}</label>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={cans}
                    onChange={(e) => setCans(e.target.value)}
                    placeholder="3"
                    className={`mt-1.5 ${inputCls}`}
                  />
                </div>
                <div>
                  <label className={labelCls}>{t('Can size (L)')}</label>
                  <div className="mt-1.5 flex items-center gap-2">
                    <input
                      type="text"
                      inputMode="decimal"
                      value={canSize}
                      onChange={(e) => setCanSize(e.target.value)}
                      placeholder="20"
                      className={inputCls}
                    />
                    {['20', '25'].map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => setCanSize(s)}
                        className={`min-h-11 shrink-0 cursor-pointer rounded-full border px-3 text-[11px] font-semibold transition-colors ${
                          canSize === s
                            ? 'border-accent bg-accent/15 text-accent'
                            : 'border-border bg-card text-muted-foreground hover:bg-secondary'
                        }`}
                      >
                        {s} L
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="mt-3">
                <label className={labelCls}>
                  {unit === 'kg' ? t('Kilograms') : t('Litres')}
                </label>
                <input
                  type="text"
                  inputMode="decimal"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder={unit === 'kg' ? '25' : '200'}
                  className={`mt-1.5 ${inputCls}`}
                />
              </div>
            )}

            {/* Live conversion so the person sees exactly what will be stored. */}
            {refuelLitres != null && (
              <p className="mt-2 text-[11px] text-muted-foreground">
                {t('Will be recorded as')}{' '}
                <span className="font-semibold text-foreground">
                  {litres(Math.round(refuelLitres * 10) / 10, lang)}
                </span>
                {unit !== 'litres' &&
                  ` · ${
                    unit === 'kg'
                      ? `${PETROL_KG_PER_L} kg/L`
                      : `${cans || 0} × ${canSize || 0} L`
                  }`}
              </p>
            )}

            <div className="mt-3">
              <label className={labelCls}>{t('Boat')}</label>
              <select
                value={boat}
                onChange={(e) => setBoat(e.target.value)}
                className={`mt-1.5 ${inputCls}`}
              >
                {BOATS.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        ) : (
          <div>
            <label className={labelCls}>
              {mode === 'adjust'
                ? t('Litres (+ or −)')
                : mode === 'reorder'
                  ? t('Reorder at (litres)')
                  : t('Litres')}
            </label>
            <input
              type="text"
              inputMode={mode === 'adjust' ? 'text' : 'decimal'}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder={mode === 'adjust' ? '-20' : '200'}
              className={`mt-1.5 ${inputCls}`}
            />
          </div>
        )}

        {mode === 'delivery' && (
          <div>
            <label className={labelCls}>{t('Cost (Ar, optional)')}</label>
            <input
              type="text"
              inputMode="numeric"
              value={cost}
              onChange={(e) => setCost(e.target.value)}
              placeholder={t('e.g. 900000')}
              className={`mt-1.5 ${inputCls}`}
            />
          </div>
        )}

        {mode !== 'reorder' && (
          <div className={mode === 'refuel' || mode === 'delivery' ? 'sm:col-span-2' : ''}>
            <label className={labelCls}>
              {mode === 'adjust' ? t('Reason') : t('Note (optional)')}
            </label>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={
                mode === 'adjust'
                  ? t('Why the correction?')
                  : t('Supplier, drum, …')
              }
              className={`mt-1.5 ${inputCls}`}
            />
          </div>
        )}

        {mode !== 'reorder' && (
          <div>
            <label className={labelCls}>{t('Logged by (optional)')}</label>
            <input
              type="text"
              value={who}
              onChange={(e) => setWho(e.target.value)}
              placeholder={t('Your name')}
              className={`mt-1.5 ${inputCls}`}
            />
          </div>
        )}
      </div>

      {err && (
        <p className="mt-2 text-[11px]" style={{ color: DUE_TONE.overdue.fg }}>
          {err}
        </p>
      )}

      <button
        type="button"
        onClick={submit}
        disabled={busy}
        className="mt-3 flex min-h-11 cursor-pointer items-center gap-1.5 rounded-full bg-accent px-5 text-[10px] font-semibold uppercase tracking-[0.14em] text-accent-foreground disabled:opacity-60"
      >
        {busy ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
        ) : (
          <Check className="h-3.5 w-3.5" aria-hidden />
        )}
        {t('Save')}
      </button>
    </div>
  )
}

function LedgerRow({
  entry,
  onDeleted,
}: {
  entry: FuelEntry
  onDeleted: () => void
}) {
  const { t, lang } = useLang()
  const [busy, setBusy] = useState(false)

  const signed =
    entry.type === 'refuel'
      ? `−${litres(Math.abs(entry.litres), lang)}`
      : entry.type === 'adjustment'
        ? `${entry.litres > 0 ? '+' : '���'}${litres(Math.abs(entry.litres), lang)}`
        : `+${litres(Math.abs(entry.litres), lang)}`

  const tone =
    entry.type === 'delivery'
      ? DUE_TONE.ok.fg
      : entry.type === 'refuel'
        ? DUE_TONE.soon.fg
        : DUE_TONE.due.fg

  const kindLabel =
    entry.type === 'delivery'
      ? t('Delivery')
      : entry.type === 'refuel'
        ? `${t('Refuel')} · ${entry.boatLabel ?? ''}`.trim()
        : t('Adjustment')

  const [open, setOpen] = useState(false)
  const summary = inputSummary(entry, lang)

  async function remove() {
    setBusy(true)
    try {
      await deleteFuelEntry(entry.id)
      onDeleted()
    } catch {
      setBusy(false)
    }
  }

  return (
    <li className="py-1">
      <div className="flex items-center gap-3">
        {/* The whole left region opens the entry so it can be inspected. */}
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className="flex min-w-0 flex-1 cursor-pointer items-center gap-3 py-2 text-left"
        >
          <span
            className="w-20 flex-shrink-0 text-sm font-semibold tabular-nums"
            style={{ color: tone }}
          >
            {signed}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm text-foreground">
              {kindLabel}
            </span>
            <span className="mt-0.5 block truncate text-[11px] text-muted-foreground">
              {dateFmt(entry.occurredAt, lang)}
              {summary ? ` · ${summary}` : ''}
              {entry.costAr != null ? ` · ${ariary(entry.costAr, lang)}` : ''}
              {entry.loggedBy ? ` · ${entry.loggedBy}` : ''}
            </span>
          </span>
          <ChevronDown
            className={`h-4 w-4 flex-shrink-0 text-muted-foreground transition-transform ${
              open ? 'rotate-180' : ''
            }`}
            aria-hidden
          />
        </button>
        <button
          type="button"
          onClick={remove}
          disabled={busy}
          aria-label={t('Delete entry')}
          className="flex h-11 w-11 flex-shrink-0 cursor-pointer items-center justify-center rounded-full text-muted-foreground transition-colors hover:text-[#b0203a] disabled:opacity-50"
        >
          {busy ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          ) : (
            <Trash2 className="h-4 w-4" aria-hidden />
          )}
        </button>
      </div>

      {open && (
        <dl className="mb-2 ml-[92px] grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 rounded-lg border border-border bg-secondary/30 p-3 text-[12px]">
          <dt className="text-muted-foreground">{t('Type')}</dt>
          <dd className="text-foreground">{kindLabel}</dd>

          <dt className="text-muted-foreground">{t('Recorded amount')}</dt>
          <dd className="tabular-nums text-foreground">
            {litres(Math.round(Math.abs(entry.litres) * 10) / 10, lang)}
          </dd>

          {summary && (
            <>
              <dt className="text-muted-foreground">{t('Entered as')}</dt>
              <dd className="tabular-nums text-foreground">{summary}</dd>
            </>
          )}

          {entry.costAr != null && (
            <>
              <dt className="text-muted-foreground">{t('Cost')}</dt>
              <dd className="tabular-nums text-foreground">
                {ariary(entry.costAr, lang)}
              </dd>
            </>
          )}

          {entry.loggedBy && (
            <>
              <dt className="text-muted-foreground">{t('Logged by')}</dt>
              <dd className="text-foreground">{entry.loggedBy}</dd>
            </>
          )}

          {entry.note && (
            <>
              <dt className="text-muted-foreground">{t('Note')}</dt>
              <dd className="text-foreground">{entry.note}</dd>
            </>
          )}

          <dt className="text-muted-foreground">{t('When')}</dt>
          <dd className="tabular-nums text-foreground">
            {dateTimeFmt(entry.occurredAt, lang)}
          </dd>
        </dl>
      )}
    </li>
  )
}

// ── Combined stock: warehouse + every boat �����──────────────────────────────
function FuelTotalsPanel() {
  const { t, lang } = useLang()
  const { data: d, isLoading } = useSWR('fuel-totals', () => getFuelTotals(), {
    refreshInterval: 120000,
    revalidateOnFocus: true,
  })

  return (
    <section className="overflow-hidden rounded-2xl border border-border bg-card">
      <header className="bg-panel-header p-5">
        <p className="text-[10px] uppercase tracking-[0.22em] text-panel-header-foreground/40">
          {t('Fuel')}
        </p>
        <h2 className="mt-1 font-serif text-xl text-panel-header-foreground">
          {t('Total fuel in stock')}
        </h2>
      </header>

      <div className="p-5">
        {isLoading && (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            {t('Reading the fuel log…')}
          </p>
        )}

        {d && (
          <>
            {/* The headline: total litres everywhere. Kilograms are shown
                alongside but never folded into the litres figure. */}
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                  {t('Everything on hand')}
                </p>
                <p className="mt-1 font-serif text-4xl tabular-nums text-foreground">
                  {litres(d.totalLitres, lang)}
                </p>
                {d.boatsKilograms > 0 && (
                  <p className="mt-1 text-sm tabular-nums text-muted-foreground">
                    {t('plus')} {fmtKg(d.boatsKilograms, lang)}{' '}
                    {t('weighed on the boats')}
                  </p>
                )}
              </div>
            </div>

            {/* Where the litres sit: warehouse vs. each boat. */}
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <div className="flex items-center gap-3 rounded-xl border border-border bg-secondary/30 p-3">
                <Warehouse className="h-4 w-4 text-accent" aria-hidden />
                <div>
                  <p className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                    {t('Warehouse')}
                  </p>
                  <p className="text-lg font-semibold tabular-nums text-foreground">
                    {litres(d.warehouseLitres, lang)}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3 rounded-xl border border-border bg-secondary/30 p-3">
                <Ship className="h-4 w-4 text-accent" aria-hidden />
                <div>
                  <p className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                    {t('On the boats')}
                  </p>
                  <p className="text-lg font-semibold tabular-nums text-foreground">
                    {bothOrDash(
                      fmtL(d.boatsLitres, lang),
                      d.boatsKilograms > 0 ? fmtKg(d.boatsKilograms, lang) : null,
                    )}
                  </p>
                </div>
              </div>
            </div>

            {/* Per-boat breakdown of the on-board figure. */}
            <ul className="mt-3 divide-y divide-border rounded-xl border border-border">
              {d.boats.map((b) => (
                <li
                  key={b.boat}
                  className="flex items-center justify-between gap-3 px-3 py-2.5"
                >
                  <span className="flex items-center gap-2 text-sm text-foreground">
                    <Gauge
                      className="h-3.5 w-3.5 text-muted-foreground"
                      aria-hidden
                    />
                    {b.boatLabel}
                  </span>
                  <span className="text-sm font-semibold tabular-nums text-foreground">
                    {bothOrDash(fmtL(b.litres, lang), fmtKg(b.kilograms, lang))}
                  </span>
                </li>
              ))}
            </ul>

            <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground">
              {t(
                'This is a snapshot of everything held: the warehouse drums plus the last measured fuel on each boat. Litres and kilograms are added up separately and never converted into one another.',
              )}
            </p>
          </>
        )}
      </div>
    </section>
  )
}

// ── Warehouse archive (soft-deleted entries, restorable) ──────────────────
function WarehouseArchive({ onRestored }: { onRestored: () => void }) {
  const { t } = useLang()
  const [open, setOpen] = useState(false)
  const { data, mutate, isLoading } = useSWR(
    open ? 'fuel-archive' : null,
    () => getArchivedFuelEntries(),
  )
  const entries = data ?? []

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex min-h-11 cursor-pointer items-center gap-1.5 rounded-full border border-border bg-card px-4 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground hover:bg-secondary"
      >
        <Archive className="h-3.5 w-3.5" aria-hidden />
        {open ? t('Hide archive') : t('Archive')}
      </button>

      {open && (
        <div className="mt-3">
          {isLoading && (
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              {t('Reading the fuel log…')}
            </p>
          )}
          {!isLoading && entries.length === 0 && (
            <p className="text-[11px] text-muted-foreground">
              {t('The archive is empty.')}
            </p>
          )}
          {entries.length > 0 && (
            <ul className="divide-y divide-border">
              {entries.map((e) => (
                <ArchivedFuelRow
                  key={e.id}
                  entry={e}
                  onRestored={() => {
                    mutate()
                    onRestored()
                  }}
                />
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}

function ArchivedFuelRow({
  entry,
  onRestored,
}: {
  entry: FuelEntry
  onRestored: () => void
}) {
  const { t, lang } = useLang()
  const [busy, setBusy] = useState(false)

  const signed =
    entry.type === 'refuel'
      ? `−${litres(Math.abs(entry.litres), lang)}`
      : entry.type === 'adjustment'
        ? `${entry.litres > 0 ? '+' : '−'}${litres(Math.abs(entry.litres), lang)}`
        : `+${litres(Math.abs(entry.litres), lang)}`

  const kindLabel =
    entry.type === 'delivery'
      ? t('Delivery')
      : entry.type === 'refuel'
        ? `${t('Refuel')} · ${entry.boatLabel ?? ''}`.trim()
        : t('Adjustment')

  const [open, setOpen] = useState(false)
  const summary = inputSummary(entry, lang)

  async function restore() {
    setBusy(true)
    try {
      await restoreFuelEntry(entry.id)
      onRestored()
    } catch {
      setBusy(false)
    }
  }

  return (
    <li className="py-1 opacity-80">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className="flex min-w-0 flex-1 cursor-pointer items-center gap-3 py-2 text-left"
        >
          <span className="w-20 flex-shrink-0 text-sm font-semibold tabular-nums text-muted-foreground line-through">
            {signed}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm text-muted-foreground line-through">
              {kindLabel}
            </span>
            <span className="mt-0.5 block truncate text-[11px] text-muted-foreground">
              {dateFmt(entry.occurredAt, lang)}
              {summary ? ` · ${summary}` : ''}
              {entry.loggedBy ? ` · ${entry.loggedBy}` : ''}
            </span>
          </span>
          <ChevronDown
            className={`h-4 w-4 flex-shrink-0 text-muted-foreground transition-transform ${
              open ? 'rotate-180' : ''
            }`}
            aria-hidden
          />
        </button>
        <button
          type="button"
          onClick={restore}
          disabled={busy}
          aria-label={t('Restore')}
          className="flex min-h-11 flex-shrink-0 cursor-pointer items-center gap-1.5 rounded-full border border-border px-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-foreground hover:bg-secondary disabled:opacity-50"
        >
          {busy ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
          ) : (
            <RotateCcw className="h-3.5 w-3.5" aria-hidden />
          )}
          {t('Restore')}
        </button>
      </div>

      {open && (
        <dl className="mb-2 ml-[92px] grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 rounded-lg border border-border bg-secondary/30 p-3 text-[12px]">
          <dt className="text-muted-foreground">{t('Type')}</dt>
          <dd className="text-foreground">{kindLabel}</dd>
          <dt className="text-muted-foreground">{t('Recorded amount')}</dt>
          <dd className="tabular-nums text-foreground">
            {litres(Math.round(Math.abs(entry.litres) * 10) / 10, lang)}
          </dd>
          {summary && (
            <>
              <dt className="text-muted-foreground">{t('Entered as')}</dt>
              <dd className="tabular-nums text-foreground">{summary}</dd>
            </>
          )}
          {entry.note && (
            <>
              <dt className="text-muted-foreground">{t('Note')}</dt>
              <dd className="text-foreground">{entry.note}</dd>
            </>
          )}
          <dt className="text-muted-foreground">{t('When')}</dt>
          <dd className="tabular-nums text-foreground">
            {dateTimeFmt(entry.occurredAt, lang)}
          </dd>
        </dl>
      )}
    </li>
  )
}

// ── Per-boat archive ──────────────────────────────────────────────────────
function BoatArchive({ onRestored }: { onRestored: () => void }) {
  const { t } = useLang()
  const [open, setOpen] = useState(false)
  const { data, mutate, isLoading } = useSWR(
    open ? 'boat-fuel-archive' : null,
    () => getArchivedBoatReadings(),
  )
  const groups = data ?? []

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex min-h-11 cursor-pointer items-center gap-1.5 rounded-full border border-border bg-card px-4 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground hover:bg-secondary"
      >
        <Archive className="h-3.5 w-3.5" aria-hidden />
        {open ? t('Hide archive') : t('Archive')}
      </button>

      {open && (
        <div className="mt-3 space-y-4">
          {isLoading && (
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              {t('Reading the fuel log…')}
            </p>
          )}
          {!isLoading && groups.length === 0 && (
            <p className="text-[11px] text-muted-foreground">
              {t('The archive is empty.')}
            </p>
          )}
          {groups.map((g) => (
            <div key={g.boat}>
              <p className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                {g.boatLabel}
              </p>
              <ul className="mt-2 divide-y divide-border">
                {g.readings.map((r) => (
                  <ArchivedBoatRow
                    key={r.id}
                    reading={r}
                    onRestored={() => {
                      mutate()
                      onRestored()
                    }}
                  />
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function ArchivedBoatRow({
  reading,
  onRestored,
}: {
  reading: BoatFuelReading
  onRestored: () => void
}) {
  const { t, lang } = useLang()
  const [busy, setBusy] = useState(false)

  const value = bothOrDash(
    fmtL(reading.litres, lang),
    fmtKg(reading.kilograms, lang),
  )

  async function restore() {
    setBusy(true)
    try {
      await restoreBoatFuelReading(reading.id)
      onRestored()
    } catch {
      setBusy(false)
    }
  }

  return (
    <li className="flex items-center gap-3 py-3 opacity-70">
      <span className="w-28 flex-shrink-0 text-sm font-semibold tabular-nums text-muted-foreground line-through">
        {value}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm text-muted-foreground line-through">
          {t(READING_KIND_LABELS[reading.kind])}
        </p>
        <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
          {dateFmt(reading.occurredAt, lang)}
          {reading.loggedBy ? ` · ${reading.loggedBy}` : ''}
          {reading.note ? ` · ${reading.note}` : ''}
        </p>
      </div>
      <button
        type="button"
        onClick={restore}
        disabled={busy}
        aria-label={t('Restore')}
        className="flex min-h-11 flex-shrink-0 cursor-pointer items-center gap-1.5 rounded-full border border-border px-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-foreground hover:bg-secondary disabled:opacity-50"
      >
        {busy ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
        ) : (
          <RotateCcw className="h-3.5 w-3.5" aria-hidden />
        )}
        {t('Restore')}
      </button>
    </li>
  )
}

// ── Fuel procurement: pay at the station → receive in cans ────────────────
function cansLabel(c20: number, c25: number, lang: string) {
  const parts: string[] = []
  if (c20) parts.push(`${c20.toLocaleString(numLocale(lang))}×20 L`)
  if (c25) parts.push(`${c25.toLocaleString(numLocale(lang))}×25 L`)
  return parts.join(' + ')
}

function ProcurementSection() {
  const { t } = useLang()
  const { mutate: globalMutate } = useSWRConfig()
  const { data, mutate, isLoading, error } = useSWR(
    'fuel-procurements',
    () => getFuelProcurements(),
    { refreshInterval: 120000, revalidateOnFocus: true },
  )
  // Live EUR/ZAR reference rates, refreshed every 12 h (falls back if offline).
  const { data: fx } = useSWR('fx-rates', () => getFxRates(), {
    refreshInterval: 60 * 60 * 12 * 1000,
    revalidateOnFocus: false,
  })
  const [adding, setAdding] = useState(false)

  // A procurement moves fuel into the warehouse on receipt, so refresh the
  // warehouse ledger and the combined total alongside this list.
  const refresh = () => {
    mutate()
    globalMutate('fuel')
    globalMutate('fuel-totals')
  }

  return (
    <section className="overflow-hidden rounded-2xl border border-border bg-card">
      <header className="flex flex-wrap items-center justify-between gap-4 bg-panel-header p-5">
        <div>
          <p className="text-[10px] uppercase tracking-[0.22em] text-panel-header-foreground/40">
            {t('Fuel')}
          </p>
          <h2 className="mt-1 font-serif text-xl text-panel-header-foreground">
            {t('Fuel procurement')}
          </h2>
        </div>
        <ActionButton active={adding} onClick={() => setAdding((v) => !v)}>
          <Receipt className="h-3.5 w-3.5" aria-hidden />
          {t('New purchase')}
        </ActionButton>
      </header>

      <div className="space-y-5 p-5">
        <p className="rounded-xl border border-border bg-secondary/40 p-3 text-[11px] leading-relaxed text-muted-foreground">
          {t(
            'Buying fuel is two steps. First the owner pays at the station (the money is spent, but the fuel is not in the warehouse yet). Then the employee brings it in 20 L and 25 L cans — that is when the fuel, plus the transport cost, is added to the warehouse.',
          )}
        </p>

        {adding && (
          <PurchaseForm
            fx={fx}
            onDone={() => {
              setAdding(false)
              refresh()
            }}
            onCancel={() => setAdding(false)}
          />
        )}

        {isLoading && (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            {t('Reading the fuel log…')}
          </p>
        )}
        {error && (
          <p className="text-sm" style={{ color: DUE_TONE.overdue.fg }}>
            {t('Could not load the fuel log.')}
          </p>
        )}

        {/* Awaiting pickup — paid, not yet in the warehouse. */}
        {data && data.open.length > 0 && (
          <div>
            <p className="mb-2 text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
              {t('Awaiting pickup')}
            </p>
            <div className="space-y-3">
              {data.open.map((p) => (
                <OpenProcurementCard
                  key={p.id}
                  proc={p}
                  fx={fx}
                  onChanged={refresh}
                />
              ))}
            </div>
          </div>
        )}

        {/* Received history. */}
        {data && data.done.length > 0 && (
          <div>
            <p className="mb-2 text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
              {t('Received')}
            </p>
            <ul className="divide-y divide-border">
              {data.done.map((p) => (
                <DoneProcurementRow
                  key={p.id}
                  proc={p}
                  fx={fx}
                  onChanged={refresh}
                />
              ))}
            </ul>
          </div>
        )}

        {data && data.open.length === 0 && data.done.length === 0 && !adding && (
          <p className="text-[11px] text-muted-foreground">
            {t('No purchases yet. Start with a station payment.')}
          </p>
        )}

        <ProcurementArchive onRestored={refresh} />
      </div>
    </section>
  )
}

function PurchaseForm({
  fx,
  onDone,
  onCancel,
}: {
  fx: FxRates | undefined
  onDone: () => void
  onCancel: () => void
}) {
  const { t, lang } = useLang()
  const [litresVal, setLitresVal] = useState('')
  const [priceVal, setPriceVal] = useState('')
  const [payMethod, setPayMethod] = useState<PaymentMethod | ''>('')
  const [station, setStation] = useState('')
  const [paidBy, setPaidBy] = useState('')
  const [note, setNote] = useState('')
  const [receiptUrl, setReceiptUrl] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const cameraInputRef = useRef<HTMLInputElement>(null)
  const galleryInputRef = useRef<HTMLInputElement>(null)

  const litresNum = Number(litresVal) || 0
  const priceNum = Number(priceVal) || 0
  // The program computes the total — the owner never types it.
  const totalAr = litresNum > 0 && priceNum > 0 ? Math.round(litresNum * priceNum) : null

  async function onReceiptPicked(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setUploading(true)
    setErr(null)
    try {
      const dataUrl = await shrinkImageToDataUrl(file)
      const form = new FormData()
      form.append('file', dataUrlToFile(dataUrl, 'receipt.jpg'))
      const res = await uploadImage(form)
      if ('error' in res && res.error) throw new Error(res.error)
      if ('url' in res && res.url) setReceiptUrl(res.url)
    } catch (ex) {
      setErr(ex instanceof Error ? ex.message : t('Could not upload the photo'))
    } finally {
      setUploading(false)
    }
  }

  async function submit() {
    setBusy(true)
    setErr(null)
    try {
      await logFuelPurchase({
        paidLitres: litresVal === '' ? null : Number(litresVal),
        pricePerLitreAr: priceVal === '' ? null : Number(priceVal),
        paymentMethod: payMethod || null,
        receiptUrl,
        station,
        paidBy,
        note,
      })
      onDone()
    } catch (e) {
      setErr(e instanceof Error ? e.message : t('Could not save'))
      setBusy(false)
    }
  }

  return (
    <div className="rounded-xl border border-border bg-secondary/30 p-4">
      <div className="flex items-center justify-between">
        <p className="flex items-center gap-2 text-sm font-medium text-foreground">
          <Receipt className="h-4 w-4 text-accent" aria-hidden />
          {t('Station payment')}
        </p>
        <button
          type="button"
          onClick={onCancel}
          aria-label={t('Close')}
          className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full text-muted-foreground hover:bg-secondary"
        >
          <X className="h-4 w-4" aria-hidden />
        </button>
      </div>

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <div>
          <label className={labelCls}>{t('Litres paid for')}</label>
          <input
            type="text"
            inputMode="decimal"
            value={litresVal}
            onChange={(e) => setLitresVal(e.target.value)}
            placeholder="200"
            className={`mt-1.5 ${inputCls}`}
          />
        </div>
        <div>
          <label className={labelCls}>{t('Price per 1 L (Ar)')}</label>
          <input
            type="text"
            inputMode="numeric"
            value={priceVal}
            onChange={(e) => setPriceVal(e.target.value)}
            placeholder="4500"
            className={`mt-1.5 ${inputCls}`}
          />
        </div>
        <div>
          <label className={labelCls}>{t('Station (optional)')}</label>
          <input
            type="text"
            value={station}
            onChange={(e) => setStation(e.target.value)}
            placeholder={t('Station name')}
            className={`mt-1.5 ${inputCls}`}
          />
        </div>
        <div>
          <label className={labelCls}>{t('Paid by (optional)')}</label>
          <input
            type="text"
            value={paidBy}
            onChange={(e) => setPaidBy(e.target.value)}
            placeholder={t('Your name')}
            className={`mt-1.5 ${inputCls}`}
          />
        </div>
        <div className="sm:col-span-2">
          <label className={labelCls}>{t('Note (optional)')}</label>
          <input
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder={t('Receipt no., …')}
            className={`mt-1.5 ${inputCls}`}
          />
        </div>
      </div>

      {/* Computed total — the program does the multiplication. EUR/ZAR below
          are an informational reference only; billing stays in Ariary. */}
      <div className="mt-3 flex items-center justify-between gap-3 rounded-lg bg-secondary/50 px-3 py-2.5">
        <span className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
          {t('Total fuel cost')}
        </span>
        <span className="text-right">
          <span className="block text-sm font-semibold tabular-nums text-foreground">
            {totalAr != null ? ariary(totalAr, lang) : '—'}
          </span>
          {fxHint(totalAr, fx, lang) && (
            <span className="mt-0.5 block text-[10px] tabular-nums text-muted-foreground">
              {fxHint(totalAr, fx, lang)}
            </span>
          )}
        </span>
      </div>

      {/* Payment method. */}
      <div className="mt-3">
        <label className={labelCls}>{t('Payment method')}</label>
        <div className="mt-1.5 flex flex-wrap gap-2">
          {PAYMENT_METHODS.map((m) => {
            const active = payMethod === m.key
            return (
              <button
                key={m.key}
                type="button"
                onClick={() => setPayMethod(active ? '' : m.key)}
                aria-pressed={active}
                className={`flex min-h-11 cursor-pointer items-center gap-1.5 rounded-full border px-4 text-[10px] font-semibold uppercase tracking-[0.14em] ${
                  active
                    ? 'border-accent bg-accent/15 text-accent'
                    : 'border-border bg-card text-muted-foreground hover:bg-secondary'
                }`}
              >
                <m.icon className="h-3.5 w-3.5" aria-hidden />
                {t(m.label)}
              </button>
            )
          })}
        </div>
      </div>

      {/* Receipt photo of the paid quote. Two paths so the phone camera is
          always directly reachable: "Take photo" opens the rear camera
          (capture=environment), "From gallery" opens the photo library. */}
      <div className="mt-3">
        <label className={labelCls}>{t('Receipt photo (optional)')}</label>
        <input
          ref={cameraInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="sr-only"
          onChange={onReceiptPicked}
        />
        <input
          ref={galleryInputRef}
          type="file"
          accept="image/*"
          className="sr-only"
          onChange={onReceiptPicked}
        />
        <div className="mt-1.5 flex flex-wrap items-center gap-3">
          <button
            type="button"
            disabled={uploading}
            onClick={() => cameraInputRef.current?.click()}
            className="flex min-h-11 cursor-pointer items-center gap-1.5 rounded-full border border-accent bg-accent/15 px-4 text-[10px] font-semibold uppercase tracking-[0.14em] text-accent disabled:opacity-60"
          >
            {uploading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
            ) : (
              <Camera className="h-3.5 w-3.5" aria-hidden />
            )}
            {receiptUrl ? t('Take a new photo') : t('Take a photo')}
          </button>
          <button
            type="button"
            disabled={uploading}
            onClick={() => galleryInputRef.current?.click()}
            className="flex min-h-11 cursor-pointer items-center gap-1.5 rounded-full border border-border bg-card px-4 text-[10px] font-semibold uppercase tracking-[0.14em] text-foreground hover:bg-secondary disabled:opacity-60"
          >
            <ImageIcon className="h-3.5 w-3.5" aria-hidden />
            {t('From gallery')}
          </button>
          {receiptUrl && (
            <div className="flex items-center gap-2">
              <a href={receiptUrl} target="_blank" rel="noopener noreferrer">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={receiptUrl || '/placeholder.svg'}
                  alt={t('Receipt photo')}
                  className="h-11 w-11 rounded-lg border border-border object-cover"
                />
              </a>
              <button
                type="button"
                onClick={() => setReceiptUrl(null)}
                aria-label={t('Remove photo')}
                className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full text-muted-foreground hover:bg-secondary"
              >
                <X className="h-4 w-4" aria-hidden />
              </button>
            </div>
          )}
        </div>
      </div>

      <p className="mt-3 text-[10px] text-muted-foreground">
        {t('This records the payment only — the fuel is added to the warehouse when it is received.')}
      </p>

      {err && (
        <p className="mt-2 text-[11px]" style={{ color: DUE_TONE.overdue.fg }}>
          {err}
        </p>
      )}

      <button
        type="button"
        onClick={submit}
        disabled={busy}
        className="mt-3 flex min-h-11 cursor-pointer items-center gap-1.5 rounded-full bg-accent px-5 text-[10px] font-semibold uppercase tracking-[0.14em] text-accent-foreground disabled:opacity-60"
      >
        {busy ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
        ) : (
          <Check className="h-3.5 w-3.5" aria-hidden />
        )}
        {t('Save payment')}
      </button>
    </div>
  )
}

function OpenProcurementCard({
  proc,
  fx,
  onChanged,
}: {
  proc: FuelProcurement
  fx: FxRates | undefined
  onChanged: () => void
}) {
  const { t, lang } = useLang()
  const [receiving, setReceiving] = useState(false)

  return (
    <div className="rounded-xl border border-border bg-secondary/20 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm font-semibold text-foreground">
            <Receipt className="h-4 w-4 text-accent" aria-hidden />
            {proc.paidLitres != null
              ? litres(proc.paidLitres, lang)
              : t('Fuel')}
            {proc.fuelCostAr != null && (
              <span className="font-normal text-muted-foreground">
                · {ariary(proc.fuelCostAr, lang)}
              </span>
            )}
            {proc.pricePerLitreAr != null && (
              <span className="font-normal text-muted-foreground">
                · {ariary(proc.pricePerLitreAr, lang)}/L
              </span>
            )}
          </p>
          <p className="mt-1 text-[11px] text-muted-foreground">
            {dateFmt(proc.paidAt, lang)}
            {proc.station ? ` · ${proc.station}` : ''}
            {proc.paidBy ? ` · ${proc.paidBy}` : ''}
            {paymentLabel(proc.paymentMethod)
              ? ` · ${t(paymentLabel(proc.paymentMethod) as string)}`
              : ''}
            {proc.note ? ` · ${proc.note}` : ''}
          </p>
          {fxHint(proc.fuelCostAr, fx, lang) && (
            <p className="mt-0.5 text-[10px] tabular-nums text-muted-foreground">
              {fxHint(proc.fuelCostAr, fx, lang)}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          {proc.receiptUrl && (
            <a
              href={proc.receiptUrl}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={t('View receipt')}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={proc.receiptUrl || '/placeholder.svg'}
                alt={t('Receipt photo')}
                className="h-10 w-10 rounded-lg border border-border object-cover"
              />
            </a>
          )}
          <span
            className="flex items-center gap-1 rounded-full px-2.5 py-1 text-[9px] font-semibold uppercase tracking-[0.14em]"
            style={{
              backgroundColor: DUE_TONE.soon.bg,
              color: DUE_TONE.soon.fg,
            }}
          >
            {t('Awaiting pickup')}
          </span>
        </div>
      </div>

      {!receiving && (
        <button
          type="button"
          onClick={() => setReceiving(true)}
          className="mt-3 flex min-h-11 cursor-pointer items-center gap-1.5 rounded-full border border-accent bg-accent/15 px-4 text-[10px] font-semibold uppercase tracking-[0.14em] text-accent"
        >
          <Truck className="h-3.5 w-3.5" aria-hidden />
          {t('Confirm pickup')}
        </button>
      )}

      {receiving && (
        <ReceiveForm
          proc={proc}
          onDone={() => {
            setReceiving(false)
            onChanged()
          }}
          onCancel={() => setReceiving(false)}
        />
      )}
    </div>
  )
}

function ReceiveForm({
  proc,
  onDone,
  onCancel,
}: {
  proc: FuelProcurement
  onDone: () => void
  onCancel: () => void
}) {
  const { t, lang } = useLang()
  const [c20, setC20] = useState('')
  const [c25, setC25] = useState('')
  const [transport, setTransport] = useState('')
  const [receivedBy, setReceivedBy] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const n20 = Number(c20) || 0
  const n25 = Number(c25) || 0
  const litresIn = n20 * 20 + n25 * 25

  async function submit() {
    setBusy(true)
    setErr(null)
    try {
      await receiveFuelPurchase({
        id: proc.id,
        canisters20: n20,
        canisters25: n25,
        transportCostAr: transport === '' ? null : Number(transport),
        receivedBy,
      })
      onDone()
    } catch (e) {
      setErr(e instanceof Error ? e.message : t('Could not save'))
      setBusy(false)
    }
  }

  return (
    <div className="mt-3 rounded-xl border border-border bg-card p-4">
      <p className="flex items-center gap-2 text-sm font-medium text-foreground">
        <Container className="h-4 w-4 text-accent" aria-hidden />
        {t('Receive into the warehouse')}
      </p>

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <div>
          <label className={labelCls}>{t('20 L cans')}</label>
          <input
            type="text"
            inputMode="numeric"
            value={c20}
            onChange={(e) => setC20(e.target.value)}
            placeholder="0"
            className={`mt-1.5 ${inputCls}`}
          />
        </div>
        <div>
          <label className={labelCls}>{t('25 L cans')}</label>
          <input
            type="text"
            inputMode="numeric"
            value={c25}
            onChange={(e) => setC25(e.target.value)}
            placeholder="0"
            className={`mt-1.5 ${inputCls}`}
          />
        </div>
        <div>
          <label className={labelCls}>{t('Transport cost (Ar)')}</label>
          <input
            type="text"
            inputMode="numeric"
            value={transport}
            onChange={(e) => setTransport(e.target.value)}
            placeholder="50000"
            className={`mt-1.5 ${inputCls}`}
          />
        </div>
        <div>
          <label className={labelCls}>{t('Brought by (optional)')}</label>
          <input
            type="text"
            value={receivedBy}
            onChange={(e) => setReceivedBy(e.target.value)}
            placeholder={t('Employee name')}
            className={`mt-1.5 ${inputCls}`}
          />
        </div>
      </div>

      {/* Live total of what will enter the warehouse, plus the approximate
          weight of the cans so the load can be judged before carrying it. */}
      <p className="mt-3 rounded-lg bg-secondary/50 p-2.5 text-[11px] text-muted-foreground">
        {litresIn > 0 ? (
          <>
            {t('Adds to warehouse')}:{' '}
            <span className="font-semibold text-foreground">
              {litres(litresIn, lang)}
            </span>{' '}
            {cansLabel(n20, n25, lang) && `(${cansLabel(n20, n25, lang)})`}
            {weightHint(litresIn, lang) && (
              <span className="ml-1">· {weightHint(litresIn, lang)}</span>
            )}
          </>
        ) : (
          t('Enter how many 20 L and 25 L cans arrived')
        )}
      </p>

      {err && (
        <p className="mt-2 text-[11px]" style={{ color: DUE_TONE.overdue.fg }}>
          {err}
        </p>
      )}

      <div className="mt-3 flex items-center gap-2">
        <button
          type="button"
          onClick={submit}
          disabled={busy || litresIn <= 0}
          className="flex min-h-11 cursor-pointer items-center gap-1.5 rounded-full bg-accent px-5 text-[10px] font-semibold uppercase tracking-[0.14em] text-accent-foreground disabled:opacity-60"
        >
          {busy ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
          ) : (
            <Check className="h-3.5 w-3.5" aria-hidden />
          )}
          {t('Add to warehouse')}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="min-h-11 cursor-pointer rounded-full border border-border px-4 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground hover:bg-secondary"
        >
          {t('Cancel')}
        </button>
      </div>
    </div>
  )
}

function DoneProcurementRow({
  proc,
  fx,
  onChanged,
}: {
  proc: FuelProcurement
  fx: FxRates | undefined
  onChanged: () => void
}) {
  const { t, lang } = useLang()
  const [busy, setBusy] = useState(false)

  async function remove() {
    setBusy(true)
    try {
      await deleteFuelProcurement(proc.id)
      onChanged()
    } catch {
      setBusy(false)
    }
  }

  const cans = cansLabel(proc.canisters20, proc.canisters25, lang)

  return (
    <li className="flex items-center gap-3 py-3">
      <span className="w-20 flex-shrink-0 text-sm font-semibold tabular-nums text-foreground">
        {proc.receivedLitres != null ? litres(proc.receivedLitres, lang) : '—'}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm text-foreground">
          {cans || t('Received')}
          {proc.totalCostAr != null && (
            <span className="text-muted-foreground">
              {' · '}
              {ariary(proc.totalCostAr, lang)}
            </span>
          )}
        </p>
        <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
          {proc.receivedAt ? dateFmt(proc.receivedAt, lang) : ''}
          {proc.receivedBy ? ` · ${proc.receivedBy}` : ''}
          {proc.transportCostAr != null
            ? ` · ${t('transport')} ${ariary(proc.transportCostAr, lang)}`
            : ''}
          {weightHint(proc.receivedLitres, lang)
            ? ` · ${weightHint(proc.receivedLitres, lang)}`
            : ''}
          {paymentLabel(proc.paymentMethod)
            ? ` · ${t(paymentLabel(proc.paymentMethod) as string)}`
            : ''}
        </p>
        {fxHint(proc.totalCostAr, fx, lang) && (
          <p className="mt-0.5 truncate text-[10px] tabular-nums text-muted-foreground">
            {fxHint(proc.totalCostAr, fx, lang)}
          </p>
        )}
      </div>
      {proc.receiptUrl && (
        <a
          href={proc.receiptUrl}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={t('View receipt')}
          className="flex-shrink-0"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={proc.receiptUrl || '/placeholder.svg'}
            alt={t('Receipt photo')}
            className="h-10 w-10 rounded-lg border border-border object-cover"
          />
        </a>
      )}
      <button
        type="button"
        onClick={remove}
        disabled={busy}
        aria-label={t('Delete entry')}
        className="flex h-11 w-11 flex-shrink-0 cursor-pointer items-center justify-center rounded-full text-muted-foreground transition-colors hover:text-[#b0203a] disabled:opacity-50"
      >
        {busy ? (
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
        ) : (
          <Trash2 className="h-4 w-4" aria-hidden />
        )}
      </button>
    </li>
  )
}

function ProcurementArchive({ onRestored }: { onRestored: () => void }) {
  const { t } = useLang()
  const [open, setOpen] = useState(false)
  const { data, mutate, isLoading } = useSWR(
    open ? 'fuel-procurements-archive' : null,
    () => getArchivedFuelProcurements(),
  )
  const entries = data ?? []

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex min-h-11 cursor-pointer items-center gap-1.5 rounded-full border border-border bg-card px-4 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground hover:bg-secondary"
      >
        <Archive className="h-3.5 w-3.5" aria-hidden />
        {open ? t('Hide archive') : t('Archive')}
      </button>

      {open && (
        <div className="mt-3">
          {isLoading && (
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              {t('Reading the fuel log…')}
            </p>
          )}
          {!isLoading && entries.length === 0 && (
            <p className="text-[11px] text-muted-foreground">
              {t('The archive is empty.')}
            </p>
          )}
          {entries.length > 0 && (
            <ul className="divide-y divide-border">
              {entries.map((p) => (
                <ArchivedProcurementRow
                  key={p.id}
                  proc={p}
                  onRestored={() => {
                    mutate()
                    onRestored()
                  }}
                />
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}

function ArchivedProcurementRow({
  proc,
  onRestored,
}: {
  proc: FuelProcurement
  onRestored: () => void
}) {
  const { t, lang } = useLang()
  const [busy, setBusy] = useState(false)

  async function restore() {
    setBusy(true)
    try {
      await restoreFuelProcurement(proc.id)
      onRestored()
    } catch {
      setBusy(false)
    }
  }

  const litresShown = proc.receivedLitres ?? proc.paidLitres ?? null

  return (
    <li className="flex items-center gap-3 py-3 opacity-70">
      <span className="w-20 flex-shrink-0 text-sm font-semibold tabular-nums text-muted-foreground line-through">
        {litresShown != null ? litres(litresShown, lang) : '—'}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm text-muted-foreground line-through">
          {proc.status === 'received' ? t('Received') : t('Awaiting pickup')}
          {proc.totalCostAr != null ? ` · ${ariary(proc.totalCostAr, lang)}` : ''}
        </p>
        <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
          {dateFmt(proc.paidAt, lang)}
          {proc.station ? ` · ${proc.station}` : ''}
        </p>
      </div>
      <button
        type="button"
        onClick={restore}
        disabled={busy}
        aria-label={t('Restore')}
        className="flex min-h-11 flex-shrink-0 cursor-pointer items-center gap-1.5 rounded-full border border-border px-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-foreground hover:bg-secondary disabled:opacity-50"
      >
        {busy ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
        ) : (
          <RotateCcw className="h-3.5 w-3.5" aria-hidden />
        )}
        {t('Restore')}
      </button>
    </li>
  )
}
