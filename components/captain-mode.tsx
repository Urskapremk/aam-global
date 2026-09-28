'use client'

import {
  Anchor,
  Ban,
  Camera,
  Check,
  ChevronDown,
  Compass,
  Fish,
  Loader2,
  MapPin,
  Radio,
  Ship,
  Sunset,
  TriangleAlert,
  Wifi,
  WifiOff,
} from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import useSWR from 'swr'

import {
  endTripAsCaptain,
  getCaptainBoard,
  startTripAsCaptain,
  type CaptainBoard,
} from '@/app/actions/fleet'
import {
  attachCatchPhoto,
  logCatchesBatch,
  type CatchInput,
} from '@/app/actions/fishing'
import { TRIP_PURPOSES } from '@/lib/fleet'

/**
 * Captain Mode — the phone screen used on the boat.
 *
 * Deliberately dark with literal colours rather than design tokens: this
 * screen is read in direct sun and at night on the water, so it must not flip
 * with the admin's light/dark mode. The palette is the one already established
 * for navy surfaces elsewhere in the app (sage / amber / sky / pink).
 *
 * Every target is >= 56 px. The captain is standing on a moving deck with wet
 * hands, so the 44 px used in the office is not enough here.
 */

// Device identity, not data: the token lets this phone report for one boat.
// Kept so a reload or a screen lock does not send the captain back to a blank
// screen mid-trip. The positions themselves live in the database.
const TOKEN_KEY = 'aam-captain-token'
// Fixes taken while offline wait here. Without this the whole track of a trip
// through a dead-signal stretch would simply be lost.
const BUFFER_KEY = 'aam-captain-buffer'

const NAVY = '#0d2233'
const CARD = '#143a49'
const SAGE = '#8fae92'
const AMBER = '#e0b877'
const SKY = '#9ecbdd'
const PINK = '#f0a8b4'
const GOLD = '#c59b5b'

type Fix = {
  lat: number
  lon: number
  speedKn?: number | null
  headingDeg?: number | null
  accuracyM?: number | null
  recordedAt: string
}

const readBuffer = (): Fix[] => {
  try {
    const raw = localStorage.getItem(BUFFER_KEY)
    return raw ? (JSON.parse(raw) as Fix[]) : []
  } catch {
    return []
  }
}

const writeBuffer = (fixes: Fix[]) => {
  try {
    // Cap it: a phone left on for a day must not fill its storage quota and
    // start throwing on every write.
    localStorage.setItem(BUFFER_KEY, JSON.stringify(fixes.slice(-800)))
  } catch {
    /* private mode or quota — losing the buffer must not break the screen */
  }
}

// Catches logged with no signal wait here. Unlike a position, a lost catch
// cannot be reconstructed later — the fish, its weight and the conditions at
// that minute are gone — so this queue is the difference between a full log and
// a guess. Each entry carries a clientId so a retried upload can't duplicate it.
const CATCH_QUEUE_KEY = 'aam-captain-catch-queue'

type QueuedCatch = CatchInput & { clientId: string }

const readCatchQueue = (): QueuedCatch[] => {
  try {
    const raw = localStorage.getItem(CATCH_QUEUE_KEY)
    return raw ? (JSON.parse(raw) as QueuedCatch[]) : []
  } catch {
    return []
  }
}

const writeCatchQueue = (items: QueuedCatch[]) => {
  try {
    localStorage.setItem(CATCH_QUEUE_KEY, JSON.stringify(items))
  } catch {
    /* private mode or quota — must not break the screen */
  }
}

export function CaptainMode({ initialToken }: { initialToken: string }) {
  const [token, setToken] = useState(initialToken)
  const [tokenInput, setTokenInput] = useState('')

  // Restore the token from this phone if the link was opened without one.
  useEffect(() => {
    if (initialToken) {
      try {
        localStorage.setItem(TOKEN_KEY, initialToken)
      } catch {
        /* ignore */
      }
      return
    }
    try {
      const saved = localStorage.getItem(TOKEN_KEY)
      if (saved) setToken(saved)
    } catch {
      /* ignore */
    }
  }, [initialToken])

  const { data, error, isLoading, mutate } = useSWR(
    token ? ['captain-board', token] : null,
    () => getCaptainBoard(token),
    {
      refreshInterval: 30_000,
      // The phone comes back from a pocket constantly; stale state on this
      // screen is what makes a captain start a second trip by mistake.
      revalidateOnFocus: true,
    },
  )

  if (!token) {
    return (
      <TokenGate
        value={tokenInput}
        onChange={setTokenInput}
        onSubmit={() => {
          const t = tokenInput.trim()
          if (!t) return
          try {
            localStorage.setItem(TOKEN_KEY, t)
          } catch {
            /* ignore */
          }
          setToken(t)
        }}
      />
    )
  }

  if (error) {
    return (
      <Shell>
        <div
          className="rounded-2xl border p-6 text-center"
          style={{ borderColor: `${PINK}59`, backgroundColor: `${PINK}14` }}
        >
          <Ban className="mx-auto h-8 w-8" style={{ color: PINK }} aria-hidden />
          <p className="mt-3 text-lg font-medium" style={{ color: PINK }}>
            This code is not valid
          </p>
          <p className="mt-2 text-sm text-white/60">
            Ask the office for a new captain link. Nothing you did is lost — no
            trip has been changed.
          </p>
          <button
            type="button"
            onClick={() => {
              try {
                localStorage.removeItem(TOKEN_KEY)
              } catch {
                /* ignore */
              }
              setToken('')
            }}
            className="mt-5 min-h-[56px] w-full cursor-pointer rounded-xl px-5 text-sm font-medium uppercase tracking-[0.14em]"
            style={{ backgroundColor: `${PINK}1f`, color: PINK }}
          >
            Enter another code
          </button>
        </div>
      </Shell>
    )
  }

  if (isLoading || !data) {
    return (
      <Shell>
        <div className="flex flex-col items-center gap-3 py-20 text-white/50">
          <Loader2 className="h-7 w-7 animate-spin" aria-hidden />
          <p className="text-sm uppercase tracking-[0.16em]">Loading</p>
        </div>
      </Shell>
    )
  }

  return <Board board={data} token={token} refresh={() => void mutate()} />
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main
      className="min-h-dvh px-4 pb-10 pt-6"
      style={{ backgroundColor: NAVY }}
    >
      <div className="mx-auto w-full max-w-md">{children}</div>
    </main>
  )
}

