'use client'

import Image from 'next/image'
import { useEffect, useMemo, useRef, useState } from 'react'
import useSWR from 'swr'
import {
  Ship,
  ChevronLeft,
  ChevronRight,
  Check,
  Loader2,
  CalendarDays,
} from 'lucide-react'
import {
  PUBLIC_BOATS,
  TRIP_TYPES,
  getBoat,
  type BoatId,
  type TripTypeId,
} from '@/lib/boats'
import {
  getAvailability,
  requestBooking,
  type DayAvailability,
} from '@/app/actions/boat-bookings'
import { cn } from '@/lib/utils'

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]
const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

function ymd(y: number, m: number, d: number) {
  return `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}
function todayYmd() {
  const n = new Date()
  return ymd(n.getFullYear(), n.getMonth(), n.getDate())
}

export function BoatBooking() {
  const now = new Date()
  const [boat, setBoat] = useState<BoatId>('odyssey')
  const [month, setMonth] = useState(now.getMonth())
  const [year, setYear] = useState(now.getFullYear())
  const [selectedDate, setSelectedDate] = useState<string | null>(null)

  const activeBoat = getBoat(boat)!
  // Trip type defaults to the boat's first offering; reset when boat changes.
  const [tripType, setTripType] = useState<TripTypeId>(activeBoat.trips[0])

  function chooseBoat(id: BoatId) {
    setBoat(id)
    const b = getBoat(id)!
    setTripType(b.trips[0])
    setSelectedDate(null)
  }

  // Range for the visible month (used as the SWR key + query).
  const monthStart = ymd(year, month, 1)
  const monthEnd = ymd(year, month, daysInMonth(year, month))

  const { data: availability = [], isLoading } = useSWR(
    ['boat-availability', boat, monthStart, monthEnd],
    () => getAvailability(monthStart, monthEnd),
  )

  // Map of unavailable dates for the current boat.
  const unavailable = useMemo(() => {
    const set = new Set<string>()
    for (const a of availability as DayAvailability[]) {
      if (a.boat === boat) set.add(a.date)
    }
    return set
  }, [availability, boat])

  const today = todayYmd()

  const cells = useMemo(() => buildCalendar(year, month), [year, month])

  function prevMonth() {
    setSelectedDate(null)
    if (month === 0) {
      setMonth(11)
      setYear((y) => y - 1)
    } else setMonth((m) => m - 1)
  }
  function nextMonth() {
    setSelectedDate(null)
    if (month === 11) {
      setMonth(0)
      setYear((y) => y + 1)
    } else setMonth((m) => m + 1)
  }

  // Can't page earlier than the current real month.
  const atCurrentMonth =
    year < now.getFullYear() ||
    (year === now.getFullYear() && month <= now.getMonth())

  return (
    <section id="booking" className="scroll-mt-24 bg-background py-24 lg:py-32">
      <div className="mx-auto max-w-7xl px-6 lg:px-10">
        <div className="max-w-2xl">
          <p className="mb-4 flex items-center gap-3 text-sm uppercase tracking-[0.3em] text-accent">
            <span className="h-px w-10 bg-accent" />
            Book a boat
          </p>
          <h2 className="text-balance font-serif text-4xl font-medium leading-tight text-foreground lg:text-5xl">
            Choose a boat, pick a free date, and send your request.
          </h2>
          <p className="mt-5 text-pretty leading-relaxed text-muted-foreground">
            Availability updates live. Days marked unavailable are already booked
            or held. Send a request and we&apos;ll confirm by email — no payment
            needed to enquire.
          </p>
        </div>

        {/* Boat selector */}
        <div className="mt-12 grid gap-5 sm:grid-cols-2">
          {PUBLIC_BOATS.map((b) => {
            const active = b.id === boat
            return (
              <button
                key={b.id}
                type="button"
                onClick={() => chooseBoat(b.id)}
                aria-pressed={active}
                className={cn(
                  'flex flex-col items-start overflow-hidden rounded-2xl border text-left transition-all',
                  active
                    ? 'border-accent bg-accent/5 shadow-lg shadow-primary/5'
                    : 'border-border bg-card hover:border-accent/40',
                )}
              >
                {b.video || b.image ? (
                  <div className="relative aspect-[16/9] w-full overflow-hidden bg-secondary">
                    {b.video ? (
                      <AutoVideo
                        src={b.video}
                        poster={b.image}
                        label={`${b.name} — ${b.tagline}`}
                      />
                    ) : (
                      <Image
                        src={b.image || '/placeholder.svg'}
                        alt={`${b.name} — ${b.tagline}`}
                        fill
                        sizes="(max-width: 640px) 100vw, 50vw"
                        className="object-cover"
                      />
                    )}
                    {active && (
                      <span className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full bg-accent text-accent-foreground shadow">
                        <Check className="h-4 w-4" strokeWidth={2} />
                      </span>
                    )}
                  </div>
                ) : null}
                <div className="flex flex-col items-start p-6">
                  {!b.video && !b.image && (
                    <span
                      className={cn(
                        'flex h-11 w-11 items-center justify-center rounded-xl transition-colors',
                        active
                          ? 'bg-accent text-accent-foreground'
                          : 'bg-secondary text-primary',
                      )}
                    >
                      <Ship className="h-5 w-5" strokeWidth={1.5} />
                    </span>
                  )}
                  <h3
                    className={cn(
                      'font-serif text-2xl font-medium tracking-wide text-foreground',
                      !b.video && !b.image && 'mt-4',
                    )}
                  >
                    {b.name}
                  </h3>
                  <p className="mt-1 text-sm font-medium text-accent">
                    {b.tagline}
                  </p>
                  <p className="mt-1 text-xs uppercase tracking-wider text-muted-foreground">
                    {b.specs}
                  </p>
                  <p className="mt-3 text-pretty text-sm leading-relaxed text-muted-foreground">
                    {b.description}
                  </p>
                </div>
              </button>
            )
          })}
        </div>

        {/* Calendar + request form */}
        <div className="mt-10 grid gap-8 lg:grid-cols-[1.1fr_1fr]">
          {/* Calendar */}
          <div className="rounded-2xl border border-border bg-card p-6 lg:p-8">
            <div className="flex items-center justify-between">
              <h3 className="font-serif text-xl font-medium text-foreground">
                {MONTHS[month]} {year}
              </h3>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={prevMonth}
                  disabled={atCurrentMonth}
                  aria-label="Previous month"
                  className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border text-muted-foreground transition-colors hover:text-foreground disabled:opacity-30 disabled:hover:text-muted-foreground"
                >
                  <ChevronLeft className="h-4 w-4" strokeWidth={1.5} />
                </button>
                <button
                  type="button"
                  onClick={nextMonth}
                  aria-label="Next month"
                  className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border text-muted-foreground transition-colors hover:text-foreground"
                >
                  <ChevronRight className="h-4 w-4" strokeWidth={1.5} />
                </button>
              </div>
            </div>

            <div className="mt-6 grid grid-cols-7 gap-1.5">
              {WEEKDAYS.map((d) => (
                <div
                  key={d}
                  className="pb-2 text-center text-xs font-medium uppercase tracking-wider text-muted-foreground"
                >
                  {d}
                </div>
              ))}
              {cells.map((cell, i) => {
                if (cell === null) return <div key={`e${i}`} />
                const date = ymd(year, month, cell)
                const isPast = date < today
                const isBooked = unavailable.has(date)
                const disabled = isPast || isBooked
                const isSelected = date === selectedDate
                return (
                  <button
                    key={date}
                    type="button"
                    disabled={disabled}
                    onClick={() => setSelectedDate(date)}
                    aria-label={`${cell} ${MONTHS[month]}${isBooked ? ' — unavailable' : ''}`}
                    aria-pressed={isSelected}
                    className={cn(
                      'relative flex aspect-square items-center justify-center rounded-lg text-sm transition-all',
                      isSelected && 'bg-accent font-semibold text-accent-foreground',
                      !isSelected &&
                        !disabled &&
                        'text-foreground hover:bg-secondary',
                      isPast && 'cursor-not-allowed text-muted-foreground/30',
                      isBooked &&
                        !isPast &&
                        'cursor-not-allowed text-muted-foreground/40 line-through',
                    )}
                  >
                    {cell}
                    {isBooked && !isPast && (
                      <span className="absolute bottom-1 h-1 w-1 rounded-full bg-destructive" />
                    )}
                  </button>
                )
              })}
            </div>

            <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-border pt-5 text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <span className="h-3 w-3 rounded bg-accent" /> Selected
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-3 w-3 rounded border border-border bg-card" />{' '}
                Available
              </span>
              <span className="flex items-center gap-1.5">
                <span className="inline-flex h-3 w-3 items-center justify-center rounded">
                  <span className="h-1 w-1 rounded-full bg-destructive" />
                </span>{' '}
                Unavailable
              </span>
              {isLoading && (
                <span className="flex items-center gap-1.5">
                  <Loader2 className="h-3 w-3 animate-spin" /> Loading…
                </span>
              )}
            </div>
          </div>

          {/* Request form */}
          <RequestForm
            boat={boat}
            tripType={tripType}
            onTripTypeChange={setTripType}
            selectedDate={selectedDate}
          />
        </div>
      </div>
    </section>
  )
}

function RequestForm({
  boat,
  tripType,
  onTripTypeChange,
  selectedDate,
}: {
  boat: BoatId
  tripType: TripTypeId
  onTripTypeChange: (t: TripTypeId) => void
  selectedDate: string | null
}) {
  const activeBoat = getBoat(boat)!
  const availableTrips = TRIP_TYPES.filter((t) =>
    activeBoat.trips.includes(t.id),
  )

  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [guests, setGuests] = useState(2)
  const [message, setMessage] = useState('')
  const [sending, setSending] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (!selectedDate) {
      setError('Please pick a date in the calendar first.')
      return
    }
    if (!name.trim() || !email.trim()) {
      setError('Please enter your name and email.')
      return
    }
    setSending(true)
    const res = await requestBooking({
      boat,
      tripType,
      date: selectedDate,
      name,
      email,
      phone,
      guests,
      message,
    })
    setSending(false)
    if (res.ok) {
      setDone(true)
    } else {
      setError(res.error ?? 'Something went wrong. Please try again.')
    }
  }

  if (done) {
    return (
      <div className="flex flex-col items-center justify-center rounded-2xl border border-border bg-card p-8 text-center">
        <span className="flex h-14 w-14 items-center justify-center rounded-full bg-accent/10 text-accent">
          <Check className="h-7 w-7" strokeWidth={1.5} />
        </span>
        <h3 className="mt-5 font-serif text-2xl font-medium text-foreground">
          Request sent
        </h3>
        <p className="mt-3 max-w-sm text-pretty leading-relaxed text-muted-foreground">
          Thank you, {name.split(' ')[0]}. We&apos;ve received your request for{' '}
          <strong className="text-foreground">{activeBoat.name}</strong> on{' '}
          <strong className="text-foreground">{formatDate(selectedDate!)}</strong>
          . We&apos;ll confirm availability by email shortly.
        </p>
        <button
          type="button"
          onClick={() => {
            setDone(false)
            setName('')
            setEmail('')
            setPhone('')
            setMessage('')
            setGuests(2)
          }}
          className="mt-6 text-sm font-medium text-accent transition-colors hover:text-foreground"
        >
          Send another request
        </button>
      </div>
    )
  }

  return (
    <form
      onSubmit={submit}
      className="flex flex-col gap-5 rounded-2xl border border-border bg-card p-6 lg:p-8"
    >
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <CalendarDays className="h-4 w-4 text-accent" strokeWidth={1.5} />
        {selectedDate ? (
          <span>
            <span className="text-foreground">{formatDate(selectedDate)}</span> ·{' '}
            {activeBoat.name}
          </span>
        ) : (
          <span>Pick a date in the calendar</span>
        )}
      </div>

      {/* Trip type */}
      <div>
        <label className="mb-2 block text-sm font-medium text-foreground">
          Trip type
        </label>
        <div className="grid gap-2 sm:grid-cols-2">
          {availableTrips.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => onTripTypeChange(t.id)}
              aria-pressed={tripType === t.id}
              className={cn(
                'rounded-lg border px-3 py-2.5 text-left text-sm transition-all',
                tripType === t.id
                  ? 'border-accent bg-accent/5 font-medium text-foreground'
                  : 'border-border text-muted-foreground hover:border-accent/40 hover:text-foreground',
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="bk-name" className="mb-2 block text-sm font-medium text-foreground">
            Name
          </label>
          <input
            id="bk-name"
            className="input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Your name"
            required
          />
        </div>
        <div>
          <label htmlFor="bk-email" className="mb-2 block text-sm font-medium text-foreground">
            Email <span className="text-destructive">*</span>
          </label>
          <input
            id="bk-email"
            type="email"
            className="input"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            required
            autoComplete="email"
            inputMode="email"
          />
        </div>
        <div>
          <label htmlFor="bk-phone" className="mb-2 block text-sm font-medium text-foreground">
            Phone <span className="text-muted-foreground">(optional)</span>
          </label>
          <input
            id="bk-phone"
            className="input"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="+…"
          />
        </div>
        <div>
          <label htmlFor="bk-guests" className="mb-2 block text-sm font-medium text-foreground">
            Guests
          </label>
          <input
            id="bk-guests"
            type="number"
            min={1}
            max={20}
            className="input"
            value={guests}
            onChange={(e) => setGuests(Number(e.target.value))}
          />
        </div>
      </div>

      <div>
        <label htmlFor="bk-msg" className="mb-2 block text-sm font-medium text-foreground">
          Message <span className="text-muted-foreground">(optional)</span>
        </label>
        <textarea
          id="bk-msg"
          className="input min-h-[90px] resize-y"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Anything we should know — timing, experience, special requests…"
        />
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <button
        type="submit"
        disabled={sending}
        className="inline-flex items-center justify-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-medium text-primary-foreground transition-all hover:bg-primary/90 disabled:opacity-60"
      >
        {sending ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" /> Sending…
          </>
        ) : (
          'Send booking request'
        )}
      </button>
    </form>
  )
}

// ---------- calendar helpers ----------

function daysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate()
}

/** Build a Mon-first grid: leading nulls + day numbers. */
function buildCalendar(year: number, month: number): (number | null)[] {
  const first = new Date(year, month, 1).getDay() // 0=Sun..6=Sat
  const lead = (first + 6) % 7 // convert to Mon-first
  const total = daysInMonth(year, month)
  const cells: (number | null)[] = []
  for (let i = 0; i < lead; i++) cells.push(null)
  for (let d = 1; d <= total; d++) cells.push(d)
  return cells
}

function formatDate(ymdStr: string) {
  const [y, m, d] = ymdStr.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

/**
 * Muted, looping video that reliably starts playing on page load. The bare
 * `autoPlay` attribute is often deferred (especially below the fold), so we
 * also call play() on mount and whenever the card scrolls into view.
 */
function AutoVideo({
  src,
  poster,
  label,
}: {
  src: string
  poster?: string
  label: string
}) {
  const ref = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const tryPlay = () => {
      el.muted = true
      const p = el.play()
      if (p && typeof p.catch === 'function') p.catch(() => {})
    }
    tryPlay()
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) if (e.isIntersecting) tryPlay()
      },
      { threshold: 0.1 },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [src])

  return (
    <video
      ref={ref}
      src={src}
      poster={poster}
      autoPlay
      muted
      loop
      playsInline
      preload="auto"
      aria-label={label}
      className="h-full w-full object-cover"
    />
  )
}
