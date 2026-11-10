'use client'

import {
  Droplet,
  Loader2,
  LogOut,
  Scale,
  Ship,
  Warehouse,
} from 'lucide-react'
import { useEffect, useState, useTransition } from 'react'

import {
  caretakerLogin,
  caretakerLogout,
  getHisnikState,
  hisnikIssueOdysseyIi,
  hisnikWeighFillIssue,
  hisnikWeighReturn,
  type HisnikSkipper,
  type HisnikState,
  type HisnikUnit,
} from '@/app/actions/hisnik-fuel'
import { useLang } from '@/lib/i18n/context'
import { LANGS, type Lang } from '@/lib/i18n/translations'
import { ODYSSEY_II_CAN_L } from '@/lib/fuel-units'
import { DUE_TONE } from '@/lib/maintenance'

type Screen = 'home' | 'ii' | 'iii' | 'iii-return' | 'iii-fill'

function numLocale(lang: Lang) {
  if (lang === 'sl') return 'sl-SI'
  if (lang === 'fr') return 'fr-FR'
  return 'en-GB'
}

function fmtL(n: number, lang: Lang) {
  return `${(Math.round(n * 10) / 10).toLocaleString(numLocale(lang), { maximumFractionDigits: 1 })} L`
}

function fmtKg(n: number, lang: Lang) {
  return `${(Math.round(n * 10) / 10).toLocaleString(numLocale(lang), { maximumFractionDigits: 1 })} kg`
}

function timeFmt(iso: string, lang: Lang) {
  return new Date(iso).toLocaleTimeString(numLocale(lang), {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Indian/Antananarivo',
  })
}

/** Translate API/action error keys; keep dynamic stock suffixes as-is. */
function terr(t: (s: string) => string, e: unknown): string {
  const raw = e instanceof Error ? e.message : 'Error'
  if (raw.startsWith('Not enough stock')) {
    return `${t('Not enough stock')}${raw.slice('Not enough stock'.length)}`
  }
  return t(raw)
}

function eventLabel(
  e: HisnikState['today'][number],
  t: (s: string) => string,
): string {
  if (e.eventType === 'issue') return t('Odyssey II · issue')
  if (e.eventType === 'weigh-return') return t('III · returned can')
  if (e.eventType === 'weigh-morning') return t('III · morning weigh')
  if (e.eventType === 'fill-issue') return t('III · filled + issued')
  if (e.type === 'refuel') return `${t('Issue ·')} ${e.boatLabel ?? ''}`.trim()
  if (e.type === 'weigh') return `${t('Weigh ·')} ${e.boatLabel ?? ''}`.trim()
  return e.type
}

