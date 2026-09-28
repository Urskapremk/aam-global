'use client'

import {
  Anchor,
  Copy,
  ExternalLink,
  KeyRound,
  Loader2,
  Map,
  Plus,
  Ship,
  Trash2,
  UserRound,
  Users,
} from 'lucide-react'
import dynamic from 'next/dynamic'
import { useEffect, useState } from 'react'
import useSWR from 'swr'

import {
  createFleetDevice,
  deleteCaptain,
  deleteTrip,
  endTripFromOffice,
  getCaptains,
  getFleetDevices,
  getTrips,
  getTripTrack,
  revokeFleetDevice,
  saveCaptain,
  saveTripGuestNames,
  type TripGuest,
  type TripRow,
} from '@/app/actions/fleet'
import { listCatches } from '@/app/actions/fishing'
import { BOATS } from '@/lib/boats'
import { COUNTRIES, countryName, flagUrl } from '@/lib/flags'
import { useT } from '@/lib/i18n/context'
import { cn } from '@/lib/utils'

function fmtDate(iso: string) {
  const t = Date.parse(iso)
  return Number.isNaN(t)
    ? iso
    : new Date(t).toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'short',
        timeZone: 'Indian/Antananarivo',
      })
}

// Date AND time, in the lodge's timezone. Whoever reads this may be on another
// continent, and "last seen 14:20" in the wrong zone would misjudge whether a
// phone is still reporting.
function lastSeen(iso: string) {
  const t = Date.parse(iso)
  return Number.isNaN(t)
    ? iso
    : new Date(t).toLocaleString('en-GB', {
        day: 'numeric',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
        timeZone: 'Indian/Antananarivo',
      })
}

function fmtDuration(min: number | null) {
  if (min == null) return '—'
  const h = Math.floor(min / 60)
  const m = min % 60
  return h > 0 ? `${h}h ${m}m` : `${m}m`
}

// Keys are the database's own values ('active' | 'completed'), not invented
// synonyms — a mismatch here silently falls back to the grey chip.
const STATUS_CHIP: Record<string, string> = {
  active:
    'border-[#1f6f96]/40 bg-[#1f6f96]/10 text-[#1f6f96] dark:border-[#9ecbdd]/40 dark:bg-[#9ecbdd]/10 dark:text-[#9ecbdd]',
  completed: 'border-border bg-secondary/60 text-muted-foreground',
}

function Card({
  title,
  hint,
  icon: Icon,
  children,
}: {
  title: string
  hint?: string
  icon: typeof Ship
  children: React.ReactNode
}) {
  return (
    <section className="overflow-hidden rounded-2xl border border-border bg-card">
      <div className="bg-panel-header p-5">
        <p className="flex items-center gap-2 text-[10px] font-medium uppercase tracking-[0.22em] text-panel-header-foreground/55">
          <Icon className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
          {title}
        </p>
        {hint && (
          <p className="mt-1 text-xs uppercase tracking-[0.12em] text-panel-header-foreground/40">
            {hint}
          </p>
        )}
      </div>
      {children}
    </section>
  )
}