function TokenGate({
  value,
  onChange,
  onSubmit,
}: {
  value: string
  onChange: (v: string) => void
  onSubmit: () => void
}) {
  return (
    <Shell>
      <div className="flex items-center gap-3">
        <Ship className="h-6 w-6" style={{ color: GOLD }} aria-hidden />
        <div>
          <p
            className="text-[10px] uppercase tracking-[0.22em]"
            style={{ color: GOLD }}
          >
            AAM
          </p>
          <h1 className="font-serif text-2xl text-white">Captain Mode</h1>
        </div>
      </div>

      <div
        className="mt-6 rounded-2xl border p-5"
        style={{ borderColor: 'rgba(255,255,255,0.10)', backgroundColor: CARD }}
      >
        <label
          htmlFor="captain-code"
          className="text-[10px] uppercase tracking-[0.16em] text-white/45"
        >
          Boat code
        </label>
        <input
          id="captain-code"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.nativeEvent.isComposing) onSubmit()
          }}
          autoComplete="off"
          autoCapitalize="characters"
          className="mt-2 min-h-[56px] w-full rounded-xl border-0 bg-black/25 px-4 text-center text-2xl tracking-[0.28em] text-white outline-none placeholder:text-white/25"
          placeholder="••••••"
        />
        <button
          type="button"
          onClick={onSubmit}
          className="mt-4 min-h-[56px] w-full cursor-pointer rounded-xl text-sm font-semibold uppercase tracking-[0.16em]"
          style={{ backgroundColor: GOLD, color: '#10222e' }}
        >
          Open
        </button>
        <p className="mt-4 text-center text-xs leading-relaxed text-white/45">
          The office gives each boat its own code. Enter it once — this phone
          will remember it.
        </p>
      </div>
    </Shell>
  )
}