function LangSwitch() {
  const { lang, setLang, t } = useLang()
  return (
    <div
      className="flex items-center gap-1 rounded-lg border border-border bg-card p-0.5"
      role="group"
      aria-label={t('Language')}
    >
      {LANGS.map((l) => (
        <button
          key={l}
          type="button"
          onClick={() => setLang(l)}
          aria-pressed={lang === l}
          className={`min-h-9 rounded-md px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.1em] transition-colors ${
            lang === l
              ? 'bg-primary text-primary-foreground'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          {l.toUpperCase()}
        </button>
      ))}
    </div>
  )
}

export function HisnikApp({ initiallyAuthed }: { initiallyAuthed: boolean }) {
  const { t, lang } = useLang()
  const [authed, setAuthed] = useState(initiallyAuthed)
  const [pin, setPin] = useState('')
  const [loginErr, setLoginErr] = useState<string | null>(null)
  const [state, setState] = useState<HisnikState | null>(null)
  const [loadErr, setLoadErr] = useState<string | null>(null)
  const [screen, setScreen] = useState<Screen>('home')
  const [pending, startTransition] = useTransition()

  async function refresh() {
    try {
      const s = await getHisnikState()
      setState(s)
      setLoadErr(null)
    } catch (e) {
      setLoadErr(terr(t, e) || t('Could not read stock'))
    }
  }

  useEffect(() => {
    if (!authed) return
    startTransition(() => {
      void refresh()
    })
    // Refresh when language changes so load errors re-translate if needed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authed, lang])

  async function onLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoginErr(null)
    const res = await caretakerLogin(pin)
    if (!res.ok) {
      setLoginErr(t(res.error))
      return
    }
    setAuthed(true)
    setPin('')
  }

  async function onLogout() {
    await caretakerLogout()
    setAuthed(false)
    setState(null)
    setScreen('home')
  }

  if (!authed) {
    return (
      <main
        className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-5 py-10"
        style={{ paddingTop: 'max(2.5rem, env(safe-area-inset-top))' }}
      >
        <div className="mb-8 flex justify-end">
          <LangSwitch />
        </div>
        <p className="flex items-center gap-3 text-[11px] font-medium uppercase tracking-[0.3em] text-accent">
          <span className="h-px w-8 bg-accent" />
          {t('AAM · Fuel')}
        </p>
        <h1 className="mt-3 font-serif text-4xl font-medium tracking-tight text-foreground">
          {t('Storekeeper')}
        </h1>
        <p className="mt-3 text-base leading-relaxed text-muted-foreground">
          {t('Enter your PIN to issue and weigh fuel. Prices are not shown.')}
        </p>
        <form onSubmit={onLogin} className="mt-10 space-y-4">
          <label className="block">
            <span className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
              {t('PIN')}
            </span>
            <input
              type="password"
              inputMode="numeric"
              autoComplete="one-time-code"
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              className="mt-2 min-h-14 w-full rounded-2xl border border-border bg-card px-5 py-4 text-center text-2xl tracking-[0.4em] text-foreground outline-none ring-accent focus:ring-2"
              placeholder="••••"
            />
          </label>
          {loginErr && (
            <p className="text-sm" style={{ color: DUE_TONE.overdue.fg }}>
              {loginErr}
            </p>
          )}
          <button
            type="submit"
            className="flex min-h-14 w-full items-center justify-center rounded-2xl bg-primary text-base font-semibold text-primary-foreground"
          >
            {t('Enter')}
          </button>
        </form>
        <p className="mt-8 text-center text-xs text-muted-foreground">
          {t('Add to Home Screen to use as an app.')}
        </p>
      </main>
    )
  }

  return (
    <main
      className="mx-auto min-h-dvh max-w-md px-4 pb-10"
      style={{
        paddingTop: 'max(1rem, env(safe-area-inset-top))',
        paddingBottom: 'max(2.5rem, env(safe-area-inset-bottom))',
      }}
    >
      <header className="flex items-start justify-between gap-3 pt-2">
        <div>
          <p className="flex items-center gap-3 text-[11px] font-medium uppercase tracking-[0.3em] text-accent">
            <span className="h-px w-8 bg-accent" />
            AAM
          </p>
          <h1 className="mt-2 font-serif text-3xl font-medium text-foreground">
            {t('Storekeeper')}
          </h1>
        </div>
        <div className="flex flex-col items-end gap-2">
          <LangSwitch />
          <button
            type="button"
            onClick={() => void onLogout()}
            className="flex min-h-12 min-w-12 items-center justify-center rounded-full border border-border bg-card text-muted-foreground"
            aria-label={t('Sign out')}
          >
            <LogOut className="h-5 w-5" />
          </button>
        </div>
      </header>

      {(pending && !state) || loadErr ? (
        <div className="mt-10 flex items-center gap-3 text-sm text-muted-foreground">
          {loadErr ? (
            <span style={{ color: DUE_TONE.overdue.fg }}>{loadErr}</span>
          ) : (
            <>
              <Loader2 className="h-5 w-5 animate-spin" />
              {t('Reading stock…')}
            </>
          )}
        </div>
      ) : null}

      {state && screen === 'home' && (
        <Home
          state={state}
          busy={pending}
          onRefresh={() => startTransition(() => void refresh())}
          onIi={() => setScreen('ii')}
          onIii={() => setScreen('iii')}
        />
      )}
      {state && screen === 'ii' && (
        <IssueIi
          stock={state.stockLitres}
          density={state.densityKgPerL}
          skippers={state.skippers}
          busy={pending}
          onBack={() => setScreen('home')}
          onDone={(s) => {
            setState(s)
            setScreen('home')
          }}
        />
      )}
      {state && screen === 'iii' && (
        <IiiMenu
          onBack={() => setScreen('home')}
          onReturn={() => setScreen('iii-return')}
          onFill={() => setScreen('iii-fill')}
        />
      )}
      {state && screen === 'iii-return' && (
        <WeighReturn
          density={state.densityKgPerL}
          can={state.can}
          skippers={state.skippers}
          busy={pending}
          onBack={() => setScreen('iii')}
          onDone={(s) => {
            setState(s)
            setScreen('home')
          }}
        />
      )}
      {state && screen === 'iii-fill' && (
        <WeighFill
          density={state.densityKgPerL}
          stock={state.stockLitres}
          can={state.can}
          skippers={state.skippers}
          busy={pending}
          onBack={() => setScreen('iii')}
          onDone={(s) => {
            setState(s)
            setScreen('home')
          }}
        />
      )}
    </main>
  )
}

function Home({
  state,
  busy,
  onRefresh,
  onIi,
  onIii,
}: {
  state: HisnikState
  busy: boolean
  onRefresh: () => void
  onIi: () => void
  onIii: () => void
}) {
  const { t, lang } = useLang()
  const can = state.can
  return (
    <div className="mt-6 space-y-5">
      <section className="overflow-hidden rounded-2xl border border-border bg-card">
        <header className="bg-panel-header p-5">
          <div className="flex items-center gap-2 text-panel-header-foreground/55">
            <Warehouse className="h-4 w-4" />
            <span className="text-[10px] uppercase tracking-[0.22em]">
              {t('Warehouse stock')}
            </span>
          </div>
          <p className="mt-3 font-serif text-5xl tabular-nums tracking-tight text-panel-header-foreground">
            {fmtL(state.stockLitres, lang)}
          </p>
          <p className="mt-1 text-sm tabular-nums text-panel-header-foreground/55">
            ≈ {fmtKg(state.stockKg, lang)} · {t('density')} {state.densityKgPerL}{' '}
            kg/L
          </p>
        </header>
        <div className="p-5">
          <p className="text-xs leading-relaxed text-muted-foreground">
            {t('Warehouse cans 20 L and 25 L — poured into skipper cans.')}
          </p>
          <button
            type="button"
            onClick={onRefresh}
            disabled={busy}
            className="mt-3 text-xs font-medium text-accent underline-offset-2 hover:underline disabled:opacity-50"
          >
            {t('Refresh')}
          </button>
        </div>
      </section>

      {/* Boat choice only — Odyssey III actions open on the next screen. */}
      <section className="grid gap-3">
        <BigButton
          icon={<Ship className="h-6 w-6" />}
          title={t('Odyssey II')}
          subtitle={t('Issue 1 or 2 × 25 L')}
          onClick={onIi}
          tone="accent"
        />
        <BigButton
          icon={<Ship className="h-6 w-6" />}
          title={t('Odyssey III')}
          subtitle={t('Portable can · daily cycle')}
          onClick={onIii}
          tone="ok"
        />
      </section>

      <section className="rounded-2xl border border-border bg-card p-5">
        <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
          {t('Portable can III')}
        </p>
        <p className="mt-2 text-lg text-foreground">
          {can.location === 'with_skipper' ? t('With skipper') : t('At warehouse')}
        </p>
        <p className="mt-1 text-sm tabular-nums text-muted-foreground">
          {can.lastLitres != null
            ? `${t('Last weight / contents:')} ${fmtL(can.lastLitres, lang)}${
                can.lastKilograms != null
                  ? ` · ${fmtKg(can.lastKilograms, lang)}`
                  : ''
              }`
            : t('No weighing yet')}
          {can.issuedLitres != null
            ? ` · ${t('issued')} ${fmtL(can.issuedLitres, lang)}`
            : ''}
        </p>
      </section>

      <section className="rounded-2xl border border-border bg-card p-5">
        <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
          {t('Today')}
        </p>
        {state.today.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">{t('No entries yet.')}</p>
        ) : (
          <ul className="mt-3 divide-y divide-border">
            {state.today.map((e) => (
              <li
                key={e.id}
                className="flex items-start justify-between gap-3 py-3 first:pt-0 last:pb-0"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm text-foreground">
                    {eventLabel(e, t)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {timeFmt(e.occurredAt, lang)}
                    {e.note
                      ? ` · ${e.note
                          .replace(/^Hišnik ·\s*/, '')
                          .replace(/^Skladiščnik ·\s*/, '')
                          .replace(/^Gardien ·\s*/, '')
                          .replace(/^Magasinier ·\s*/, '')}`
                      : ''}
                  </p>
                </div>
                <span
                  className="flex-shrink-0 text-sm font-semibold tabular-nums"
                  style={{
                    color:
                      e.type === 'refuel' ? DUE_TONE.due.fg : DUE_TONE.soon.fg,
                  }}
                >
                  {e.type === 'refuel'
                    ? `−${fmtL(Math.abs(e.litres), lang)}`
                    : fmtL(e.litres, lang)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}

/** Odyssey III submenu: the two daily-cycle actions (after trip / morning). */
function IiiMenu({
  onBack,
  onReturn,
  onFill,
}: {
  onBack: () => void
  onReturn: () => void
  onFill: () => void
}) {
  const { t } = useLang()
  return (
    <div className="space-y-5">
      <BackBar label={t('Odyssey III')} onBack={onBack} />
      <section className="grid gap-3">
        <BigButton
          icon={<Scale className="h-6 w-6" />}
          title={t('Odyssey III · returned can')}
          subtitle={t('After the trip: weigh consumption (no stock change)')}
          onClick={onReturn}
          tone="due"
        />
        <BigButton
          icon={<Droplet className="h-6 w-6" />}
          title={t('Odyssey III · weigh + fill')}
          subtitle={t('Morning: weigh, fill from stock, issue')}
          onClick={onFill}
          tone="ok"
        />
      </section>
    </div>
  )
}

function BigButton({
  icon,
  title,
  subtitle,
  onClick,
  tone,
}: {
  icon: React.ReactNode
  title: string
  subtitle: string
  onClick: () => void
  tone: 'accent' | 'due' | 'ok'
}) {
  const color =
    tone === 'accent'
      ? 'var(--accent)'
      : tone === 'due'
        ? DUE_TONE.due.fg
        : DUE_TONE.ok.fg
  const bg =
    tone === 'accent'
      ? 'color-mix(in oklab, var(--accent) 14%, transparent)'
      : tone === 'due'
        ? DUE_TONE.due.bg
        : DUE_TONE.ok.bg

  return (
    <button
      type="button"
      onClick={onClick}
      className="flex min-h-[5.5rem] w-full items-center gap-4 rounded-2xl border border-border bg-card px-5 text-left transition-transform active:scale-[0.99]"
    >
      <span
        className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-xl"
        style={{ background: bg, color }}
      >
        {icon}
      </span>
      <span className="min-w-0">
        <span className="block text-lg font-semibold text-foreground">{title}</span>
        <span className="mt-0.5 block text-sm text-muted-foreground">{subtitle}</span>
      </span>
    </button>
  )
}

function BackBar({ label, onBack }: { label: string; onBack: () => void }) {
  const { t } = useLang()
  return (
    <div className="mt-4 flex items-center gap-3">
      <button
        type="button"
        onClick={onBack}
        className="min-h-12 rounded-full border border-border bg-card px-4 text-sm text-muted-foreground"
      >
        {t('Back')}
      </button>
      <h2 className="font-serif text-2xl font-medium text-foreground">{label}</h2>
    </div>
  )
}

function UnitToggle({
  unit,
  onChange,
}: {
  unit: HisnikUnit
  onChange: (u: HisnikUnit) => void
}) {
  const { t } = useLang()
  return (
    <div className="grid grid-cols-2 gap-1.5 rounded-2xl border border-border bg-secondary/40 p-1">
      {(['litres', 'kg'] as const).map((u) => (
        <button
          key={u}
          type="button"
          onClick={() => onChange(u)}
          className={`min-h-12 rounded-xl text-sm font-semibold transition-colors ${
            unit === u
              ? 'bg-primary text-primary-foreground'
              : 'text-muted-foreground hover:bg-secondary'
          }`}
        >
          {u === 'litres' ? t('Litres') : t('Kilograms')}
        </button>
      ))}
    </div>
  )
}

function QtyField({
  value,
  onChange,
  unit,
  density,
  label,
}: {
  value: string
  onChange: (v: string) => void
  unit: HisnikUnit
  density: number
  label?: string
}) {
  const { t, lang } = useLang()
  const n = Number(value.replace(',', '.'))
  const other =
    Number.isFinite(n) && n > 0
      ? unit === 'litres'
        ? `≈ ${fmtKg(n * density, lang)}`
        : `≈ ${fmtL(n / density, lang)}`
      : null
  return (
    <label className="block">
      <span className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
        {label ??
          (unit === 'litres' ? t('Quantity (L)') : t('Quantity (kg)'))}
      </span>
      <input
        type="text"
        inputMode="decimal"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-2 min-h-14 w-full rounded-2xl border border-border bg-card px-5 py-4 text-center text-3xl tabular-nums text-foreground outline-none ring-accent focus:ring-2"
        placeholder="0"
      />
      {other && (
        <p className="mt-2 text-center text-sm text-muted-foreground">{other}</p>
      )}
    </label>
  )
}

function SkipperPicker({
  skippers,
  skipperId,
  skipperName,
  onSelectId,
  onName,
}: {
  skippers: HisnikSkipper[]
  skipperId: string
  skipperName: string
  onSelectId: (id: string) => void
  onName: (name: string) => void
}) {
  const { t } = useLang()
  return (
    <div className="space-y-2">
      <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
        {t('Skipper')}
      </p>
      {skippers.length > 0 ? (
        <div className="grid gap-2">
          {skippers.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => onSelectId(s.id)}
              className={`min-h-14 rounded-2xl border px-4 text-left text-base font-semibold transition-colors ${
                skipperId === s.id
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'border-border bg-card text-foreground'
              }`}
            >
              {s.name}
            </button>
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">
          {t('No skippers yet — add captains in admin, or type a name.')}
        </p>
      )}
      {!skipperId && (
        <input
          type="text"
          value={skipperName}
          onChange={(e) => onName(e.target.value)}
          placeholder={t('Skipper name')}
          className="min-h-12 w-full rounded-2xl border border-border bg-card px-4 text-base text-foreground outline-none ring-accent focus:ring-2"
        />
      )}
    </div>
  )
}

function IssueIi({
  stock,
  density,
  skippers,
  busy,
  onBack,
  onDone,
}: {
  stock: number
  density: number
  skippers: HisnikSkipper[]
  busy: boolean
  onBack: () => void
  onDone: (s: HisnikState) => void
}) {
  const { t, lang } = useLang()
  const [cans, setCans] = useState<1 | 2>(1)
  const [skipperId, setSkipperId] = useState('')
  const [skipperName, setSkipperName] = useState('')
  const [weighUnit, setWeighUnit] = useState<HisnikUnit>('kg')
  const [weighQty, setWeighQty] = useState('')
  const [err, setErr] = useState<string | null>(null)
  const [working, setWorking] = useState(false)

  const need = cans * ODYSSEY_II_CAN_L
  const skipperOk = Boolean(skipperId || skipperName.trim())
  const canConfirm =
    skipperOk && weighQty.trim() !== '' && stock + 1e-6 >= need && !busy && !working

  async function confirm() {
    setErr(null)
    setWorking(true)
    try {
      const s = await hisnikIssueOdysseyIi({
        cans,
        skipperId: skipperId || null,
        skipperName: skipperId ? null : skipperName,
        weighUnit,
        weighQty: Number(weighQty.replace(',', '.')),
      })
      onDone(s)
    } catch (e) {
      setErr(terr(t, e))
    } finally {
      setWorking(false)
    }
  }

  return (
    <div className="space-y-5">
      <BackBar label={t('Odyssey II')} onBack={onBack} />
      <p className="text-sm text-muted-foreground">
        {t('The boat has room for 1 or 2 cans of 25 L. Stock:')}{' '}
        <span className="font-semibold text-foreground">{fmtL(stock, lang)}</span>
      </p>

      <div className="grid grid-cols-2 gap-2">
        {([1, 2] as const).map((n) => (
          <button
            key={n}
            type="button"
            disabled={stock < n * ODYSSEY_II_CAN_L}
            onClick={() => setCans(n)}
            className={`min-h-16 rounded-2xl border text-base font-semibold disabled:opacity-40 ${
              cans === n
                ? 'border-primary bg-primary text-primary-foreground'
                : 'border-border bg-card text-foreground'
            }`}
          >
            {n === 1 ? t('1 can (25 L)') : t('2 cans (50 L)')}
          </button>
        ))}
      </div>

      <SkipperPicker
        skippers={skippers}
        skipperId={skipperId}
        skipperName={skipperName}
        onSelectId={(id) => {
          setSkipperId(id)
          setSkipperName('')
        }}
        onName={(name) => {
          setSkipperName(name)
          setSkipperId('')
        }}
      />

      <div className="space-y-2">
        <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
          {t('Weighed amount')}
        </p>
        <UnitToggle unit={weighUnit} onChange={setWeighUnit} />
        <QtyField
          value={weighQty}
          onChange={setWeighQty}
          unit={weighUnit}
          density={density}
          label={t('Weighed amount')}
        />
      </div>

      <button
        type="button"
        disabled={!canConfirm}
        onClick={() => void confirm()}
        className="flex min-h-16 w-full items-center justify-center rounded-2xl bg-primary text-lg font-semibold text-primary-foreground disabled:opacity-40"
      >
        {working ? <Loader2 className="h-6 w-6 animate-spin" /> : t('Confirm issue')}
      </button>
      {err && (
        <p className="text-sm" style={{ color: DUE_TONE.overdue.fg }}>
          {err}
        </p>
      )}
    </div>
  )
}

function WeighReturn({
  density,
  can,
  skippers,
  busy,
  onBack,
  onDone,
}: {
  density: number
  can: HisnikState['can']
  skippers: HisnikSkipper[]
  busy: boolean
  onBack: () => void
  onDone: (s: HisnikState) => void
}) {
  const { t, lang } = useLang()
  const [unit, setUnit] = useState<HisnikUnit>('kg')
  const [qty, setQty] = useState('')
  const [skipperId, setSkipperId] = useState('')
  const [skipperName, setSkipperName] = useState('')
  const [err, setErr] = useState<string | null>(null)
  const [working, setWorking] = useState(false)

  const skipperOk = Boolean(skipperId || skipperName.trim())

  async function submit() {
    setErr(null)
    setWorking(true)
    try {
      const s = await hisnikWeighReturn({
        unit,
        qty: Number(qty.replace(',', '.')),
        skipperId: skipperId || null,
        skipperName: skipperId ? null : skipperName,
      })
      onDone(s)
    } catch (e) {
      setErr(terr(t, e))
    } finally {
      setWorking(false)
    }
  }

  const issuedHint =
    can.issuedLitres != null
      ? `${t('Baseline at issue:')} ${fmtL(can.issuedLitres, lang)}`
      : null

  return (
    <div className="space-y-5">
      <BackBar label={t('Returned can')} onBack={onBack} />
      <p className="text-sm text-muted-foreground">
        {t(
          'Weigh the can after the trip. Consumption is calculated; warehouse stock does not change. The can stays until tomorrow.',
        )}
      </p>
      {issuedHint && (
        <p className="text-sm font-medium" style={{ color: DUE_TONE.due.fg }}>
          {issuedHint}
        </p>
      )}
      <SkipperPicker
        skippers={skippers}
        skipperId={skipperId}
        skipperName={skipperName}
        onSelectId={(id) => {
          setSkipperId(id)
          setSkipperName('')
        }}
        onName={(name) => {
          setSkipperName(name)
          setSkipperId('')
        }}
      />
      <UnitToggle unit={unit} onChange={setUnit} />
      <QtyField
        value={qty}
        onChange={setQty}
        unit={unit}
        density={density}
        label={t('Weighed amount')}
      />
      <button
        type="button"
        disabled={busy || working || !qty || !skipperOk}
        onClick={() => void submit()}
        className="flex min-h-16 w-full items-center justify-center rounded-2xl text-lg font-semibold disabled:opacity-40"
        style={{ background: DUE_TONE.due.fg, color: '#132a42' }}
      >
        {working ? <Loader2 className="h-6 w-6 animate-spin" /> : t('Save weighing')}
      </button>
      {err && (
        <p className="text-sm" style={{ color: DUE_TONE.overdue.fg }}>
          {err}
        </p>
      )}
    </div>
  )
}

function WeighFill({
  density,
  stock,
  can,
  skippers,
  busy,
  onBack,
  onDone,
}: {
  density: number
  stock: number
  can: HisnikState['can']
  skippers: HisnikSkipper[]
  busy: boolean
  onBack: () => void
  onDone: (s: HisnikState) => void
}) {
  const { t, lang } = useLang()
  const [weighUnit, setWeighUnit] = useState<HisnikUnit>('kg')
  const [fillUnit, setFillUnit] = useState<HisnikUnit>('litres')
  const [weighQty, setWeighQty] = useState(
    can.lastLitres != null && can.location === 'at_warehouse'
      ? String(can.lastKilograms ?? can.lastLitres)
      : '',
  )
  const [fillQty, setFillQty] = useState('')
  const [skipperId, setSkipperId] = useState('')
  const [skipperName, setSkipperName] = useState('')
  const [err, setErr] = useState<string | null>(null)
  const [working, setWorking] = useState(false)

  useEffect(() => {
    if (can.lastKilograms != null && can.location === 'at_warehouse') {
      setWeighUnit('kg')
      setWeighQty(String(can.lastKilograms))
    } else if (can.lastLitres != null && can.location === 'at_warehouse') {
      setWeighUnit('litres')
      setWeighQty(String(can.lastLitres))
    }
  }, [can])

  const skipperOk = Boolean(skipperId || skipperName.trim())

  async function submit() {
    setErr(null)
    setWorking(true)
    try {
      const s = await hisnikWeighFillIssue({
        weighUnit,
        weighQty: Number(weighQty.replace(',', '.')),
        fillUnit,
        fillQty: Number(fillQty.replace(',', '.')),
        skipperId: skipperId || null,
        skipperName: skipperId ? null : skipperName,
      })
      onDone(s)
    } catch (e) {
      setErr(terr(t, e))
    } finally {
      setWorking(false)
    }
  }

  return (
    <div className="space-y-5">
      <BackBar label={t('Fill + issue')} onBack={onBack} />
      <p className="text-sm text-muted-foreground">
        {t(
          'Morning: weigh again, fill from the warehouse, give to the skipper. Stock decreases only by the filled litres. Current stock:',
        )}{' '}
        <span className="font-semibold text-foreground">{fmtL(stock, lang)}</span>
      </p>

      <div className="space-y-3">
        <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
          {t('1. Weighing before fill')}
        </p>
        <UnitToggle unit={weighUnit} onChange={setWeighUnit} />
        <QtyField
          value={weighQty}
          onChange={setWeighQty}
          unit={weighUnit}
          density={density}
          label={t('Weighed amount')}
        />
      </div>

      <div className="space-y-3">
        <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
          {t('2. Fill from stock')}
        </p>
        <UnitToggle unit={fillUnit} onChange={setFillUnit} />
        <QtyField
          value={fillQty}
          onChange={setFillQty}
          unit={fillUnit}
          density={density}
          label={t('Weighed amount')}
        />
      </div>

      <SkipperPicker
        skippers={skippers}
        skipperId={skipperId}
        skipperName={skipperName}
        onSelectId={(id) => {
          setSkipperId(id)
          setSkipperName('')
        }}
        onName={(name) => {
          setSkipperName(name)
          setSkipperId('')
        }}
      />

      <button
        type="button"
        disabled={busy || working || !weighQty || !fillQty || !skipperOk}
        onClick={() => void submit()}
        className="flex min-h-16 w-full items-center justify-center rounded-2xl bg-primary text-lg font-semibold text-primary-foreground disabled:opacity-40"
      >
        {working ? (
          <Loader2 className="h-6 w-6 animate-spin" />
        ) : (
          t('Confirm weighing, fill and issue')
        )}
      </button>
      {err && (
        <p className="text-sm" style={{ color: DUE_TONE.overdue.fg }}>
          {err}
        </p>
      )}
    </div>
  )
}
