import { and, desc, eq } from 'drizzle-orm'
import { NextResponse } from 'next/server'

import { db } from '@/lib/db'
import { fleetDevices, tripPositions, trips } from '@/lib/db/schema'
import { newId } from '@/lib/fleet'

/**
 * GPS position ingest.
 *
 * A route rather than a Server Action because this is the one thing the phone
 * must be able to send while the page is being hidden or unloaded:
 * `navigator.sendBeacon` and `fetch(..., { keepalive: true })` can post to a
 * URL during unload, which a Server Action cannot. Losing the last fix as the
 * captain pockets the phone is exactly the fix you most want to keep.
 *
 * Accepts BOTH sources from day one:
 *   - `source: "phone"`   — the captain's browser (works today)
 *   - `source: "tracker"` — a hardware GPS/SIM unit (fitted later)
 * A tracker only has to POST the same JSON with its own token, so no rework is
 * needed when one is bought.
 *
 * Auth is the per-boat device token, never an admin session: the phone at sea
 * is not signed in. Without a token check anyone could post fake positions for
 * our boats, and a wrong track is more dangerous than a missing one.
 *
 * Body:
 *   { token, positions: [{ lat, lon, speedKn?, headingDeg?, accuracyM?,
 *                          recordedAt?, source? }] }
 * A single `position` object is also accepted, for simple tracker firmware.
 */

type Incoming = {
  lat: unknown
  lon: unknown
  speedKn?: unknown
  headingDeg?: unknown
  accuracyM?: unknown
  recordedAt?: unknown
  source?: unknown
}

const num = (v: unknown): number | null =>
  typeof v === 'number' && Number.isFinite(v) ? v : null

function cleanPoint(p: Incoming) {
  const lat = num(p.lat)
  const lon = num(p.lon)

  // Reject anything off the planet. A 0/0 fix ("null island") is the classic
  // GPS failure value and would draw the boat into the Atlantic.
  if (lat == null || lon == null) return null
  if (Math.abs(lat) > 90 || Math.abs(lon) > 180) return null
  if (lat === 0 && lon === 0) return null

  const when =
    typeof p.recordedAt === 'string' && !Number.isNaN(Date.parse(p.recordedAt))
      ? new Date(p.recordedAt)
      : new Date()

  // A fix cannot come from the future; clocks on cheap devices do drift.
  const recordedAt = when.getTime() > Date.now() + 60_000 ? new Date() : when

  return {
    lat,
    lon,
    speedKn: num(p.speedKn),
    headingDeg: num(p.headingDeg),
    accuracyM: num(p.accuracyM),
    source: p.source === 'tracker' ? 'tracker' : 'phone',
    recordedAt,
  }
}

export async function POST(request: Request): Promise<NextResponse> {
  let body: {
    token?: unknown
    positions?: unknown
    position?: unknown
  }

  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const token = typeof body.token === 'string' ? body.token.trim() : ''
  if (!token) {
    return NextResponse.json({ error: 'Missing token' }, { status: 401 })
  }

  const device = await db
    .select()
    .from(fleetDevices)
    .where(and(eq(fleetDevices.token, token), eq(fleetDevices.active, true)))
    .limit(1)

  if (!device.length) {
    return NextResponse.json({ error: 'Unknown device' }, { status: 403 })
  }

  const raw = Array.isArray(body.positions)
    ? body.positions
    : body.position
      ? [body.position]
      : []

  // A generous cap: a phone that was offline for hours uploads its whole
  // buffer at once, and dropping that batch would lose the trip's track.
  const points = raw
    .slice(0, 500)
    .map((p) => cleanPoint(p as Incoming))
    .filter((p): p is NonNullable<ReturnType<typeof cleanPoint>> => p !== null)

  if (!points.length) {
    return NextResponse.json({ error: 'No valid positions' }, { status: 400 })
  }

  // The token identifies the boat; the open trip is looked up server-side so a
  // device can never write into another boat's trip.
  const open = await db
    .select()
    .from(trips)
    .where(and(eq(trips.boat, device[0].boat), eq(trips.status, 'active')))
    .orderBy(desc(trips.startedAt))
    .limit(1)

  // Always mark the device as alive, even with no trip open: that is how the
  // office can tell "phone is fine, nobody started a trip" apart from "phone
  // is dead", which are two very different problems.
  await db
    .update(fleetDevices)
    .set({ lastSeenAt: new Date() })
    .where(eq(fleetDevices.id, device[0].id))

  if (!open.length) {
    // 202: the message was fine, there is simply nothing to attach it to. Not
    // an error, or the phone would retry the same batch for ever.
    return NextResponse.json(
      { stored: 0, reason: 'no-active-trip' },
      { status: 202 },
    )
  }

  await db.insert(tripPositions).values(
    points.map((p) => ({
      id: newId('pos'),
      tripId: open[0].id,
      lat: p.lat,
      lon: p.lon,
      speedKn: p.speedKn,
      headingDeg: p.headingDeg,
      accuracyM: p.accuracyM,
      source: p.source,
      recordedAt: p.recordedAt,
    })),
  )

  return NextResponse.json({ stored: points.length, tripId: open[0].id })
}

/** Lets a tracker or a phone confirm its token without sending a position. */
export async function GET(request: Request): Promise<NextResponse> {
  const token = new URL(request.url).searchParams.get('token')?.trim() ?? ''
  if (!token) {
    return NextResponse.json({ error: 'Missing token' }, { status: 401 })
  }

  const device = await db
    .select()
    .from(fleetDevices)
    .where(and(eq(fleetDevices.token, token), eq(fleetDevices.active, true)))
    .limit(1)

  if (!device.length) {
    return NextResponse.json({ error: 'Unknown device' }, { status: 403 })
  }

  return NextResponse.json({ ok: true, boat: device[0].boat })
}