function Board({
  board,
  token,
  refresh,
}: {
  board: CaptainBoard
  token: string
  refresh: () => void
}) {
  const active = board.activeTrip
  const [busy, setBusy] = useState(false)
  const [showEnd, setShowEnd] = useState(false)

  // --- trip form (only used when nothing is open) ---------------------------
  const [captainId, setCaptainId] = useState('')
  const [purpose, setPurpose] = useState('excursion')
  // Prefilled from today's booking so the captain does not retype what the
  // office already knows.
  const [guests, setGuests] = useState(String(board.todayBooking?.guests ?? 0))
  const [destination, setDestination] = useState('')
  const [fuelStart, setFuelStart] = useState('')
  const [fuelEnd, setFuelEnd] = useState('')

  const tracking = useTracking(token, !!active)
  const catchQueue = useCatchQueue(token, refresh)

  const start = async () => {
    setBusy(true)
    try {
      await startTripAsCaptain(token, {
        captainId: captainId || null,
        purpose,
        guests: Number(guests) || 0,
        destination: destination.trim() || null,
        fuelStartPct: fuelStart === '' ? null : Number(fuelStart),
        bookingId: board.todayBooking ? String(board.todayBooking.id) : null,
      })
      refresh()
    } finally {
      setBusy(false)
    }
  }

  const end = async () => {
    if (!active) return
    setBusy(true)
    try {
      // Send anything still buffered before the trip closes. Fixes need their
      // trip; catches match by the minute they were landed so they would still
      // attach afterwards, but flushing now means the log is complete the moment
      // the trip ends rather than on the next timer tick.
      await tracking.flushNow()
      await catchQueue.flushNow()
      await endTripAsCaptain(token, {
        tripId: active.id,
        fuelEndPct: fuelEnd === '' ? null : Number(fuelEnd),
      })
      setShowEnd(false)
      setFuelEnd('')
      refresh()
    } finally {
      setBusy(false)
    }
  }

  return (
    <Shell>
      <header className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <Ship className="h-6 w-6" style={{ color: GOLD }} aria-hidden />
          <div>
            <p
              className="text-[10px] uppercase tracking-[0.22em]"
              style={{ color: GOLD }}
            >
              Captain Mode
            </p>
            <h1 className="font-serif text-2xl leading-tight text-white">
              {board.boatName}
            </h1>
          </div>
        </div>
        <div className="text-right">
          <p className="text-2xl tabular-nums text-white">
            {board.nowLocal.slice(11, 16)}
          </p>
          <p
            className="flex items-center justify-end gap-1 text-[10px] uppercase tracking-[0.12em]"
            style={{ color: AMBER }}
          >
            <Sunset className="h-3 w-3" aria-hidden />
            {board.sunset}
          </p>
        </div>
      </header>

      {/* ---------------- state banner ---------------- */}
      <section
        className="mt-5 overflow-hidden rounded-2xl border"
        style={{
          borderColor: active ? `${SAGE}40` : 'rgba(255,255,255,0.10)',
          backgroundColor: CARD,
        }}
      >
        <div
          className="flex items-center gap-3 px-5 py-4"
          style={{ backgroundColor: active ? `${SAGE}1a` : 'transparent' }}
        >
          {active ? (
            <Radio
              className="h-5 w-5 flex-shrink-0"
              style={{ color: SAGE }}
              aria-hidden
            />
          ) : (
            <Anchor
              className="h-5 w-5 flex-shrink-0 text-white/40"
              aria-hidden
            />
          )}
          <div className="min-w-0">
            <p
              className="text-sm font-semibold uppercase tracking-[0.14em]"
              style={{ color: active ? SAGE : 'rgba(255,255,255,0.55)' }}
            >
              {active ? 'At sea' : 'Alongside'}
            </p>
            <p className="mt-0.5 text-xs text-white/55">
              {active
                ? `Left at ${active.startedTime} · ${active.positionCount} fixes recorded`
                : 'No trip open on this boat'}
            </p>
          </div>
        </div>

        {active && (
          <div className="border-t border-white/[0.08] px-5 py-4">
            <TrackingRow tracking={tracking} lastFix={active.lastFixAgeMin} />
          </div>
        )}
      </section>

      {/* ---------------- catch log ----------------
          Only while a trip is open, because a catch belongs to a voyage. Placed
          directly under the status banner: this is the one thing the captain
          touches repeatedly during a fishing day, so it must not be below the
          fold on a phone. */}
      {active && (
        <CatchPanel
          token={token}
          spots={board.spots ?? []}
          lastFix={tracking.lastFix}
          queue={catchQueue}
        />
      )}

      {/* ---------------- today's booking ---------------- */}
      {board.todayBooking && !active && (
        <section
          className="mt-4 rounded-2xl border p-5"
          style={{ borderColor: `${GOLD}33`, backgroundColor: `${GOLD}0f` }}
        >
          <p
            className="text-[10px] uppercase tracking-[0.16em]"
            style={{ color: GOLD }}
          >
            Booked today
          </p>
          <p className="mt-1.5 text-lg text-white">
            {board.todayBooking.label}
          </p>
          <p className="mt-1 text-sm text-white/60">
            {board.todayBooking.departureTime} · {board.todayBooking.guests}{' '}
            {board.todayBooking.guests === 1 ? 'guest' : 'guests'} ·{' '}
            {board.todayBooking.guestName}
          </p>
        </section>
      )}

      {/* ---------------- start form ---------------- */}
      {!active && (
        <section className="mt-4 space-y-4">
          <Field label="Captain">
            <Select
              value={captainId}
              onChange={setCaptainId}
              options={[
                { value: '', label: 'Not recorded' },
                ...board.captains.map((c) => ({ value: c.id, label: c.name })),
              ]}
            />
          </Field>

          <Field label="Purpose">
            <Select
              value={purpose}
              onChange={setPurpose}
              options={TRIP_PURPOSES.map((p) => ({
                value: p.id,
                label: p.label,
              }))}
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Guests">
              <NumInput value={guests} onChange={setGuests} />
            </Field>
            <Field label="Fuel %">
              <NumInput
                value={fuelStart}
                onChange={setFuelStart}
                placeholder="—"
              />
            </Field>
          </div>

          <Field label="Going to">
            <input
              value={destination}
              onChange={(e) => setDestination(e.target.value)}
              placeholder="Nosy Tanikely"
              className="min-h-[56px] w-full rounded-xl border-0 bg-black/25 px-4 text-base text-white outline-none placeholder:text-white/25"
            />
          </Field>

          <button
            type="button"
            onClick={start}
            disabled={busy}
            className="flex min-h-[72px] w-full cursor-pointer items-center justify-center gap-3 rounded-2xl text-base font-semibold uppercase tracking-[0.18em] disabled:opacity-60"
            style={{ backgroundColor: SAGE, color: '#0c2118' }}
          >
            {busy ? (
              <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
            ) : (
              <Compass className="h-5 w-5" aria-hidden />
            )}
            Start trip
          </button>
        </section>
      )}

      {/* ---------------- end trip ---------------- */}
      {active && (
        <section className="mt-4">
          {!showEnd ? (
            <button
              type="button"
              onClick={() => setShowEnd(true)}
              className="flex min-h-[72px] w-full cursor-pointer items-center justify-center gap-3 rounded-2xl border text-base font-semibold uppercase tracking-[0.18em]"
              style={{ borderColor: `${AMBER}59`, color: AMBER }}
            >
              <Anchor className="h-5 w-5" aria-hidden />
              End trip
            </button>
          ) : (
            <div
              className="rounded-2xl border p-5"
              style={{
                borderColor: `${AMBER}59`,
                backgroundColor: `${AMBER}0f`,
              }}
            >
              <p
                className="text-[10px] uppercase tracking-[0.16em]"
                style={{ color: AMBER }}
              >
                Closing the trip
              </p>
              <div className="mt-3">
                <Field label="Fuel left %">
                  <NumInput
                    value={fuelEnd}
                    onChange={setFuelEnd}
                    placeholder="—"
                  />
                </Field>
              </div>
              <div className="mt-4 grid gap-3">
                <button
                  type="button"
                  onClick={end}
                  disabled={busy}
                  className="flex min-h-[64px] w-full cursor-pointer items-center justify-center gap-2 rounded-xl text-sm font-semibold uppercase tracking-[0.16em] disabled:opacity-60"
                  style={{ backgroundColor: AMBER, color: '#2a1e08' }}
                >
                  {busy ? (
                    <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
                  ) : (
                    <Check className="h-5 w-5" aria-hidden />
                  )}
                  Confirm — back alongside
                </button>
                <button
                  type="button"
                  onClick={() => setShowEnd(false)}
                  className="min-h-[56px] w-full cursor-pointer rounded-xl text-sm uppercase tracking-[0.14em] text-white/50"
                >
                  Keep sailing
                </button>
              </div>
            </div>
          )}
        </section>
      )}

      <p className="mt-6 text-center text-xs leading-relaxed text-white/35">
        Keep this screen open while at sea. If the phone locks, the position
        stops updating until you open it again — anything missed is sent as soon
        as you do.
      </p>
    </Shell>
  )
}

