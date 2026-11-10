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
  type HisnikState,
  type HisnikUnit,
} from '@/app/actions/hisnik-fuel'
import { ODYSSEY_II_CAN_L } from '@/lib/fuel-units'
import { DUE_TONE } from '@/lib/maintenance'

type Screen = 'home' | 'ii' | 'iii-return' | 'iii-fill'

function fmtL(n: number) {
  return `${(Math.round(n * 10) / 10).toLocaleString('sl-SI', { maximumFractionDigits: 1 })} L`
}

function fmtKg(n: number) {
  return `${(Math.round(n * 10) / 10).toLocaleString('sl-SI', { maximumFractionDigits: 1 })} kg`
}

function timeFmt(iso: string) {
  return new Date(iso).toLocaleTimeString('sl-SI', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Indian/Antananarivo',
  })
}

function eventLabel(e: HisnikState['today'][number]): string {
  if (e.eventType === 'issue') return `Odyssey II · izdaja`
  if (e.eventType === 'weigh-return') return `III · vrnjena kanta`
  if (e.eventType === 'weigh-morning') return `III · jutranje tehtanje`
  if (e.eventType === 'fill-issue') return `III · natočeno + izdano`
  if (e.type === 'refuel') return `Izdaja · ${e.boatLabel ?? ''}`
  if (e.type === 'weigh') return `Tehtanje · ${e.boatLabel ?? ''}`
  return e.type
}

