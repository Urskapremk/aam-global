'use client'

import { useMemo, useState } from 'react'
import useSWR from 'swr'
import { Anchor, Check, Loader2, Users } from 'lucide-react'
import {
  getPublishedRoutes,
  requestTransfer,
  type TransferRoute,
} from '@/app/actions/transfers'
import { cn } from '@/lib/utils'

function todayYmd() {
  const n = new Date()
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}-${String(
    n.getDate(),
  ).padStart(2, '0')}`
}

function routeLabel(r: TransferRoute) {
  return `${r.fromLocation} → ${r.toLocation}`
}

function priceFor(r: TransferRoute, pax: number) {
  return r.priceType === 'per_person' ? r.priceEur * Math.max(1, pax) : r.priceEur
}

export function TransferRequest() {
  const { data: routes = [], isLoading } = useSWR('public-transfer-routes', () =>
    getPublishedRoutes(),
  )

  const [routeId, setRouteId] = useState<number | ''>('')
  const [date, setDate] = useState('')
  const [time, setTime] = useState('')
  const [pax, setPax] = useState(2)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [message, setMessage] = useState('')
  const [sending, setSending] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const selectedRoute = useMemo(
    () => routes.find((r) => r.id === routeId) ?? null,
    [routes, routeId],
  )

  const estimate = selectedRoute ? priceFor(selectedRoute, pax) : null

  async function submit() {
    setError(null)
    if (!routeId) return setError('Please choose a transfer route.')
    if (!date) return setError('Please choose a date.')
    if (!name.trim() || !email.trim())
      return setError('Please enter your name and email.')

    setSending(true)
    const res = await requestTransfer({
      routeId: Number(routeId),
      fromLocation: selectedRoute?.fromLocation ?? '',
      toLocation: selectedRoute?.toLocation ?? '',
      date,
      time,
      name,
      email,
      phone,
      pax,
      message,
    })
    setSending(false)
    if (!res.ok) {
      setError(res.error ?? 'Something went wrong. Please try again.')
      return
    }
    setDone(true)
  }

  return (
    <section id="transfers" className="bg-secondary py-24 lg:py-32">
      <div className="mx-auto max-w-3xl px-6 lg:px-10">
        <div className="max-w-2xl">
          <p className="mb-4 flex items-center gap-3 text-sm uppercase tracking-[0.3em] text-accent">
            <span className="h-px w-10 bg-accent" />
            Island transfers
          </p>
          <h2 className="text-balance font-serif text-4xl font-medium leading-tight text-foreground lg:text-5xl">
            Book a boat transfer
          </h2>
          <p className="mt-6 text-pretty text-lg leading-relaxed text-muted-foreground">
            Private transfers between Nosy Be and the islands aboard Odyssey II.
            Request a route below — we&apos;ll confirm availability and send you a
            voucher. Payment is on arrival (cash), or by bank transfer for larger
            bookings.
          </p>
        </div>

        <div className="mt-12 rounded-3xl border border-border bg-card p-6 sm:p-10">
          {done ? (
            <div className="flex flex-col items-center py-10 text-center">
              <span className="flex h-14 w-14 items-center justify-center rounded-full bg-accent/15 text-accent">
                <Check className="h-7 w-7" strokeWidth={1.5} />
              </span>
              <h3 className="mt-6 font-serif text-2xl font-medium text-foreground">
                Request received
              </h3>
              <p className="mt-3 max-w-md text-pretty leading-relaxed text-muted-foreground">
                Thank you, {name.split(' ')[0] || 'there'}. We&apos;ve received
                your transfer request and will confirm by email at{' '}
                <span className="text-foreground">{email}</span> shortly, along
                with your voucher.
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-5">
              {/* Route */}
              <div>
                <label className="mb-1.5 block text-sm font-medium text-foreground">
                  Transfer route
                </label>
                {isLoading ? (
                  <div className="flex items-center gap-2 rounded-xl border border-border bg-background px-4 py-3 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" strokeWidth={1.5} />
                    Loading routes…
                  </div>
                ) : routes.length === 0 ? (
                  <p className="rounded-xl border border-dashed border-border bg-background px-4 py-3 text-sm text-muted-foreground">
                    No routes are published yet. Please use the contact form
                    below and we&apos;ll arrange your transfer.
                  </p>
                ) : (
                  <select
                    value={routeId}
                    onChange={(e) =>
                      setRouteId(e.target.value ? Number(e.target.value) : '')
                    }
                    className="w-full rounded-xl border border-border bg-background px-4 py-3 text-sm text-foreground outline-none transition-colors focus:border-accent"
                  >
                    <option value="">Choose a route…</option>
                    {routes.map((r) => (
                      <option key={r.id} value={r.id}>
                        {routeLabel(r)}
                        {r.priceEur > 0
                          ? ` — €${r.priceEur}${r.priceType === 'per_person' ? ' pp' : ''}`
                          : ''}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {/* Date + time + pax */}
              <div className="grid gap-5 sm:grid-cols-3">
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-foreground">
                    Date
                  </label>
                  <input
                    type="date"
                    min={todayYmd()}
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="w-full rounded-xl border border-border bg-background px-4 py-3 text-sm text-foreground outline-none transition-colors focus:border-accent [color-scheme:light] dark:[color-scheme:dark]"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-foreground">
                    Preferred departure time
                  </label>
                  <input
                    type="time"
                    value={time}
                    onChange={(e) => setTime(e.target.value)}
                    className="w-full rounded-xl border border-border bg-background px-4 py-3 text-sm text-foreground outline-none transition-colors focus:border-accent [color-scheme:light] dark:[color-scheme:dark]"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-foreground">
                    Passengers
                  </label>
                  <div className="flex items-center gap-2 rounded-xl border border-border bg-background px-3">
                    <Users className="h-4 w-4 shrink-0 text-muted-foreground" strokeWidth={1.5} />
                    <input
                      type="number"
                      min={1}
                      max={50}
                      value={pax}
                      onChange={(e) =>
                        setPax(Math.max(1, Math.min(50, Number(e.target.value) || 1)))
                      }
                      className="w-full bg-transparent py-3 text-sm text-foreground outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* Estimate */}
              {estimate != null && estimate > 0 && (
                <div className="flex items-center justify-between rounded-xl border border-accent/30 bg-accent/5 px-4 py-3">
                  <span className="text-sm text-muted-foreground">
                    Estimated price
                    {selectedRoute?.priceType === 'per_person'
                      ? ` (${pax} × €${selectedRoute.priceEur})`
                      : ''}
                  </span>
                  <span className="font-serif text-xl font-medium text-foreground">
                    €{estimate}
                  </span>
                </div>
              )}

              {/* Contact */}
              <div className="grid gap-5 sm:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-foreground">
                    Full name <span className="text-destructive">*</span>
                  </label>
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Alberto Tomba"
                    required
                    autoComplete="name"
                    className="w-full rounded-xl border border-border bg-background px-4 py-3 text-sm text-foreground outline-none transition-colors focus:border-accent"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-foreground">
                    Email <span className="text-destructive">*</span>
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    required
                    autoComplete="email"
                    inputMode="email"
                    className="w-full rounded-xl border border-border bg-background px-4 py-3 text-sm text-foreground outline-none transition-colors focus:border-accent"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-foreground">
                  Phone (optional)
                </label>
                <input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+261 …"
                  className="w-full rounded-xl border border-border bg-background px-4 py-3 text-sm text-foreground outline-none transition-colors focus:border-accent"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-foreground">
                  Message (optional)
                </label>
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  rows={3}
                  placeholder="Luggage, pickup details, anything we should know…"
                  className="w-full resize-y rounded-xl border border-border bg-background px-4 py-3 text-sm text-foreground outline-none transition-colors focus:border-accent"
                />
              </div>

              {error && (
                <p className="rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
                  {error}
                </p>
              )}

              <button
                onClick={submit}
                disabled={sending || routes.length === 0}
                className={cn(
                  'inline-flex items-center justify-center gap-2 rounded-full bg-primary px-7 py-3.5 text-sm font-medium tracking-wide text-primary-foreground transition-all hover:bg-primary/90 disabled:opacity-50',
                )}
              >
                {sending ? (
                  <Loader2 className="h-4 w-4 animate-spin" strokeWidth={1.5} />
                ) : (
                  <Anchor className="h-4 w-4" strokeWidth={1.5} />
                )}
                {sending ? 'Sending…' : 'Request transfer'}
              </button>
            </div>
          )}
        </div>
      </div>
    </section>
  )
}