// ---------------------------------------------------------------------------
// Tracking
// ---------------------------------------------------------------------------

type Tracking = ReturnType<typeof useTracking>

/**
 * Watches GPS while a trip is open and posts fixes to /api/fleet/position.
 *
 * Fixes go into a localStorage buffer first and are only dropped once the
 * server has them. That is the whole point: out here the signal comes and
 * goes, and a track with a hole in it is worse than useless for finding a
 * boat.
 */
function useTracking(token: string, enabled: boolean) {
  const [permission, setPermission] = useState<
    'unknown' | 'granted' | 'denied' | 'unsupported'
  >('unknown')
  const [online, setOnline] = useState(true)
  const [pending, setPending] = useState(0)
  const [lastSent, setLastSent] = useState<string | null>(null)
  const [wakeLock, setWakeLock] = useState(false)
  /** Most recent GPS fix, reused when logging a catch. */
  const [lastFix, setLastFix] = useState<Fix | null>(null)

  const sending = useRef(false)
  const watchId = useRef<number | null>(null)
  const lockRef = useRef<WakeLockSentinel | null>(null)

  const flush = useCallback(
    async (useBeacon = false) => {
      const fixes = readBuffer()
      if (!fixes.length || sending.current) return
      sending.current = true
      try {
        const body = JSON.stringify({ token, positions: fixes })
        if (useBeacon && typeof navigator.sendBeacon === 'function') {
          // Fire-and-forget during unload. We cannot read the reply, so the
          // buffer is kept — a duplicate fix is harmless, a lost one is not.
          navigator.sendBeacon('/api/fleet/position', body)
          return
        }
        const res = await fetch('/api/fleet/position', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body,
          keepalive: true,
        })
        if (res.ok || res.status === 202) {
          // Only clear what we actually sent: new fixes may have arrived while
          // the request was in flight.
          const after = readBuffer().slice(fixes.length)
          writeBuffer(after)
          setPending(after.length)
          setLastSent(new Date().toISOString())
          setOnline(true)
        } else if (res.status === 403 || res.status === 401) {
          // A bad token will never succeed; holding the batch for ever would
          // just grow the buffer.
          writeBuffer([])
          setPending(0)
        }
      } catch {
        setOnline(false)
      } finally {
        sending.current = false
      }
    },
    [token],
  )

  // --- geolocation watch ---------------------------------------------------
  useEffect(() => {
    if (!enabled) return
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setPermission('unsupported')
      return
    }

    watchId.current = navigator.geolocation.watchPosition(
      (pos) => {
        setPermission('granted')
        const c = pos.coords
        const fix: Fix = {
          lat: c.latitude,
          lon: c.longitude,
          // m/s -> knots. Stored in knots because that is what the crew and
          // the office both speak.
          speedKn: c.speed == null ? null : c.speed * 1.943844,
          headingDeg: c.heading == null ? null : c.heading,
          accuracyM: c.accuracy ?? null,
          recordedAt: new Date(pos.timestamp).toISOString(),
        }
        const next = [...readBuffer(), fix]
        writeBuffer(next)
        setPending(next.length)
        // Kept so logging a catch can use the position we already have. Asking
        // the GPS again would make the captain wait with a fish in the boat,
        // and a fresh lock can take 30 s.
        setLastFix(fix)
      },
      (err) => {
        setPermission(err.code === err.PERMISSION_DENIED ? 'denied' : 'unknown')
      },
      { enableHighAccuracy: true, maximumAge: 10_000, timeout: 30_000 },
    )

    return () => {
      if (watchId.current != null) {
        navigator.geolocation.clearWatch(watchId.current)
        watchId.current = null
      }
    }
  }, [enabled])

  // --- upload loop ---------------------------------------------------------
  useEffect(() => {
    if (!enabled) return
    setPending(readBuffer().length)
    const id = setInterval(() => void flush(), 20_000)
    return () => clearInterval(id)
  }, [enabled, flush])

  // --- send on the way out ------------------------------------------------
  useEffect(() => {
    if (!enabled) return
    const onHide = () => {
      if (document.visibilityState === 'hidden') void flush(true)
    }
    const onOnline = () => {
      setOnline(true)
      void flush()
    }
    const onOffline = () => setOnline(false)

    document.addEventListener('visibilitychange', onHide)
    window.addEventListener('pagehide', () => void flush(true))
    window.addEventListener('online', onOnline)
    window.addEventListener('offline', onOffline)
    setOnline(navigator.onLine)

    return () => {
      document.removeEventListener('visibilitychange', onHide)
      window.removeEventListener('online', onOnline)
      window.removeEventListener('offline', onOffline)
    }
  }, [enabled, flush])

  // --- keep the screen awake ----------------------------------------------
  // The honest fix for the biggest limitation: browsers suspend geolocation
  // when the screen locks. A wake lock is the only thing a web page can do
  // about it, and it is not available everywhere — hence the warning in the UI.
  useEffect(() => {
    if (!enabled) return
    let cancelled = false

    const acquire = async () => {
      try {
        const anyNav = navigator as Navigator & {
          wakeLock?: { request: (t: 'screen') => Promise<WakeLockSentinel> }
        }
        if (!anyNav.wakeLock) return
        const lock = await anyNav.wakeLock.request('screen')
        if (cancelled) {
          void lock.release()
          return
        }
        lockRef.current = lock
        setWakeLock(true)
        lock.addEventListener('release', () => setWakeLock(false))
      } catch {
        setWakeLock(false)
      }
    }

    void acquire()
    const onVisible = () => {
      if (document.visibilityState === 'visible' && !lockRef.current) {
        void acquire()
      }
    }
    document.addEventListener('visibilitychange', onVisible)

    return () => {
      cancelled = true
      document.removeEventListener('visibilitychange', onVisible)
      const l = lockRef.current
      lockRef.current = null
      if (l) void l.release().catch(() => {})
    }
  }, [enabled])

  return { permission, online, pending, lastSent, wakeLock, lastFix, flushNow: flush }
}