export function HisnikApp({ initiallyAuthed }: { initiallyAuthed: boolean }) {
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
      setLoadErr(e instanceof Error ? e.message : 'Napaka pri branju')
    }
  }

  useEffect(() => {
    if (!authed) return
    startTransition(() => {
      void refresh()
    })
  }, [authed])

  async function onLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoginErr(null)
    const res = await caretakerLogin(pin)
    if (!res.ok) {
      setLoginErr(res.error)
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
        <p className="flex items-center gap-3 text-[11px] font-medium uppercase tracking-[0.3em] text-accent">
          <span className="h-px w-8 bg-accent" />
          AAM · Gorivo
        </p>
        <h1 className="mt-3 font-serif text-4xl font-medium tracking-tight text-foreground">
          Hišnik
        </h1>
        <p className="mt-3 text-base leading-relaxed text-muted-foreground">
          Vnesi PIN za izdajo in tehtanje goriva. Cene niso prikazane.
        </p>
        <form onSubmit={onLogin} className="mt-10 space-y-4">
          <label className="block">
            <span className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
              PIN
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
            Vstopi
          </button>
        </form>
        <p className="mt-8 text-center text-xs text-muted-foreground">
          Dodaj na začetni zaslon za uporabo kot aplikacijo.
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
            Hišnik
          </h1>
        </div>
        <button
          type="button"
          onClick={() => void onLogout()}
          className="flex min-h-12 min-w-12 items-center justify-center rounded-full border border-border bg-card text-muted-foreground"
          aria-label="Odjava"
        >
          <LogOut className="h-5 w-5" />
        </button>
      </header>

      {(pending && !state) || loadErr ? (
        <div className="mt-10 flex items-center gap-3 text-sm text-muted-foreground">
          {loadErr ? (
            <span style={{ color: DUE_TONE.overdue.fg }}>{loadErr}</span>
          ) : (
            <>
              <Loader2 className="h-5 w-5 animate-spin" />
              Berem zalogo…
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
          onReturn={() => setScreen('iii-return')}
          onFill={() => setScreen('iii-fill')}
        />
      )}
      {state && screen === 'ii' && (
        <IssueIi
          stock={state.stockLitres}
          busy={pending}
          onBack={() => setScreen('home')}
          onDone={(s) => {
            setState(s)
            setScreen('home')
          }}
        />
      )}
      {state && screen === 'iii-return' && (
        <WeighReturn
          density={state.densityKgPerL}
          can={state.can}
          busy={pending}
          onBack={() => setScreen('home')}
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
          busy={pending}
          onBack={() => setScreen('home')}
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
  onReturn,
  onFill,
}: {
  state: HisnikState
  busy: boolean
  onRefresh: () => void
  onIi: () => void
  onReturn: () => void
  onFill: () => void
}) {
  const can = state.can
  return (
    <div className="mt-6 space-y-5">
      <section className="overflow-hidden rounded-2xl border border-border bg-card">
        <header className="bg-panel-header p-5">
          <div className="flex items-center gap-2 text-panel-header-foreground/55">
            <Warehouse className="h-4 w-4" />
            <span className="text-[10px] uppercase tracking-[0.22em]">
              Zaloga skladišča
            </span>
          </div>
          <p className="mt-3 font-serif text-5xl tabular-nums tracking-tight text-panel-header-foreground">
            {fmtL(state.stockLitres)}
          </p>
          <p className="mt-1 text-sm tabular-nums text-panel-header-foreground/55">
            ≈ {fmtKg(state.stockKg)} · gostota {state.densityKgPerL} kg/L
          </p>
        </header>
        <div className="p-5">
          <p className="text-xs leading-relaxed text-muted-foreground">
            Skladiščne kante 20 L in 25 L — pretok v kante skiperjev.
          </p>
          <button
            type="button"
            onClick={onRefresh}
            disabled={busy}
            className="mt-3 text-xs font-medium text-accent underline-offset-2 hover:underline disabled:opacity-50"
          >
            Osveži
          </button>
        </div>
      </section>

      <section className="grid gap-3">
        <BigButton
          icon={<Ship className="h-6 w-6" />}
          title="Odyssey II"
          subtitle={`Izdaj 1 ali 2 × ${ODYSSEY_II_CAN_L} L`}
          onClick={onIi}
          tone="accent"
        />
        <BigButton
          icon={<Scale className="h-6 w-6" />}
          title="Odyssey III · vrnjena kanta"
          subtitle="Po vožnji: stehtaj porabo (brez zaloge)"
          onClick={onReturn}
          tone="due"
        />
        <BigButton
          icon={<Droplet className="h-6 w-6" />}
          title="Odyssey III · stehtaj + natoči"
          subtitle="Zjutraj: tehtaj, natoči iz zaloge, izdaj"
          onClick={onFill}
          tone="ok"
        />
      </section>

      <section className="rounded-2xl border border-border bg-card p-5">
        <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
          Prenosna kanta III
        </p>
        <p className="mt-2 text-lg text-foreground">
          {can.location === 'with_skipper' ? 'Pri skiperju' : 'V skladišču'}
        </p>
        <p className="mt-1 text-sm tabular-nums text-muted-foreground">
          {can.lastLitres != null
            ? `Zadnja teža / vsebina: ${fmtL(can.lastLitres)}${
                can.lastKilograms != null ? ` · ${fmtKg(can.lastKilograms)}` : ''
              }`
            : 'Še ni tehtanja'}
          {can.issuedLitres != null ? ` · izdano ${fmtL(can.issuedLitres)}` : ''}
        </p>
      </section>

      <section className="rounded-2xl border border-border bg-card p-5">
        <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
          Danes
        </p>
        {state.today.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">Še ni vnosov.</p>
        ) : (
          <ul className="mt-3 divide-y divide-border">
            {state.today.map((e) => (
              <li
                key={e.id}
                className="flex items-start justify-between gap-3 py-3 first:pt-0 last:pb-0"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm text-foreground">{eventLabel(e)}</p>
                  <p className="text-xs text-muted-foreground">
                    {timeFmt(e.occurredAt)}
                    {e.note ? ` · ${e.note.replace(/^Hišnik ·\s*/, '')}` : ''}
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
                    ? `−${fmtL(Math.abs(e.litres))}`
                    : fmtL(e.litres)}
                </span>
              </li>
            ))}
          </ul>
        )}
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
  return (
    <div className="mt-4 flex items-center gap-3">
      <button
        type="button"
        onClick={onBack}
        className="min-h-12 rounded-full border border-border bg-card px-4 text-sm text-muted-foreground"
      >
        Nazaj
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
          {u === 'litres' ? 'Litri' : 'Kilogrami'}
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
}: {
  value: string
  onChange: (v: string) => void
  unit: HisnikUnit
  density: number
}) {
  const n = Number(value.replace(',', '.'))
  const other =
    Number.isFinite(n) && n > 0
      ? unit === 'litres'
        ? `≈ ${fmtKg(n * density)}`
        : `≈ ${fmtL(n / density)}`
      : null
  return (
    <label className="block">
      <span className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
        Količina ({unit === 'litres' ? 'L' : 'kg'})
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

function IssueIi({
  stock,
  busy,
  onBack,
  onDone,
}: {
  stock: number
  busy: boolean
  onBack: () => void
  onDone: (s: HisnikState) => void
}) {
  const [err, setErr] = useState<string | null>(null)
  const [working, setWorking] = useState(false)

  async function issue(cans: 1 | 2) {
    setErr(null)
    setWorking(true)
    try {
      const s = await hisnikIssueOdysseyIi(cans)
      onDone(s)
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Napaka')
    } finally {
      setWorking(false)
    }
  }

  return (
    <div className="space-y-5">
      <BackBar label="Odyssey II" onBack={onBack} />
      <p className="text-sm text-muted-foreground">
        Na čolnu je prostor za 1 ali 2 kanti po {ODYSSEY_II_CAN_L} L. Zaloga:{' '}
        <span className="font-semibold text-foreground">{fmtL(stock)}</span>
      </p>
      <div className="grid gap-3">
        <button
          type="button"
          disabled={busy || working || stock < ODYSSEY_II_CAN_L}
          onClick={() => void issue(1)}
          className="flex min-h-20 items-center justify-center rounded-2xl bg-accent text-xl font-semibold text-accent-foreground disabled:opacity-40"
        >
          {working ? (
            <Loader2 className="h-6 w-6 animate-spin" />
          ) : (
            `Izdaj ${ODYSSEY_II_CAN_L} L (1 kanta)`
          )}
        </button>
        <button
          type="button"
          disabled={busy || working || stock < ODYSSEY_II_CAN_L * 2}
          onClick={() => void issue(2)}
          className="flex min-h-20 items-center justify-center rounded-2xl bg-primary text-xl font-semibold text-primary-foreground disabled:opacity-40"
        >
          {working ? (
            <Loader2 className="h-6 w-6 animate-spin" />
          ) : (
            `Izdaj ${ODYSSEY_II_CAN_L * 2} L (2 kanti)`
          )}
        </button>
      </div>
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
  busy,
  onBack,
  onDone,
}: {
  density: number
  can: HisnikState['can']
  busy: boolean
  onBack: () => void
  onDone: (s: HisnikState) => void
}) {
  const [unit, setUnit] = useState<HisnikUnit>('kg')
  const [qty, setQty] = useState('')
  const [err, setErr] = useState<string | null>(null)
  const [working, setWorking] = useState(false)

  async function submit() {
    setErr(null)
    setWorking(true)
    try {
      const s = await hisnikWeighReturn({
        unit,
        qty: Number(qty.replace(',', '.')),
      })
      onDone(s)
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Napaka')
    } finally {
      setWorking(false)
    }
  }

  const issuedHint =
    can.issuedLitres != null ? `Izhodišče ob izdaji: ${fmtL(can.issuedLitres)}` : null

  return (
    <div className="space-y-5">
      <BackBar label="Vrnjena kanta" onBack={onBack} />
      <p className="text-sm text-muted-foreground">
        Stehtaj kanto po vožnji. Poraba se izračuna; zaloga skladišča se ne
        spremeni. Kanta ostane do jutri.
      </p>
      {issuedHint && (
        <p className="text-sm font-medium" style={{ color: DUE_TONE.due.fg }}>
          {issuedHint}
        </p>
      )}
      <UnitToggle unit={unit} onChange={setUnit} />
      <QtyField value={qty} onChange={setQty} unit={unit} density={density} />
      <button
        type="button"
        disabled={busy || working || !qty}
        onClick={() => void submit()}
        className="flex min-h-16 w-full items-center justify-center rounded-2xl text-lg font-semibold disabled:opacity-40"
        style={{ background: DUE_TONE.due.fg, color: '#132a42' }}
      >
        {working ? <Loader2 className="h-6 w-6 animate-spin" /> : 'Shrani tehtanje'}
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
  busy,
  onBack,
  onDone,
}: {
  density: number
  stock: number
  can: HisnikState['can']
  busy: boolean
  onBack: () => void
  onDone: (s: HisnikState) => void
}) {
  const [weighUnit, setWeighUnit] = useState<HisnikUnit>('kg')
  const [fillUnit, setFillUnit] = useState<HisnikUnit>('litres')
  const [weighQty, setWeighQty] = useState(
    can.lastLitres != null && can.location === 'at_warehouse'
      ? String(can.lastKilograms ?? can.lastLitres)
      : '',
  )
  const [fillQty, setFillQty] = useState('')
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

  async function submit() {
    setErr(null)
    setWorking(true)
    try {
      const s = await hisnikWeighFillIssue({
        weighUnit,
        weighQty: Number(weighQty.replace(',', '.')),
        fillUnit,
        fillQty: Number(fillQty.replace(',', '.')),
      })
      onDone(s)
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Napaka')
    } finally {
      setWorking(false)
    }
  }

  return (
    <div className="space-y-5">
      <BackBar label="Natoči + izdaj" onBack={onBack} />
      <p className="text-sm text-muted-foreground">
        Zjutraj: spet stehtaj, natoči iz skladišča, daj skiperju. Zaloga se
        zmanjša samo za natočene litre. Trenutna zaloga:{' '}
        <span className="font-semibold text-foreground">{fmtL(stock)}</span>
      </p>

      <div className="space-y-3">
        <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
          1. Tehtanje pred natočitvijo
        </p>
        <UnitToggle unit={weighUnit} onChange={setWeighUnit} />
        <QtyField
          value={weighQty}
          onChange={setWeighQty}
          unit={weighUnit}
          density={density}
        />
      </div>

      <div className="space-y-3">
        <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
          2. Natoči iz zaloge
        </p>
        <UnitToggle unit={fillUnit} onChange={setFillUnit} />
        <QtyField
          value={fillQty}
          onChange={setFillQty}
          unit={fillUnit}
          density={density}
        />
      </div>

      <button
        type="button"
        disabled={busy || working || !weighQty || !fillQty}
        onClick={() => void submit()}
        className="flex min-h-16 w-full items-center justify-center rounded-2xl bg-primary text-lg font-semibold text-primary-foreground disabled:opacity-40"
      >
        {working ? (
          <Loader2 className="h-6 w-6 animate-spin" />
        ) : (
          'Potrdi tehtanje, natočitev in izdajo'
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
