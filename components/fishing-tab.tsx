'use client'

import {
  Anchor,
  Crosshair,
  EyeOff,
  Fish,
  Loader2,
  MapPin,
  Plus,
  Trash2,
  TrendingUp,
  Waves,
} from 'lucide-react'
import dynamic from 'next/dynamic'
import { useState } from 'react'
import useSWR from 'swr'

import {
  archiveSpot,
  createSpot,
  deleteCatch,
  getSpotInsights,
  listCatches,
  listSpots,
} from '@/app/actions/fishing'
import { MIN_CONFIDENT_CATCHES, SPOT_KINDS, hourWindow, methodLabel, spotKindLabel } from '@/lib/fishing'
import { LODGE } from '@/lib/lodge'

// Leaflet touches `window` at import time, so it must never render on the
// server.
const SpotsMapCanvas = dynamic(() => import('./spots-map-canvas'), {
  ssr: false,
  loading: () => (
    <div className="flex h-[420px] w-full items-center justify-center bg-secondary/40">
      <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" aria-hidden />
    </div>
  ),
})

function dec(v: number | null | undefined, places = 1) {
  if (v == null) return null
  return v.toFixed(places)
}

export function FishingTab() {
  const spots = useSWR('fishing-spots', () => listSpots(), {
    refreshInterval: 60000,
    revalidateOnFocus: true,
  })
  const catchLog = useSWR('fishing-catches', () => listCatches(100), {
    refreshInterval: 60000,
    revalidateOnFocus: true,
  })
  const insights = useSWR('fishing-insights', () => getSpotInsights(), {
    refreshInterval: 120000,
  })

  const [nautical, setNautical] = useState(true)
  const [selectedId, setSelectedId] = useState<string | null>(null)

  // A picked position from the map, waiting for a name. Held here rather than
  // in the form so a click on the map can open the form pre-filled.
  const [picked, setPicked] = useState<{ lat: number; lon: number } | null>(null)
  const [name, setName] = useState('')
  const [kind, setKind] = useState<string>('reef')
  const [depth, setDepth] = useState('')
  const [secret, setSecret] = useState(false)
  const [saving, setSaving] = useState(false)
  const [failed, setFailed] = useState<string | null>(null)

  const rows = spots.data ?? []
  const logRows = catchLog.data ?? []

  const saveSpot = async () => {
    if (!picked || !name.trim()) return
    setSaving(true)
    setFailed(null)
    try {
      await createSpot({
        name: name.trim(),
        lat: picked.lat,
        lon: picked.lon,
        kind,
        depthM: depth === '' ? null : Number(depth),
        secret,
      })
      setPicked(null)
      setName('')
      setDepth('')
      setSecret(false)
      spots.mutate()
    } catch (e) {
      setFailed(e instanceof Error ? e.message : 'Could not save the spot')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* ---------------- map ---------------- */}
      <section className="overflow-hidden rounded-2xl border border-border bg-card">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 bg-panel-header p-5">
          <div>
            <p className="flex items-center gap-2 text-[10px] font-medium uppercase tracking-[0.22em] text-panel-header-foreground/55">
              <MapPin className="h-3.5 w-3.5" aria-hidden />
              Spots
            </p>
            <p className="mt-1 text-xs uppercase tracking-[0.12em] text-panel-header-foreground/40">
              Bigger circle, more fish landed
            </p>
          </div>
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setNautical(!nautical)}
              aria-pressed={nautical}
              className="min-h-11 cursor-pointer rounded-full px-4 text-[10px] font-semibold uppercase tracking-[0.14em]"
              style={{
                backgroundColor: nautical
                  ? 'rgba(158,203,221,.18)'
                  : 'rgba(255,255,255,.05)',
                color: nautical ? '#9ecbdd' : 'rgba(255,255,255,.55)',
              }}
            >
              Sea marks
            </button>
          </div>
        </div>

        <p className="border-b border-border px-5 py-3 text-xs text-muted-foreground">
          {picked
            ? 'Position picked — name it below to save.'
            : 'Click anywhere on the water to add a spot. Typing coordinates by hand is slow and easy to get wrong by a whole degree.'}
        </p>

        <SpotsMapCanvas
          lat={LODGE.latitude}
          lon={LODGE.longitude}
          label={LODGE.name}
          spots={rows.map((s) => ({
            id: s.id,
            name: s.name,
            lat: s.lat,
            lon: s.lon,
            kind: s.kind,
            catchCount: s.catchCount,
            bestKg: s.bestKg,
            topSpecies: s.topSpecies,
            secret: s.secret,
          }))}
          nautical={nautical}
          onPick={(lat, lon) => setPicked({ lat, lon })}
          selectedId={selectedId}
          onSelect={setSelectedId}
        />

        {/* The naming form appears only after a position exists, so a spot can
            never be saved without one. */}
        {picked && (
          <div className="border-t border-border p-5">
            <p className="flex items-center gap-2 text-xs text-muted-foreground">
              <Crosshair className="h-3.5 w-3.5" aria-hidden />
              <span className="tabular-nums">
                {picked.lat.toFixed(4)}, {picked.lon.toFixed(4)}
              </span>
            </p>

            {failed && (
              <p className="mt-3 rounded-lg border border-[#b0203a]/40 bg-[#b0203a]/10 p-3 text-xs text-[#b0203a] dark:text-[#f0a8b4]">
                {failed}
              </p>
            )}

            <div className="mt-3 flex flex-wrap items-center gap-3">
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Spot name"
                autoFocus
                className="min-h-11 flex-1 rounded-lg border border-border bg-background px-3 text-sm text-foreground outline-none placeholder:text-muted-foreground"
              />
              <select
                value={kind}
                onChange={(e) => setKind(e.target.value)}
                className="min-h-11 cursor-pointer rounded-lg border border-border bg-background px-3 text-sm text-foreground"
              >
                {SPOT_KINDS.map((k) => (
                  <option key={k.value} value={k.value}>
                    {k.label}
                  </option>
                ))}
              </select>
              <input
                value={depth}
                onChange={(e) => setDepth(e.target.value.replace(/[^0-9]/g, ''))}
                inputMode="numeric"
                placeholder="Depth m"
                className="min-h-11 w-24 rounded-lg border border-border bg-background px-3 text-sm tabular-nums text-foreground outline-none placeholder:text-muted-foreground"
              />
              {/* Hard-won marks are an asset. This keeps them off anything a
                  guest can see; it is not a security boundary. */}
              <button
                type="button"
                onClick={() => setSecret(!secret)}
                aria-pressed={secret}
                className="flex min-h-11 cursor-pointer items-center gap-1.5 rounded-full border px-4 text-[10px] font-semibold uppercase tracking-[0.14em]"
                style={{
                  borderColor: secret ? '#8f6d3a59' : 'var(--border)',
                  color: secret ? '#8f6d3a' : 'var(--muted-foreground)',
                }}
              >
                <EyeOff className="h-3.5 w-3.5" aria-hidden />
                {secret ? 'Ours only' : 'Shareable'}
              </button>
              <button
                type="button"
                onClick={saveSpot}
                disabled={saving || !name.trim()}
                className="flex min-h-11 cursor-pointer items-center gap-2 rounded-full bg-primary px-5 text-[10px] font-semibold uppercase tracking-[0.14em] text-primary-foreground disabled:opacity-40"
              >
                {saving ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                ) : (
                  <Plus className="h-3.5 w-3.5" aria-hidden />
                )}
                Save spot
              </button>
              <button
                type="button"
                onClick={() => {
                  setPicked(null)
                  setFailed(null)
                }}
                className="min-h-11 cursor-pointer px-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* ---- spot list ---- */}
        <div className="border-t border-border p-5">
          {rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No spots saved yet. Click the map above, or let a captain save one
              from the boat where they are standing.
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {rows.map((s) => (
                <li key={s.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-3">
                  <button
                    type="button"
                    onClick={() => setSelectedId(s.id)}
                    className="flex min-h-11 flex-1 cursor-pointer items-center gap-2 text-left"
                  >
                    <Anchor
                      className="h-4 w-4 flex-shrink-0 text-muted-foreground"
                      aria-hidden
                    />
                    <span className="text-sm text-foreground">{s.name}</span>
                    <span className="text-xs text-muted-foreground">
                      {spotKindLabel(s.kind)}
                      {s.depthM ? ` · ${s.depthM} m` : ''}
                    </span>
                    {s.secret && (
                      <EyeOff
                        className="h-3.5 w-3.5 flex-shrink-0"
                        style={{ color: '#8f6d3a' }}
                        aria-label="Not shown to guests"
                      />
                    )}
                  </button>

                  <span className="text-xs tabular-nums text-muted-foreground">
                    {s.catchCount === 0
                      ? 'no catches yet'
                      : `${s.catchCount} ${s.catchCount === 1 ? 'catch' : 'catches'}`}
                    {s.releasedCount > 0 && ` · ${s.releasedCount} released`}
                    {s.bestKg ? ` · best ${s.bestKg} kg` : ''}
                  </span>

                  <button
                    type="button"
                    onClick={async () => {
                      if (
                        !confirm(
                          `Archive "${s.name}"? Its catch history stays, but it disappears from the map and from Captain Mode.`,
                        )
                      )
                        return
                      await archiveSpot(s.id)
                      spots.mutate()
                    }}
                    className="min-h-11 flex-shrink-0 cursor-pointer px-2 text-muted-foreground transition-colors hover:text-[#b0203a] dark:hover:text-[#f0a8b4]"
                    aria-label={`Archive ${s.name}`}
                  >
                    <Trash2 className="h-4 w-4" aria-hidden />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      {/* ---------------- what each spot gives ---------------- */}
      <section className="overflow-hidden rounded-2xl border border-border bg-card">
        <div className="bg-panel-header p-5">
          <p className="flex items-center gap-2 text-[10px] font-medium uppercase tracking-[0.22em] text-panel-header-foreground/55">
            <TrendingUp className="h-3.5 w-3.5" aria-hidden />
            What each spot gives
          </p>
          <p className="mt-1 text-xs uppercase tracking-[0.12em] text-panel-header-foreground/40">
            Built from the conditions saved with every catch
          </p>
        </div>

        <div className="p-5">
          {(insights.data ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nothing to read yet. Every catch logged against a spot adds to
              this, and a pattern needs about {MIN_CONFIDENT_CATCHES} fish before
              it means anything.
            </p>
          ) : (
            <ul className="space-y-4">
              {(insights.data ?? []).map((i) => (
                <li
                  key={i.spotId}
                  className="rounded-xl border border-border p-4"
                >
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    <p className="text-sm font-medium text-foreground">
                      {i.spotName}
                    </p>
                    <p className="text-xs tabular-nums text-muted-foreground">
                      {i.catchCount} {i.catchCount === 1 ? 'catch' : 'catches'}
                    </p>
                    {/* Everything below the threshold is labelled as a tally,
                        never a finding. One fish would otherwise read as
                        "100% on a rising tide" and could send a boat two hours
                        the wrong way. */}
                    {!i.confident && (
                      <span
                        className="rounded-full px-2.5 py-1 text-[9px] font-semibold uppercase tracking-[0.14em]"
                        style={{
                          backgroundColor: 'rgba(168,118,26,.15)',
                          color: '#8f6d3a',
                        }}
                      >
                        Too early to call
                      </span>
                    )}
                  </div>

                  <p className="mt-2 text-xs text-muted-foreground">
                    {i.species
                      .slice(0, 3)
                      .map((s) => `${s.name} (${s.n})`)
                      .join(' · ')}
                  </p>

                  {i.confident ? (
                    <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-xs">
                      {i.risingShare != null && (
                        <p className="text-muted-foreground">
                          Tide{' '}
                          <span className="font-medium tabular-nums text-foreground">
                            {Math.round(i.risingShare * 100)}% rising
                          </span>
                        </p>
                      )}
                      {i.avgSstC != null && (
                        <p className="text-muted-foreground">
                          Sea{' '}
                          <span className="font-medium tabular-nums text-foreground">
                            {dec(i.avgSstC)} °C
                          </span>
                        </p>
                      )}
                      {i.avgPressureHpa != null && (
                        <p className="text-muted-foreground">
                          Pressure{' '}
                          <span className="font-medium tabular-nums text-foreground">
                            {dec(i.avgPressureHpa, 0)} hPa
                          </span>
                        </p>
                      )}
                      {i.avgGustsKmh != null && (
                        <p className="text-muted-foreground">
                          Gusts{' '}
                          <span className="font-medium tabular-nums text-foreground">
                            {dec(i.avgGustsKmh, 0)} km/h
                          </span>
                        </p>
                      )}
                      {i.bestHours.length > 0 && (
                        <p className="text-muted-foreground">
                          Best{' '}
                          <span className="font-medium tabular-nums text-foreground">
                            {hourWindow(i.bestHours[0].hour)}
                          </span>
                        </p>
                      )}
                    </div>
                  ) : (
                    <p className="mt-3 text-xs text-muted-foreground">
                      {MIN_CONFIDENT_CATCHES - i.catchCount} more{' '}
                      {MIN_CONFIDENT_CATCHES - i.catchCount === 1
                        ? 'catch'
                        : 'catches'}{' '}
                      before the conditions here are worth reading as a pattern.
                    </p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      {/* ---------------- catch log ---------------- */}
      <section className="overflow-hidden rounded-2xl border border-border bg-card">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 bg-panel-header p-5">
          <div>
            <p className="flex items-center gap-2 text-[10px] font-medium uppercase tracking-[0.22em] text-panel-header-foreground/55">
              <Fish className="h-3.5 w-3.5" aria-hidden />
              Catch log
            </p>
            <p className="mt-1 text-xs uppercase tracking-[0.12em] text-panel-header-foreground/40">
              Newest first
            </p>
          </div>
          <span className="ml-auto text-[10px] font-medium uppercase tracking-[0.18em] text-panel-header-foreground/45">
            {logRows.length} {logRows.length === 1 ? 'fish' : 'fish'}
          </span>
        </div>

        <div className="p-5">
          {logRows.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No catches logged yet. A captain logs them from Captain Mode while
              the trip is open.
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {logRows.map((c) => (
                <li key={c.id} className="flex gap-3 py-3">
                  {/* Thumbnail links to the full image in a new tab rather than
                      opening a lightbox: the owner or a guest just wants to see
                      the fish, and a plain link needs no modal machinery. */}
                  {c.photoUrl && (
                    <a
                      href={c.photoUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-shrink-0"
                    >
                      <img
                        src={c.photoUrl || '/placeholder.svg'}
                        alt={`${c.species}${c.weightKg != null ? ` ${c.weightKg} kg` : ''}`}
                        className="h-14 w-14 rounded-lg object-cover"
                        loading="lazy"
                      />
                    </a>
                  )}
                  <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    <p className="text-sm font-medium text-foreground">
                      {c.species}
                    </p>
                    {c.weightKg != null && (
                      <p className="text-sm tabular-nums text-foreground">
                        {c.weightKg} kg
                      </p>
                    )}
                    {/* Released is an outcome in its own right: billfish are
                        nearly always released, and a released fish still proves
                        the spot works. */}
                    {c.released && (
                      <span
                        className="rounded-full px-2.5 py-1 text-[9px] font-semibold uppercase tracking-[0.14em]"
                        style={{
                          backgroundColor: 'rgba(69,107,73,.15)',
                          color: '#456b49',
                        }}
                      >
                        Released
                      </span>
                    )}
                    <p className="ml-auto text-xs tabular-nums text-muted-foreground">
                      {c.caughtAtLabel}
                    </p>
                    <button
                      type="button"
                      onClick={async () => {
                        if (
                          !confirm(
                            `Delete this ${c.species} from the log? The conditions saved with it cannot be recovered.`,
                          )
                        )
                          return
                        await deleteCatch(c.id)
                        catchLog.mutate()
                        spots.mutate()
                        insights.mutate()
                      }}
                      className="min-h-11 flex-shrink-0 cursor-pointer px-2 text-muted-foreground transition-colors hover:text-[#b0203a] dark:hover:text-[#f0a8b4]"
                      aria-label={`Delete ${c.species}`}
                    >
                      <Trash2 className="h-4 w-4" aria-hidden />
                    </button>
                  </div>

                  <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                    <span>{c.boatLabel}</span>
                    {c.spotName && <span>{c.spotName}</span>}
                    {c.guestName && <span>{c.guestName}</span>}
                    {methodLabel(c.method) && <span>{methodLabel(c.method)}</span>}
                  </p>

                  {/* The snapshot. Shown because it is the reason the log is
                      worth keeping — and because these numbers can never be
                      looked up again for a past date. */}
                  {(c.tideM != null || c.gustsKmh != null || c.sstC != null) && (
                    <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground/80">
                      <Waves className="h-3 w-3" aria-hidden />
                      {c.tideM != null && (
                        <span className="tabular-nums">
                          {dec(c.tideM, 2)} m
                          {c.tidePhase ? ` ${c.tidePhase}` : ''}
                        </span>
                      )}
                      {c.gustsKmh != null && (
                        <span className="tabular-nums">
                          gusts {dec(c.gustsKmh, 0)} km/h
                        </span>
                      )}
                      {c.sstC != null && (
                        <span className="tabular-nums">{dec(c.sstC)} °C</span>
                      )}
                      {c.pressureHpa != null && (
                        <span className="tabular-nums">
                          {dec(c.pressureHpa, 0)} hPa
                        </span>
                      )}
                      {c.moonPhase && <span>{c.moonPhase}</span>}
                    </p>
                  )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </div>
  )
}