/**
 * The catch-log twin of useTracking: catches go into a localStorage queue and
 * are only dropped once the server confirms them by clientId. `enqueue` stores
 * the fish immediately and tries once to send it, so a catch with signal feels
 * instant while a catch without signal is safely held instead of lost.
 */
function useCatchQueue(token: string, onSynced: () => void) {
  const [pending, setPending] = useState(0)
  const sending = useRef(false)

  const flush = useCallback(async () => {
    const items = readCatchQueue()
    if (!items.length || sending.current) return
    if (typeof navigator !== 'undefined' && !navigator.onLine) return
    sending.current = true
    try {
      const { saved } = await logCatchesBatch(token, items)
      if (saved.length) {
        const done = new Set(saved)
        // Re-read: the captain may have logged another fish while the request
        // was in flight. Only the ids the server confirmed are removed.
        const remaining = readCatchQueue().filter((c) => !done.has(c.clientId))
        writeCatchQueue(remaining)
        setPending(remaining.length)
        onSynced()
      }
    } catch {
      /* still offline — keep the queue and try again on the next trigger */
    } finally {
      sending.current = false
    }
  }, [token, onSynced])

  /**
   * Store a catch and attempt one immediate send. Returns whether it reached
   * the server, so the form can say "Logged" or "Held" honestly — the captain
   * must never be told a fish is saved when it is only queued. Also returns the
   * clientId: the photo step needs it to attach a picture to this exact fish,
   * and a photo can only be attached once the catch itself has synced (sent).
   */
  const enqueue = useCallback(
    async (input: CatchInput): Promise<{ sent: boolean; clientId: string }> => {
      const clientId =
        typeof crypto !== 'undefined' && crypto.randomUUID
          ? crypto.randomUUID()
          : `${Date.now()}-${Math.random().toString(36).slice(2)}`
      const item: QueuedCatch = { ...input, clientId }
      const next = [...readCatchQueue(), item]
      writeCatchQueue(next)
      setPending(next.length)

      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        return { sent: false, clientId }
      }
      try {
        const { saved } = await logCatchesBatch(token, readCatchQueue())
        const done = new Set(saved)
        const remaining = readCatchQueue().filter((c) => !done.has(c.clientId))
        writeCatchQueue(remaining)
        setPending(remaining.length)
        if (saved.length) onSynced()
        return { sent: done.has(clientId), clientId }
      } catch {
        return { sent: false, clientId }
      }
    },
    [token, onSynced],
  )

  useEffect(() => {
    setPending(readCatchQueue().length)
    const id = setInterval(() => void flush(), 20_000)
    const onOnline = () => void flush()
    const onVisible = () => {
      if (document.visibilityState === 'visible') void flush()
    }
    window.addEventListener('online', onOnline)
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      clearInterval(id)
      window.removeEventListener('online', onOnline)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [flush])

  return { pending, enqueue, flushNow: flush }
}