/** Closing a trip the captain forgot to close. */
function CloseTripForm({
  trip,
  onDone,
}: {
  trip: TripRow
  onDone: () => void
}) {
  const tr = useT()
  const [busy, setBusy] = useState(false)
  const [fuel, setFuel] = useState('')
  const [notes, setNotes] = useState('')

  async function submit() {
    setBusy(true)
    try {
      await endTripFromOffice({
        tripId: trip.id,
        fuelEndPct: fuel === '' ? undefined : Number(fuel),
        notes: notes || undefined,
      })
      onDone()
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mt-3 flex flex-col gap-3 rounded-xl border border-border bg-secondary/40 p-4">
      <p className="text-xs text-muted-foreground">
        {tr(
          'Closing from the office. The end time is recorded as now, and the trip is marked as closed by the office rather than by the captain.',
        )}
      </p>
      <div className="flex flex-wrap gap-3">
        <label className="flex flex-col gap-1 text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
          {tr('Fuel left %')}
          <input
            type="number"
            min={0}
            max={100}
            value={fuel}
            onChange={(e) => setFuel(e.target.value)}
            className="min-h-11 w-28 rounded-lg border border-border bg-background px-3 text-sm tabular-nums text-foreground"
          />
        </label>
        <label className="flex min-w-[12rem] flex-1 flex-col gap-1 text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
          {tr('Notes')}
          <input
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder={tr('What happened')}
            className="min-h-11 rounded-lg border border-border bg-background px-3 text-sm text-foreground"
          />
        </label>
      </div>
      <button
        type="button"
        onClick={submit}
        disabled={busy}
        className="min-h-11 w-fit cursor-pointer rounded-full bg-accent px-5 text-[11px] font-semibold uppercase tracking-[0.14em] text-accent-foreground disabled:opacity-50"
      >
        {busy ? tr('Closing…') : tr('Close trip')}
      </button>
    </div>
  )
}

/** Editing the guest names on a trip, from the office. */
function GuestNamesForm({
  trip,
  onDone,
}: {
  trip: TripRow
  onDone: () => void
}) {
  const tr = useT()
  // Start from the saved guests; keep at least one row so there is always a
  // field to type in. Blank rows are stripped on save.
  const [guests, setGuests] = useState<TripGuest[]>(
    trip.guestNames.length > 0 ? trip.guestNames : [{ name: '', country: '' }],
  )
  const [busy, setBusy] = useState(false)

  function setAt(i: number, patch: Partial<TripGuest>) {
    setGuests((prev) => prev.map((g, idx) => (idx === i ? { ...g, ...patch } : g)))
  }
  function addRow() {
    setGuests((prev) => [...prev, { name: '', country: '' }])
  }
  function removeAt(i: number) {
    setGuests((prev) => {
      const next = prev.filter((_, idx) => idx !== i)
      return next.length > 0 ? next : [{ name: '', country: '' }]
    })
  }

  async function submit() {
    setBusy(true)
    try {
      await saveTripGuestNames(trip.id, guests)
      onDone()
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mt-3 flex flex-col gap-3 rounded-xl border border-border bg-secondary/40 p-4">
      <p className="text-xs text-muted-foreground">
        {tr(
          'Guest names and where they are from appear on the Command Centre "Guests out" card while the trip is running. The guest count follows the number of names.',
        )}
      </p>
      <div className="flex flex-col gap-2">
        {guests.map((g, i) => (
          <div key={i} className="flex items-center gap-2">
            <input
              value={g.name}
              onChange={(e) => setAt(i, { name: e.target.value })}
              placeholder={`${tr('Guest')} ${i + 1} — ${tr('name and surname')}`}
              className="min-h-11 min-w-0 flex-1 rounded-lg border border-border bg-background px-3 text-sm text-foreground"
            />
            <select
              value={g.country}
              onChange={(e) => setAt(i, { country: e.target.value })}
              aria-label={tr('Country')}
              className="min-h-11 w-28 flex-shrink-0 rounded-lg border border-border bg-background px-2 text-sm text-foreground"
            >
              <option value="">—</option>
              {COUNTRIES.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.name}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => removeAt(i)}
              aria-label={tr('Remove guest')}
              className="flex h-11 w-11 flex-shrink-0 cursor-pointer items-center justify-center rounded-full text-muted-foreground transition-colors hover:text-[#b0203a] dark:hover:text-[#f0a8b4]"
            >
              <Trash2 className="h-4 w-4" aria-hidden />
            </button>
          </div>
        ))}
      </div>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={addRow}
          className="flex min-h-11 cursor-pointer items-center gap-1.5 rounded-full border border-border px-4 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground transition-colors hover:bg-secondary"
        >
          <Plus className="h-3.5 w-3.5" aria-hidden />
          {tr('Add guest')}
        </button>
        <button
          type="button"
          onClick={submit}
          disabled={busy}
          className="min-h-11 cursor-pointer rounded-full bg-accent px-5 text-[11px] font-semibold uppercase tracking-[0.14em] text-accent-foreground disabled:opacity-50"
        >
          {busy ? tr('Saving…') : tr('Save guests')}
        </button>
      </div>
    </div>
  )
}

export function TripsTab() {
  const tr = useT()
  const trips = useSWR('trips', () => getTrips(60), {
    revalidateOnFocus: true,
  })
  const caps = useSWR('captains', getCaptains, { revalidateOnFocus: true })
  const devs = useSWR('fleet-devices', getFleetDevices, {
    revalidateOnFocus: true,
  })

  const [closing, setClosing] = useState<string | null>(null)
  const [guestEdit, setGuestEdit] = useState<string | null>(null)
  // One track open at a time: each map is a Leaflet instance with its own tile
  // requests, and several open at once on a slow island line is wasteful.
  const [trackOpen, setTrackOpen] = useState<string | null>(null)
  const [capName, setCapName] = useState('')
  const [capPhone, setCapPhone] = useState('')
  const [devBoat, setDevBoat] = useState<string>(BOATS[0]?.id ?? '')
  const [devLabel, setDevLabel] = useState('')
  const [newToken, setNewToken] = useState<string | null>(null)
  // Which link was last copied. One state for both the new-token box (id
  // 'new') and the rows, so two copies of the same idea cannot disagree.
  const [copiedId, setCopiedId] = useState<string | null>(null)

  // Read in an effect, not during render: this component is server-rendered
  // first, where `window` does not exist.
  const [origin, setOrigin] = useState('')
  useEffect(() => setOrigin(window.location.origin), [])

  // A link that goes on a captain's home screen has to keep working. In the v0
  // preview the origin is localhost or a throwaway sandbox host, so a link
  // copied here would silently fail on a real phone — worse than no button.
  const linkIsPublic = !!origin && !/localhost|127\.0\.0\.1|\.vercel\.run/.test(origin)
  const captainLink = (token: string) => `${origin}/captain?t=${token}`

  async function addCaptain() {
    if (!capName.trim()) return
    await saveCaptain({ name: capName.trim(), phone: capPhone || undefined })
    setCapName('')
    setCapPhone('')
    caps.mutate()
  }

  async function addDevice() {
    const res = await createFleetDevice({
      boat: devBoat,
      label: devLabel || 'Captain phone',
    })
    // Shown once, deliberately: the token is the key to that boat's link.
    setNewToken(res.token)
    setDevLabel('')
    devs.mutate()
  }

  // 'active' is the value the database uses (with 'completed'). Matching on
  // 'open' silently hid the close button on exactly the trips that need it.
  const openTrips = (trips.data ?? []).filter((t) => t.status === 'active')

  return (
    <div className="flex flex-col gap-6">
      <Card
        title={tr('Trip log')}
        hint={tr('Every trip, newest first')}
        icon={Anchor}
      >
        {trips.isLoading ? (
          <div className="flex justify-center p-10">
            <Loader2
              className="h-5 w-5 animate-spin text-muted-foreground"
              aria-hidden
            />
          </div>
        ) : (trips.data ?? []).length === 0 ? (
          <p className="p-5 text-sm text-muted-foreground">
            {tr(
              'No trips recorded yet. A trip appears here as soon as a captain starts one in Captain Mode.',
            )}
          </p>
        ) : (
          <>
            {openTrips.length > 0 && (
              <p className="border-b border-border bg-secondary/40 px-5 py-3 text-xs text-muted-foreground">
                {openTrips.length} {tr(openTrips.length === 1 ? 'trip' : 'trips')}{' '}
                {tr(
                  'still open. A trip left open overnight is usually a captain who forgot to end it — you can close it here.',
                )}
              </p>
            )}
            <ul className="divide-y divide-border">
              {(trips.data ?? []).map((t) => (
                <li key={t.id} className="p-5">
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                    <span
                      className={cn(
                        'flex-shrink-0 rounded-full border px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.14em]',
                        STATUS_CHIP[t.status] ?? STATUS_CHIP.completed,
                      )}
                    >
                      {tr(t.status)}
                    </span>
                    <p className="text-sm font-semibold text-foreground">
                      {t.boatLabel}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {tr(t.purposeLabel)}
                      {t.destination ? ` · ${t.destination}` : ''}
                    </p>
                    <p className="ml-auto text-xs tabular-nums text-muted-foreground">
                      {fmtDate(t.startedAt)} · {t.startedTime}
                      {t.endedTime !== '—' ? `–${t.endedTime}` : ''}
                    </p>
                  </div>

                  <p className="mt-1 text-xs text-muted-foreground">
                    {fmtDuration(t.durationMin)}
                    {t.distanceNm != null && ` · ${t.distanceNm.toFixed(1)} nm`}
                    {t.engineHours != null &&
                      ` · ${t.engineHours}h ${tr('engine')}`}
                    {t.fuelUsedPct != null &&
                      ` · ${t.fuelUsedPct}% ${tr('fuel')}`}
                    {' · '}
                    {t.guests} {tr(t.guests === 1 ? 'guest' : 'guests')}
                    {t.captainName ? ` · ${t.captainName}` : ''}
                    {/* Position count is the honest measure of how well the
                        track was recorded. */}
                    {t.positionCount > 0
                      ? ` · ${t.positionCount} ${tr('fixes')}`
                      : ` · ${tr('no track')}`}
                  </p>

                  {t.guestNames.length > 0 && (
                    <ul className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1">
                      {t.guestNames.map((g, i) => {
                        const country = countryName(g.country)
                        return (
                          <li
                            key={`${g.name}-${i}`}
                            className="flex items-center gap-1.5 text-xs text-foreground"
                          >
                            {g.country && (
                              <img
                                src={flagUrl(g.country) || '/placeholder.svg'}
                                alt={country}
                                width={18}
                                height={13}
                                className="h-3 w-[18px] rounded-[2px] object-cover ring-1 ring-border"
                                crossOrigin="anonymous"
                              />
                            )}
                            {g.name}
                          </li>
                        )
                      })}
                    </ul>
                  )}

                  {t.notes && (
                    <p className="mt-1 text-xs italic text-muted-foreground">
                      {t.notes}
                    </p>
                  )}

                  <div className="mt-2 flex flex-wrap gap-2">
                    {/* Only offered when there is something to draw. A button
                        that opens an empty map on a trip with no fixes teaches
                        the office to stop pressing it. */}
                    {t.positionCount > 0 && (
                      <button
                        type="button"
                        onClick={() =>
                          setTrackOpen(trackOpen === t.id ? null : t.id)
                        }
                        aria-expanded={trackOpen === t.id}
                        className="flex min-h-11 cursor-pointer items-center gap-1.5 rounded-full border border-border px-4 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground transition-colors hover:bg-secondary"
                      >
                        <Map className="h-3.5 w-3.5" aria-hidden />
                        {trackOpen === t.id ? tr('Hide track') : tr('Track')}
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() =>
                        setGuestEdit(guestEdit === t.id ? null : t.id)
                      }
                      aria-expanded={guestEdit === t.id}
                      className="flex min-h-11 cursor-pointer items-center gap-1.5 rounded-full border border-border px-4 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground transition-colors hover:bg-secondary"
                    >
                      <Users className="h-3.5 w-3.5" aria-hidden />
                      {guestEdit === t.id ? tr('Cancel') : tr('Guests')}
                    </button>
                    {t.status === 'active' && (
                      <button
                        type="button"
                        onClick={() =>
                          setClosing(closing === t.id ? null : t.id)
                        }
                        className="min-h-11 cursor-pointer rounded-full border border-border px-4 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground transition-colors hover:bg-secondary"
                      >
                        {closing === t.id
                          ? tr('Cancel')
                          : tr('Close from office')}
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={async () => {
                        if (
                          !confirm(
                            `${tr('Delete this trip and its track? This cannot be undone.')} (${t.boatLabel})`,
                          )
                        )
                          return
                        await deleteTrip(t.id)
                        trips.mutate()
                      }}
                      className="flex min-h-11 cursor-pointer items-center gap-1.5 rounded-full border border-border px-4 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground transition-colors hover:border-[#b0203a]/40 hover:text-[#b0203a] dark:hover:text-[#f0a8b4]"
                    >
                      <Trash2 className="h-3.5 w-3.5" aria-hidden />
                      {tr('Delete')}
                    </button>
                  </div>

                  {guestEdit === t.id && (
                    <GuestNamesForm
                      trip={t}
                      onDone={() => {
                        setGuestEdit(null)
                        trips.mutate()
                      }}
                    />
                  )}

                  {trackOpen === t.id && <TripTrackPanel tripId={t.id} />}

                  {closing === t.id && (
                    <CloseTripForm
                      trip={t}
                      onDone={() => {
                        setClosing(null)
                        trips.mutate()
                      }}
                    />
                  )}
                </li>
              ))}
            </ul>
          </>
        )}
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card
          title={tr('Captains')}
          hint={tr('Who can be logged on a trip')}
          icon={UserRound}
        >
          <div className="flex flex-col gap-3 p-5">
            <div className="flex flex-wrap gap-2">
              <input
                value={capName}
                onChange={(e) => setCapName(e.target.value)}
                placeholder={tr('Name')}
                className="min-h-11 min-w-[8rem] flex-1 rounded-lg border border-border bg-background px-3 text-sm text-foreground"
              />
              <input
                value={capPhone}
                onChange={(e) => setCapPhone(e.target.value)}
                placeholder={tr('Phone (optional)')}
                className="min-h-11 min-w-[8rem] flex-1 rounded-lg border border-border bg-background px-3 text-sm text-foreground"
              />
              <button
                type="button"
                onClick={addCaptain}
                className="flex min-h-11 cursor-pointer items-center gap-1.5 rounded-full bg-accent px-5 text-[11px] font-semibold uppercase tracking-[0.14em] text-accent-foreground"
              >
                <Plus className="h-3.5 w-3.5" aria-hidden />
                {tr('Add')}
              </button>
            </div>

            {(caps.data ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground">
                {tr(
                  'No captains yet. A trip can still run without one, but the log will not say who was aboard.',
                )}
              </p>
            ) : (
              <ul className="divide-y divide-border">
                {(caps.data ?? []).map((c) => (
                  <li
                    key={c.id}
                    className="flex flex-wrap items-center gap-x-3 gap-y-1 py-3"
                  >
                    <p className="text-sm text-foreground">{c.name}</p>
                    {c.phone && (
                      <p className="text-xs tabular-nums text-muted-foreground">
                        {c.phone}
                      </p>
                    )}
                    <p className="ml-auto text-xs text-muted-foreground">
                      {c.tripCount} {tr(c.tripCount === 1 ? 'trip' : 'trips')}
                    </p>
                    <button
                      type="button"
                      onClick={async () => {
                        if (!confirm(`${tr('Remove')} ${c.name}?`)) return
                        await deleteCaptain(c.id)
                        caps.mutate()
                      }}
                      aria-label={`${tr('Remove')} ${c.name}`}
                      className="flex h-11 w-11 flex-shrink-0 cursor-pointer items-center justify-center rounded-full text-muted-foreground transition-colors hover:text-[#b0203a] dark:hover:text-[#f0a8b4]"
                    >
                      <Trash2 className="h-4 w-4" aria-hidden />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Card>

        <Card
          title={tr('Captain Mode links')}
          hint={tr('One link per phone')}
          icon={KeyRound}
        >
          <div className="flex flex-col gap-3 p-5">
            <p className="text-xs text-muted-foreground">
              {tr(
                'Each link is the key to one boat\u2019s Captain Mode. Send it to the captain\u2019s phone and have them add it to the home screen — no password to remember at sea. Copy a link again any time below, or revoke it if a phone is lost.',
              )}
            </p>

            {/* Only in the v0 preview. A preview host may answer for a quick
                test but disappears with the preview, so this warns without
                overstating: the wrong claim would be as unhelpful as none. */}
            {origin && !linkIsPublic && (
              <p className="rounded-lg border border-[#8f6d3a]/40 bg-[#8f6d3a]/10 p-3 text-xs text-[#8f6d3a] dark:border-[#e0b877]/40 dark:bg-[#e0b877]/10 dark:text-[#e0b877]">
                {tr(
                  'Preview address — fine for a quick test today, but it stops working once the preview shuts down. Publish the site and copy the link again before it goes on a captain\u2019s phone for good.',
                )}
              </p>
            )}

            <div className="flex flex-wrap gap-2">
              <select
                value={devBoat}
                onChange={(e) => setDevBoat(e.target.value)}
                className="min-h-11 rounded-lg border border-border bg-background px-3 text-sm text-foreground"
              >
                {BOATS.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
              <input
                value={devLabel}
                onChange={(e) => setDevLabel(e.target.value)}
                placeholder={tr('Whose phone')}
                className="min-h-11 min-w-[8rem] flex-1 rounded-lg border border-border bg-background px-3 text-sm text-foreground"
              />
              <button
                type="button"
                onClick={addDevice}
                className="flex min-h-11 cursor-pointer items-center gap-1.5 rounded-full bg-accent px-5 text-[11px] font-semibold uppercase tracking-[0.14em] text-accent-foreground"
              >
                <Plus className="h-3.5 w-3.5" aria-hidden />
                {tr('Create')}
              </button>
            </div>

            {/* Highlighted right after creation so the new link is not lost in
                the list below — every link is also retrievable per row. */}
            {newToken && (
              <div className="flex flex-col gap-2 rounded-xl border border-accent/40 bg-accent/10 p-4">
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-accent">
                  {tr('New link — send it to the phone')}
                </p>
                <p className="break-all font-mono text-xs text-foreground">
                  {captainLink(newToken)}
                </p>
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard?.writeText(captainLink(newToken))
                    setCopiedId('new')
                  }}
                  className="flex min-h-11 w-fit cursor-pointer items-center gap-1.5 rounded-full border border-accent/50 px-4 text-[10px] font-semibold uppercase tracking-[0.14em] text-accent"
                >
                  <Copy className="h-3.5 w-3.5" aria-hidden />
                  {copiedId === 'new' ? tr('Copied') : tr('Copy link')}
                </button>
              </div>
            )}

            {(devs.data ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground">
                {tr('No phones linked yet.')}
              </p>
            ) : (
              <ul className="divide-y divide-border">
                {(devs.data ?? []).map((d) => (
                  <li
                    key={d.id}
                    className="flex flex-wrap items-center gap-x-3 gap-y-1 py-3"
                  >
                    <Ship
                      className="h-4 w-4 flex-shrink-0 text-muted-foreground"
                      aria-hidden
                    />
                    <p className="text-sm text-foreground">{d.boatLabel}</p>
                    <p className="text-xs text-muted-foreground">{d.label}</p>
                    <p className="ml-auto text-xs text-muted-foreground">
                      {!d.active
                        ? tr('Revoked')
                        : d.lastSeenAt
                          ? `${tr('Last seen')} ${lastSeen(d.lastSeenAt)}`
                          : tr('Never used')}
                    </p>
                    {/* Opens the captain's own screen in this browser. Without
                        it the only way in is to copy a link and paste it on a
                        phone, which makes the screen effectively invisible from
                        the office — including while it is being built. */}
                    {d.active && (
                      <a
                        href={`/captain?t=${d.token}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex min-h-11 flex-shrink-0 items-center gap-1.5 rounded-full border px-3 text-[10px] font-semibold uppercase tracking-[0.14em]"
                        style={{
                          borderColor: '#8f6d3a59',
                          color: '#8f6d3a',
                        }}
                        title={`${tr('Open Captain Mode in a new tab')} — ${d.boatLabel}`}
                      >
                        <ExternalLink className="h-3.5 w-3.5" aria-hidden />
                        {tr('Open')}
                      </a>
                    )}
                    {/* Retrievable, not shown once. A captain gets a new phone
                        and the link has to be sent again; hiding it would only
                        force a pointless new token, since anyone on this screen
                        can already create one. */}
                    {d.active && (
                      <button
                        type="button"
                        onClick={() => {
                          navigator.clipboard?.writeText(captainLink(d.token))
                          setCopiedId(d.id)
                        }}
                        className="flex min-h-11 cursor-pointer items-center gap-1.5 rounded-full border border-border px-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground hover:text-foreground"
                        title={`${tr('Copy the Captain Mode link')} — ${d.boatLabel}`}
                      >
                        <Copy className="h-3.5 w-3.5" aria-hidden />
                        {copiedId === d.id ? tr('Copied') : tr('Copy link')}
                      </button>
                    )}
                    {d.active && (
                      <button
                        type="button"
                        onClick={async () => {
                          if (
                            !confirm(
                              `${tr('Revoke this link? That phone will stop reporting.')} (${d.boatLabel} — ${d.label})`,
                            )
                          )
                            return
                          await revokeFleetDevice(d.id)
                          devs.mutate()
                        }}
                        className="min-h-11 flex-shrink-0 cursor-pointer rounded-full border border-border px-4 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground transition-colors hover:border-[#b0203a]/40 hover:text-[#b0203a] dark:hover:text-[#f0a8b4]"
                      >
                        {tr('Revoke')}
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Card>
      </div>
    </div>
  )
}

// Leaflet touches `window` on import, so the canvas is client-only. Loaded on
// demand: most visits to this page never open a track, and the tile library is
// not worth shipping to them.
function TrackLoading() {
  const tr = useT()
  return (
    <div className="flex h-[360px] items-center justify-center text-xs text-muted-foreground">
      <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
      {tr('Drawing the route…')}
    </div>
  )
}

const TripTrackCanvas = dynamic(() => import('./trip-track-canvas'), {
  ssr: false,
  loading: () => <TrackLoading />,
})

/** The route of one trip, with the fish that came off it marked along the way. */
function TripTrackPanel({ tripId }: { tripId: string }) {
  const tr = useT()
  const track = useSWR(['trip-track', tripId], () => getTripTrack(tripId))
  // Catches are fetched for the page and filtered here rather than queried per
  // trip: the log is already loaded on the Fishing page and this keeps one
  // source for both, so a correction shows up in the same shape everywhere.
  const all = useSWR('catch-log-for-track', () => listCatches(200))

  const mine = (all.data ?? []).filter((c) => c.tripId === tripId)
  const landed = mine.filter((c) => !c.released).length

  if (track.isLoading) {
    return (
      <p className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
        <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
        {tr('Loading the track…')}
      </p>
    )
  }

  return (
    <div className="mt-3 overflow-hidden rounded-xl border border-border">
      <TripTrackCanvas track={track.data ?? []} catches={mine} />
      <p className="border-t border-border bg-secondary/40 px-4 py-3 text-[11px] text-muted-foreground">
        {(track.data ?? []).length} {tr('fixes')}
        {mine.length > 0
          ? ` · ${mine.length} ${tr('fish on this trip')} (${landed} ${tr('kept')}, ${mine.length - landed} ${tr('released')})`
          : ` · ${tr('no fish logged on this trip')}`}
        {'. '}
        {tr(
          'Green marks the mooring, dark blue dots are fish kept and pale blue released — hover any dot for the species, weight and time. Fish caught close together sit on one another until you zoom in, and a fish logged without a position is in the log but not on the map.',
        )}
      </p>
    </div>
  )
}