function TrackingRow({
  tracking,
  lastFix,
}: {
  tracking: Tracking
  lastFix: number | null
}) {
  const { permission, online, pending, wakeLock } = tracking

  if (permission === 'denied' || permission === 'unsupported') {
    return (
      <div className="flex items-start gap-3">
        <TriangleAlert
          className="mt-0.5 h-5 w-5 flex-shrink-0"
          style={{ color: PINK }}
          aria-hidden
        />
        <div>
          <p className="text-sm font-medium" style={{ color: PINK }}>
            {permission === 'denied'
              ? 'Location is blocked'
              : 'This phone cannot report position'}
          </p>
          <p className="mt-1 text-xs leading-relaxed text-white/55">
            The trip is still recorded, but the office cannot see where the boat
            is. Allow location for this site to fix it.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <span className="flex items-center gap-2 text-xs uppercase tracking-[0.12em] text-white/45">
          <MapPin className="h-3.5 w-3.5" aria-hidden />
          Position
        </span>
        <span
          className="text-sm tabular-nums"
          style={{ color: lastFix == null ? 'rgba(255,255,255,0.5)' : SKY }}
        >
          {lastFix == null
            ? 'waiting for GPS'
            : lastFix < 1
              ? 'just now'
              : `${lastFix} min ago`}
        </span>
      </div>

      <div className="flex items-center justify-between gap-3">
        <span className="flex items-center gap-2 text-xs uppercase tracking-[0.12em] text-white/45">
          {online ? (
            <Wifi className="h-3.5 w-3.5" aria-hidden />
          ) : (
            <WifiOff className="h-3.5 w-3.5" aria-hidden />
          )}
          Signal
        </span>
        <span
          className="text-sm"
          style={{ color: online ? SAGE : AMBER }}
        >
          {online
            ? pending > 0
              ? `sending ${pending}`
              : 'sent'
            : `${pending} held`}
        </span>
      </div>

      {!wakeLock && (
        <p
          className="rounded-lg px-3 py-2 text-xs leading-relaxed"
          style={{ backgroundColor: `${AMBER}14`, color: AMBER }}
        >
          Screen may sleep. Position pauses while it does.
        </p>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Catch log
// ---------------------------------------------------------------------------

/**
 * The species the boats actually catch here, so the common case is one tap.
 * Free text stays available because the sea does not read our list.
 */
const QUICK_SPECIES = [
  'Yellowfin tuna',
  'Dogtooth tuna',
  'Wahoo',
  'Giant trevally',
  'Sailfish',
  'Marlin',
  'Barracuda',
  'Grouper',
  'Bonito',
  'Mahi-mahi',
]

const METHODS = [
  { value: '', label: 'Method — not set' },
  { value: 'trolling', label: 'Trolling' },
  { value: 'jigging', label: 'Jigging' },
  { value: 'bottom', label: 'Bottom fishing' },
  { value: 'casting', label: 'Casting' },
  { value: 'live-bait', label: 'Live bait' },
  { value: 'other', label: 'Other' },
]

function CatchPanel({
  token,
  spots,
  lastFix,
  queue,
}: {
  token: string
  spots: { id: string; name: string }[]
  lastFix: Fix | null
  queue: {
    pending: number
    enqueue: (input: CatchInput) => Promise<{ sent: boolean; clientId: string }>
  }
}) {
  const [open, setOpen] = useState(false)
  const [species, setSpecies] = useState('')
  const [custom, setCustom] = useState('')
  const [weight, setWeight] = useState('')
  const [released, setReleased] = useState(false)
  const [spotId, setSpotId] = useState('')
  const [guest, setGuest] = useState('')
  const [method, setMethod] = useState('')
  const [busy, setBusy] = useState(false)
  const [saved, setSaved] = useState<string | null>(null)
  const [held, setHeld] = useState<string | null>(null)
  // The clientId of the last synced fish, so its photo can be attached. Cleared
  // for a held (offline) catch: the server has no such row to attach to yet, so
  // offering the camera would only fail. The photo waits for the next landing.
  const [photoTarget, setPhotoTarget] = useState<string | null>(null)
  const [photoState, setPhotoState] = useState<'idle' | 'busy' | 'done' | 'error'>(
    'idle',
  )
  const photoInputRef = useRef<HTMLInputElement>(null)

  const chosen = species === '__other' ? custom.trim() : species

  const submit = async () => {
    if (!chosen) return
    setBusy(true)
    setHeld(null)
    setSaved(null)
    const label = `${chosen}${weight ? ` · ${weight} kg` : ''}`
    // Always goes through the queue: the entry is written to storage before the
    // network is touched, so it survives even if the phone dies mid-send. That
    // is why there is no try/catch here — enqueue never throws, it reports back.
    const { sent, clientId } = await queue.enqueue({
      species: chosen,
      spotId: spotId || null,
      // The position we already have from the tracking watch. Requesting a new
      // fix here would stall the form while the fish is in the boat.
      lat: lastFix?.lat ?? null,
      lon: lastFix?.lon ?? null,
      weightKg: weight === '' ? null : Number(weight),
      released,
      guestName: guest.trim() || null,
      method: method || null,
      // Stamped by the phone so an offline entry keeps the minute the fish was
      // actually landed — which is also the minute its conditions come from.
      caughtAt: new Date().toISOString(),
    })
    // Honest either way: "Logged" only when the server has it, "Held" when it is
    // safely queued but not yet sent. A captain told "Logged" would not re-log.
    if (sent) setSaved(label)
    else setHeld(label)
    // Only offer the camera for a fish that actually reached the server — the
    // photo attaches by clientId to a row that must already exist.
    setPhotoTarget(sent ? clientId : null)
    setPhotoState('idle')
    // Species and weight clear for the next fish; the spot, guest and method
    // stay, because the next fish usually comes on the same drift.
    setSpecies('')
    setCustom('')
    setWeight('')
    setReleased(false)
    setBusy(false)
  }

  // Downscale in a canvas before upload. A modern phone photo is several MB;
  // sent raw it would crawl over a boat's signal and cost storage for no gain,
  // since the log only needs a recognisable fish. 1600px longest edge, JPEG 0.8.
  const shrinkToDataUrl = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const img = new Image()
      // No crossOrigin here: the source is a local blob: URL from the picked
      // file, and setting it can make some engines refuse to decode the image.
      img.onload = () => {
        const max = 1600
        const scale = Math.min(1, max / Math.max(img.width, img.height))
        const w = Math.round(img.width * scale)
        const h = Math.round(img.height * scale)
        const canvas = document.createElement('canvas')
        canvas.width = w
        canvas.height = h
        const ctx = canvas.getContext('2d')
        if (!ctx) return reject(new Error('no canvas'))
        ctx.drawImage(img, 0, 0, w, h)
        resolve(canvas.toDataURL('image/jpeg', 0.8))
      }
      img.onerror = () => reject(new Error('bad image'))
      img.src = URL.createObjectURL(file)
    })

  const onPhotoPicked = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    // Let the same fish be re-picked later (e.g. after a failed send).
    e.target.value = ''
    if (!file || !photoTarget) return
    setPhotoState('busy')
    try {
      const dataUrl = await shrinkToDataUrl(file)
      await attachCatchPhoto(token, photoTarget, dataUrl)
      setPhotoState('done')
    } catch {
      // Non-fatal: the catch itself is already saved, only its picture failed.
      setPhotoState('error')
    }
  }

  if (!open) {
    return (
      <div className="mt-4">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="flex min-h-[68px] w-full cursor-pointer items-center justify-center gap-3 rounded-2xl border text-base font-semibold uppercase tracking-[0.16em]"
          style={{ borderColor: `${SKY}59`, backgroundColor: `${SKY}1a`, color: SKY }}
        >
          <Fish className="h-6 w-6" aria-hidden />
          Log a catch
        </button>
        {/* Persistent, unlike the one-shot "Held" toast: as long as fish are
            waiting for signal the captain can see the count, so a queue that
            has not drained is never a silent surprise back at the dock. */}
        {queue.pending > 0 && (
          <p
            className="mt-2 flex items-center justify-center gap-2 text-xs"
            style={{ color: AMBER }}
          >
            <WifiOff className="h-3.5 w-3.5" aria-hidden />
            {queue.pending} {queue.pending === 1 ? 'catch' : 'catches'} waiting to
            send
          </p>
        )}
      </div>
    )
  }

  return (
    <section
      className="mt-4 rounded-2xl border p-5"
      style={{ borderColor: `${SKY}40`, backgroundColor: CARD }}
    >
      <div className="flex items-center justify-between gap-3">
        <p
          className="flex items-center gap-2 text-[10px] uppercase tracking-[0.16em]"
          style={{ color: SKY }}
        >
          <Fish className="h-4 w-4" aria-hidden />
          Log a catch
        </p>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="min-h-[44px] cursor-pointer px-2 text-xs uppercase tracking-[0.14em] text-white/45"
        >
          Close
        </button>
      </div>

      {saved && (
        <p
          className="mt-3 flex items-center gap-2 rounded-xl px-4 py-3 text-sm"
          style={{ backgroundColor: `${SAGE}1a`, color: SAGE }}
        >
          <Check className="h-4 w-4 flex-shrink-0" aria-hidden />
          Logged {saved}
        </p>
      )}

      {/* Photo is offered only after the fish has synced (photoTarget set), and
          it is plainly optional — a fast add for the guest's memory and to
          confirm species and size, never a step that blocks logging the next
          fish. `capture="environment"` opens the rear camera straight away. */}
      {photoTarget && (
        <div className="mt-3">
          <input
            ref={photoInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="sr-only"
            onChange={onPhotoPicked}
          />
          {photoState === 'done' ? (
            <p
              className="flex items-center gap-2 rounded-xl px-4 py-3 text-sm"
              style={{ backgroundColor: `${SAGE}1a`, color: SAGE }}
            >
              <Check className="h-4 w-4 flex-shrink-0" aria-hidden />
              Photo added
            </p>
          ) : (
            <>
              <button
                type="button"
                disabled={photoState === 'busy'}
                onClick={() => photoInputRef.current?.click()}
                className="flex min-h-[52px] w-full cursor-pointer items-center justify-center gap-2 rounded-xl border text-sm font-semibold uppercase tracking-[0.14em] disabled:opacity-60"
                style={{ borderColor: `${SKY}40`, color: SKY }}
              >
                <Camera className="h-5 w-5" aria-hidden />
                {photoState === 'busy' ? 'Uploading…' : 'Add photo (optional)'}
              </button>
              {photoState === 'error' && (
                <p className="mt-2 text-center text-xs" style={{ color: AMBER }}>
                  Photo did not upload — the catch is saved, you can try the
                  photo again.
                </p>
              )}
            </>
          )}
        </div>
      )}

      {/* Amber, not red: a held catch is not an error, it is saved on the phone
          and waiting for signal. Red would tell the captain something broke and
          push him to re-enter a fish that is already safely queued. */}
      {held && (
        <p
          className="mt-3 flex items-start gap-2 rounded-xl px-4 py-3 text-sm"
          style={{ backgroundColor: `${AMBER}1a`, color: AMBER }}
        >
          <WifiOff className="mt-0.5 h-4 w-4 flex-shrink-0" aria-hidden />
          <span>
            Held {held} — no signal. It is saved on this phone and will send
            itself once you are back in range.
          </span>
        </p>
      )}

      {/* Species as buttons rather than a dropdown: one tap with wet hands,
          and the list is short enough to read at a glance. */}
      <div className="mt-4 flex flex-wrap gap-2">
        {QUICK_SPECIES.map((s) => {
          const on = species === s
          return (
            <button
              key={s}
              type="button"
              onClick={() => setSpecies(on ? '' : s)}
              aria-pressed={on}
              className="min-h-[56px] cursor-pointer rounded-xl px-4 text-sm"
              style={{
                backgroundColor: on ? SKY : 'rgba(0,0,0,0.25)',
                color: on ? NAVY : 'rgba(255,255,255,0.85)',
                fontWeight: on ? 600 : 400,
              }}
            >
              {s}
            </button>
          )
        })}
        <button
          type="button"
          onClick={() => setSpecies(species === '__other' ? '' : '__other')}
          aria-pressed={species === '__other'}
          className="min-h-[56px] cursor-pointer rounded-xl px-4 text-sm"
          style={{
            backgroundColor: species === '__other' ? SKY : 'rgba(0,0,0,0.25)',
            color: species === '__other' ? NAVY : 'rgba(255,255,255,0.85)',
          }}
        >
          Other…
        </button>
      </div>

      {species === '__other' && (
        <input
          value={custom}
          onChange={(e) => setCustom(e.target.value)}
          placeholder="Which fish?"
          autoFocus
          className="mt-3 min-h-[56px] w-full rounded-xl border-0 bg-black/25 px-4 text-base text-white outline-none placeholder:text-white/25"
        />
      )}

      <div className="mt-4 grid grid-cols-2 gap-3">
        <Field label="Weight (kg)">
          <DecInput value={weight} onChange={setWeight} placeholder="—" />
        </Field>
        {/* Released is a first-class outcome, not a detail: billfish are nearly
            always released, and a released fish still proves the spot works. */}
        <Field label="Kept or released">
          <button
            type="button"
            onClick={() => setReleased(!released)}
            aria-pressed={released}
            className="min-h-[56px] w-full cursor-pointer rounded-xl text-sm font-semibold uppercase tracking-[0.12em]"
            style={{
              backgroundColor: released ? `${SAGE}26` : 'rgba(0,0,0,0.25)',
              color: released ? SAGE : 'rgba(255,255,255,0.75)',
            }}
          >
            {released ? 'Released' : 'Kept'}
          </button>
        </Field>
      </div>

      {spots.length > 0 && (
        <div className="mt-3">
          <Field label="Spot">
            <Select
              value={spotId}
              onChange={setSpotId}
              options={[
                { value: '', label: 'Not at a saved spot' },
                ...spots.map((s) => ({ value: s.id, label: s.name })),
              ]}
            />
          </Field>
        </div>
      )}

      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="Who caught it">
          <input
            value={guest}
            onChange={(e) => setGuest(e.target.value)}
            placeholder="Guest name"
            className="min-h-[56px] w-full rounded-xl border-0 bg-black/25 px-4 text-base text-white outline-none placeholder:text-white/25"
          />
        </Field>
        <Field label="Method">
          <Select value={method} onChange={setMethod} options={METHODS} />
        </Field>
      </div>

      <p className="mt-3 text-xs text-white/40">
        {lastFix
          ? 'Position, tide, wind, pressure and sea temperature are saved automatically.'
          : 'Waiting for GPS — the catch still saves, without a position.'}
      </p>

      <button
        type="button"
        onClick={submit}
        disabled={busy || !chosen}
        className="mt-4 flex min-h-[68px] w-full cursor-pointer items-center justify-center gap-3 rounded-2xl text-base font-semibold uppercase tracking-[0.16em] disabled:opacity-40"
        style={{ backgroundColor: SKY, color: NAVY }}
      >
        {busy ? (
          <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
        ) : (
          <Fish className="h-5 w-5" aria-hidden />
        )}
        Save catch
      </button>
    </section>
  )
}

// ---------------------------------------------------------------------------
// Small pieces
// ---------------------------------------------------------------------------

function Field({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <label className="block">
      <span className="text-[10px] uppercase tracking-[0.16em] text-white/45">
        {label}
      </span>
      <span className="mt-1.5 block">{children}</span>
    </label>
  )
}

function Select({
  value,
  onChange,
  options,
}: {
  value: string
  onChange: (v: string) => void
  options: { value: string; label: string }[]
}) {
  return (
    <span className="relative block">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="min-h-[56px] w-full cursor-pointer appearance-none rounded-xl border-0 bg-black/25 px-4 pr-11 text-base text-white outline-none"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value} style={{ color: '#10222e' }}>
            {o.label}
          </option>
        ))}
      </select>
      <ChevronDown
        className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40"
        aria-hidden
      />
    </span>
  )
}

/**
 * Like NumInput but keeps one decimal separator, for weight and length. The
 * integer-only version would silently turn 12.5 kg into 125.
 */
function DecInput({
  value,
  onChange,
  placeholder,
}: {
  value: string
  onChange: (v: string) => void
  placeholder?: string
}) {
  return (
    <input
      value={value}
      onChange={(e) => {
        // Accept a comma — the crew is used to a comma decimal — but store a
        // dot so Number() does not return NaN.
        const cleaned = e.target.value.replace(',', '.').replace(/[^0-9.]/g, '')
        const [head, ...rest] = cleaned.split('.')
        onChange(rest.length ? `${head}.${rest.join('')}` : head)
      }}
      inputMode="decimal"
      placeholder={placeholder}
      className="min-h-[56px] w-full rounded-xl border-0 bg-black/25 px-4 text-center text-xl tabular-nums text-white outline-none placeholder:text-white/25"
    />
  )
}

function NumInput({
  value,
  onChange,
  placeholder,
}: {
  value: string
  onChange: (v: string) => void
  placeholder?: string
}) {
  return (
    <input
      value={value}
      onChange={(e) => onChange(e.target.value.replace(/[^0-9]/g, ''))}
      // Numeric keypad without the spinner arrows, which are impossible to hit
      // on a moving boat.
      inputMode="numeric"
      placeholder={placeholder}
      className="min-h-[56px] w-full rounded-xl border-0 bg-black/25 px-4 text-center text-xl tabular-nums text-white outline-none placeholder:text-white/25"
    />
  )
}
