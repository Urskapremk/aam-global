'use server'

import { and, asc, desc, eq, gte, inArray, sql } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'

import { getFuelAlerts } from '@/app/actions/fuel'
import { getMaintenanceAlerts } from '@/app/actions/maintenance'
import { isAdmin } from '@/lib/admin-auth'
import { BOATS, boatName, tripLabel, type BoatId } from '@/lib/boats'
import { db } from '@/lib/db'
import {
  boatBookings,
  captains,
  fishingSpots,
  fleetAlerts,
  fleetDevices,
  transfers,
  tripPositions,
  trips,
} from '@/lib/db/schema'
import {
  NO_SIGNAL_MIN,
  humanDuration,
  lodgeNow,
  lodgeTime,
  newId,
  purposeLabel,
  sunTimes,
  trackDistanceNm,
} from '@/lib/fleet'
import { LODGE } from '@/lib/lodge'

async function requireAdmin() {
  if (!(await isAdmin())) throw new Error('Unauthorized')
}

/**
 * Captain Mode has no login (the office chose that: typing a password on a wet
 * phone at sea is worse than useless). A per-boat device token stands in for
 * it — the captain opens a link once and the browser keeps the token. Without
 * this, anyone who found the URL could start trips and post fake positions for
 * our boats, and a false track is more dangerous than no track.
 */
async function boatForToken(token: string): Promise<BoatId> {
  const clean = (token || '').trim()
  if (!clean) throw new Error('Missing device token')

  const rows = await db
    .select()
    .from(fleetDevices)
    .where(and(eq(fleetDevices.token, clean), eq(fleetDevices.active, true)))
    .limit(1)

  if (!rows.length) throw new Error('Unknown or revoked device')
  return rows[0].boat as BoatId
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type LivePosition = {
  lat: number
  lon: number
  speedKn: number | null
  headingDeg: number | null
  source: string
  recordedAt: string
  /** Minutes since this fix, from lodge-local now. */
  ageMin: number
}

/** One guest on a trip: name plus an ISO2 country code (or "" if unknown). */
export type TripGuest = { name: string; country: string }

/**
 * Reads the `guestNames` jsonb into TripGuest[], tolerating the legacy shape
 * where it was a plain string[] of names (before country was added).
 */
function normalizeGuests(raw: unknown): TripGuest[] {
  if (!Array.isArray(raw)) return []
  return raw
    .map((g): TripGuest => {
      if (typeof g === 'string') return { name: g, country: '' }
      const o = g as { name?: unknown; country?: unknown }
      return {
        name: typeof o?.name === 'string' ? o.name : '',
        country: typeof o?.country === 'string' ? o.country : '',
      }
    })
    .filter((g) => g.name.trim().length > 0)
}

export type ActiveTrip = {
  id: string
  boat: BoatId
  boatLabel: string
  purpose: string
  purposeLabel: string
  captainName: string | null
  crew: string[]
  guests: number
  guestNames: TripGuest[]
  destination: string | null
  startedAt: string
  startedTime: string
  elapsed: string
  position: LivePosition | null
  /** Nautical miles covered so far, from the boat's own track. */
  distanceNm: number | null
  /** Oldest-to-newest fixes, so the map can draw the route actually sailed. */
  track: { lat: number; lon: number }[]
}

export type FleetAlert = {
  id: string
  kind: string
  severity: 'info' | 'warning' | 'critical'
  boat: string | null
  tripId: string | null
  message: string
}

export type BoatCard = {
  id: BoatId
  name: string
  specs: string
  image?: string
  /** 'at-sea' only when a trip is actually open — never guessed from a booking. */
  state: 'at-sea' | 'departing' | 'at-base'
  activeTrip: ActiveTrip | null
  /** Today's booking for this boat, if any. */
  today: {
    label: string
    guests: number
    departureTime: string
    guestName: string
    status: string
  } | null
  next: { date: string; label: string; departureTime: string } | null
  hasDevice: boolean
  tripsThisMonth: number
  hoursThisMonth: number
}

export type FleetOverview = {
  nowLocal: string
  today: string
  sunrise: string
  sunset: string
  base: { lat: number; lon: number; label: string }
  boats: BoatCard[]
  activeTrips: ActiveTrip[]
  alerts: FleetAlert[]
  /** Guest transfers scheduled today, from the existing transfers table. */
  transfersToday: {
    id: number
    reference: string
    from: string
    to: string
    time: string
    pax: number
    boat: string
    status: string
  }[]
  departuresToday: {
    boat: string
    label: string
    time: string
    guestName: string
    guests: number
    status: string
  }[]
}

// ---------------------------------------------------------------------------
// Overview (Command Center)
// ---------------------------------------------------------------------------

export async function getFleetOverview(): Promise<FleetOverview> {
  await requireAdmin()

  const { today, hhmm, nowLocal, instant } = lodgeNow()
  const { sunrise, sunset } = sunTimes(today)
  const monthStart = `${today.slice(0, 7)}-01`

  const [openTrips, bookings, txRows, capRows, devices, acks, monthTrips] =
    await Promise.all([
      db
        .select()
        .from(trips)
        .where(eq(trips.status, 'active'))
        .orderBy(asc(trips.startedAt)),
      db
        .select()
        .from(boatBookings)
        .where(
          and(
            gte(boatBookings.date, today),
            inArray(boatBookings.status, ['confirmed', 'pending']),
          ),
        )
        .orderBy(asc(boatBookings.date), asc(boatBookings.departureTime)),
      db
        .select()
        .from(transfers)
        .where(eq(transfers.date, today))
        .orderBy(asc(transfers.time)),
      db.select().from(captains),
      db.select().from(fleetDevices).where(eq(fleetDevices.active, true)),
      // Only acknowledgements matter here; the alert list itself is derived.
      db.select().from(fleetAlerts),
      db
        .select()
        .from(trips)
        .where(gte(trips.startedAt, new Date(`${monthStart}T00:00:00Z`))),
    ])

  const capName = (id: string | null) =>
    id ? (capRows.find((c) => c.id === id)?.name ?? null) : null

  // Track for each open trip. At most two boats, so a query each is clearer
  // than a window function and costs nothing.
  const tracks = await Promise.all(
    openTrips.map((t) =>
      db
        .select()
        .from(tripPositions)
        .where(eq(tripPositions.tripId, t.id))
        .orderBy(asc(tripPositions.recordedAt)),
    ),
  )

  const activeTrips: ActiveTrip[] = openTrips.map((t, i) => {
    const track = tracks[i]
    const last = track.length ? track[track.length - 1] : null
    const startedMs = new Date(t.startedAt).getTime()

    return {
      id: t.id,
      boat: t.boat as BoatId,
      boatLabel: boatName(t.boat),
      purpose: t.purpose,
      purposeLabel: purposeLabel(t.purpose),
      captainName: capName(t.captainId),
      crew: Array.isArray(t.crew) ? (t.crew as string[]) : [],
      guests: t.guests,
      guestNames: normalizeGuests(t.guestNames),
      destination: t.destination,
      startedAt: new Date(t.startedAt).toISOString(),
      startedTime: lodgeTime(t.startedAt),
      elapsed: humanDuration((instant.getTime() - startedMs) / 60000),
      position: last
        ? {
            lat: last.lat,
            lon: last.lon,
            speedKn: last.speedKn,
            headingDeg: last.headingDeg,
            source: last.source,
            recordedAt: new Date(last.recordedAt).toISOString(),
            ageMin: Math.max(
              0,
              Math.round(
                (instant.getTime() - new Date(last.recordedAt).getTime()) /
                  60000,
              ),
            ),
          }
        : null,
      distanceNm: track.length > 1 ? trackDistanceNm(track) : null,
      // Coordinates only: the map draws a line, and shipping speed/heading per
      // point would multiply the payload for nothing.
      track: track.map((p) => ({ lat: p.lat, lon: p.lon })),
    }
  })

  // --- Alerts, derived on every read ---------------------------------------
  // Suppressed by an acknowledgement for the SAME trip (or boat, when there is
  // no trip). Scoping to the trip matters: a boat that comes back and goes out
  // again must be able to raise the same alert afresh.
  const isAcked = (kind: string, tripId: string | null, boat: string | null) =>
    acks.some(
      (a) =>
        a.kind === kind &&
        a.acknowledgedAt != null &&
        (tripId ? a.tripId === tripId : a.boat === boat),
    )

  const alerts: FleetAlert[] = []
  const addAlert = (
    kind: string,
    severity: FleetAlert['severity'],
    message: string,
    tripId: string | null,
    boat: string | null,
  ) => {
    if (isAcked(kind, tripId, boat)) return
    alerts.push({
      id: `${kind}:${tripId ?? boat ?? 'global'}`,
      kind,
      severity,
      boat,
      tripId,
      message,
    })
  }

  for (const t of activeTrips) {
    const age = t.position?.ageMin ?? null
    const sinceStart = Math.round(
      (instant.getTime() - new Date(t.startedAt).getTime()) / 60000,
    )

    if (age == null) {
      // No fix at all. Only a problem once enough time has passed that one
      // should have arrived — otherwise every departure alerts for a minute.
      if (sinceStart > NO_SIGNAL_MIN) {
        addAlert(
          'no-signal',
          'critical',
          `${t.boatLabel} has sent no position since leaving ${humanDuration(sinceStart)} ago.`,
          t.id,
          t.boat,
        )
      }
    } else if (age > NO_SIGNAL_MIN) {
      addAlert(
        'no-signal',
        age > NO_SIGNAL_MIN * 3 ? 'critical' : 'warning',
        `${t.boatLabel} last reported ${humanDuration(age)} ago.`,
        t.id,
        t.boat,
      )
    }

    if (hhmm > sunset) {
      addAlert(
        'after-dark',
        'warning',
        `${t.boatLabel} is still at sea after sunset (${sunset}).`,
        t.id,
        t.boat,
      )
    }

    if (!t.captainName) {
      addAlert(
        'no-captain',
        'info',
        `${t.boatLabel} is out with no captain recorded.`,
        t.id,
        t.boat,
      )
    }
  }

  // Licence expiry, so it is noticed before a boat is stopped, not after.
  for (const c of capRows) {
    if (!c.active || !c.licenceExpiry) continue
    const exp = String(c.licenceExpiry).slice(0, 10)
    const days = Math.round(
      (Date.parse(`${exp}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) /
        86400000,
    )
    if (days <= 30) {
      addAlert(
        `licence:${c.id}`,
        days < 0 ? 'critical' : 'warning',
        days < 0
          ? `${c.name}'s licence expired on ${exp}.`
          : `${c.name}'s licence expires in ${days} day${days === 1 ? '' : 's'} (${exp}).`,
        null,
        c.id,
      )
    }
  }

  // Overdue servicing belongs on the Command Center for the same reason an
  // expiring licence does: nobody opens the Maintenance page to find out there
  // is a problem, they open it once they already know. Wrapped in try/catch so
  // a fault in the maintenance query can never take down the fleet view.
  try {
    for (const m of await getMaintenanceAlerts()) {
      addAlert(
        `maintenance:${m.id}`,
        m.state === 'overdue' ? 'critical' : 'warning',
        `${m.boatLabel} — ${m.label}: ${m.summary.toLowerCase()}.`,
        null,
        m.boat,
      )
    }
  } catch {
    // Deliberately silent: the maintenance page reports its own errors.
  }

  // Low fuel stock belongs here too — the office reorders from what they see on
  // the Command Center, not by opening the Fuel page on a hunch. Same try/catch
  // so a fault in the fuel query can never take down the fleet view. Keyed to a
  // boat of null (a whole-operation concern), so it acknowledges independently.
  try {
    for (const f of await getFuelAlerts()) {
      addAlert(f.id, f.severity, f.message, null, null)
    }
  } catch {
    // Deliberately silent: the fuel page reports its own errors.
  }

  const severityRank = { critical: 0, warning: 1, info: 2 } as const
  alerts.sort((a, b) => severityRank[a.severity] - severityRank[b.severity])

  // --- Boat cards ----------------------------------------------------------
  const boats: BoatCard[] = BOATS.map((b) => {
    const mine = bookings.filter((r) => r.boat === b.id)
    const todays = mine.find((r) => r.date === today)
    const next = mine.find((r) => r.date > today && r.status === 'confirmed')
    const active = activeTrips.find((t) => t.boat === b.id) ?? null

    // An open trip is proof the boat is out. A booking only ever means
    // "expected to leave" — it is never treated as being at sea.
    let state: BoatCard['state'] = 'at-base'
    if (active) state = 'at-sea'
    else if (
      todays &&
      todays.status === 'confirmed' &&
      /^\d{2}:\d{2}$/.test(todays.departureTime) &&
      hhmm < todays.departureTime
    ) {
      state = 'departing'
    }

    const mineMonth = monthTrips.filter((t) => t.boat === b.id)
    const hours = mineMonth.reduce((sum, t) => {
      if (t.engineHoursStart != null && t.engineHoursEnd != null) {
        return sum + Math.max(0, t.engineHoursEnd - t.engineHoursStart)
      }
      if (t.endedAt) {
        return (
          sum +
          Math.max(
            0,
            (new Date(t.endedAt).getTime() -
              new Date(t.startedAt).getTime()) /
              3600000,
          )
        )
      }
      return sum
    }, 0)

    return {
      id: b.id,
      name: b.name,
      specs: b.specs,
      image: b.image,
      state,
      activeTrip: active,
      today: todays
        ? {
            label: tripLabel(todays.tripType),
            guests: todays.guests,
            departureTime: todays.departureTime,
            guestName: todays.name,
            status: todays.status,
          }
        : null,
      next: next
        ? {
            date: next.date,
            label: tripLabel(next.tripType),
            departureTime: next.departureTime,
          }
        : null,
      hasDevice: devices.some((d) => d.boat === b.id),
      tripsThisMonth: mineMonth.length,
      hoursThisMonth: Math.round(hours * 10) / 10,
    }
  })

  return {
    nowLocal,
    today,
    sunrise,
    sunset,
    base: { lat: LODGE.latitude, lon: LODGE.longitude, label: LODGE.name },
    boats,
    activeTrips,
    alerts,
    transfersToday: txRows.map((t) => ({
      id: t.id,
      reference: t.reference,
      from: t.fromLocation,
      to: t.toLocation,
      time: t.time,
      pax: t.pax,
      boat: boatName(t.boat),
      status: t.status,
    })),
    departuresToday: bookings
      .filter((r) => r.date === today)
      .map((r) => ({
        boat: boatName(r.boat),
        label: tripLabel(r.tripType),
        time: r.departureTime,
        guestName: r.name,
        guests: r.guests,
        status: r.status,
      })),
  }
}

// ---------------------------------------------------------------------------
// Trips
// ---------------------------------------------------------------------------

export type TripRow = {
  id: string
  boat: string
  boatLabel: string
  purpose: string
  purposeLabel: string
  status: string
  captainName: string | null
  guests: number
  guestNames: TripGuest[]
  destination: string | null
  startedAt: string
  startedTime: string
  endedAt: string | null
  endedTime: string
  durationMin: number | null
  distanceNm: number | null
  fuelUsedPct: number | null
  engineHours: number | null
  notes: string | null
  positionCount: number
}

export async function getTrips(limit = 60): Promise<TripRow[]> {
  await requireAdmin()

  const [rows, capRows, counts] = await Promise.all([
    db.select().from(trips).orderBy(desc(trips.startedAt)).limit(limit),
    db.select().from(captains),
    db
      .select({
        tripId: tripPositions.tripId,
        n: sql<number>`count(*)::int`,
      })
      .from(tripPositions)
      .groupBy(tripPositions.tripId),
  ])

  return rows.map((t) => {
    const dur = t.endedAt
      ? Math.round(
          (new Date(t.endedAt).getTime() - new Date(t.startedAt).getTime()) /
            60000,
        )
      : null
    const engine =
      t.engineHoursStart != null && t.engineHoursEnd != null
        ? Math.round((t.engineHoursEnd - t.engineHoursStart) * 10) / 10
        : null
    const fuel =
      t.fuelStartPct != null && t.fuelEndPct != null
        ? t.fuelStartPct - t.fuelEndPct
        : null

    return {
      id: t.id,
      boat: t.boat,
      boatLabel: boatName(t.boat),
      purpose: t.purpose,
      purposeLabel: purposeLabel(t.purpose),
      status: t.status,
      captainName: t.captainId
        ? (capRows.find((c) => c.id === t.captainId)?.name ?? null)
        : null,
      guests: t.guests,
      guestNames: normalizeGuests(t.guestNames),
      destination: t.destination,
      startedAt: new Date(t.startedAt).toISOString(),
      startedTime: lodgeTime(t.startedAt),
      endedAt: t.endedAt ? new Date(t.endedAt).toISOString() : null,
      endedTime: lodgeTime(t.endedAt),
      durationMin: dur,
      distanceNm: t.distanceNm != null ? Math.round(t.distanceNm * 10) / 10 : null,
      fuelUsedPct: fuel,
      engineHours: engine,
      notes: t.notes,
      positionCount: counts.find((c) => c.tripId === t.id)?.n ?? 0,
    }
  })
}

/** Full track of one trip, for drawing the route on the map. */
export async function getTripTrack(
  tripId: string,
): Promise<{ lat: number; lon: number; speedKn: number | null; at: string }[]> {
  await requireAdmin()

  const rows = await db
    .select()
    .from(tripPositions)
    .where(eq(tripPositions.tripId, tripId))
    .orderBy(asc(tripPositions.recordedAt))

  return rows.map((p) => ({
    lat: p.lat,
    lon: p.lon,
    speedKn: p.speedKn,
    at: new Date(p.recordedAt).toISOString(),
  }))
}

/** Office-side trip logging, for a trip nobody started on a phone. */
export async function createTripManually(input: {
  boat: string
  captainId?: string | null
  purpose?: string
  guests?: number
  destination?: string | null
  notes?: string | null
}) {
  await requireAdmin()

  const id = newId('trip')
  await db.insert(trips).values({
    id,
    boat: input.boat,
    captainId: input.captainId || null,
    purpose: input.purpose || 'other',
    guests: input.guests ?? 0,
    destination: input.destination || null,
    notes: input.notes || null,
  })

  revalidatePath('/admin')
  revalidatePath('/admin/trips')
  return { id }
}

/** Close a trip from the office (captain forgot, phone died). */
export async function endTripFromOffice(input: {
  tripId: string
  fuelEndPct?: number | null
  engineHoursEnd?: number | null
  notes?: string | null
}) {
  await requireAdmin()
  await closeTrip(input)
  revalidatePath('/admin')
  revalidatePath('/admin/trips')
  return { ok: true }
}

export async function deleteTrip(tripId: string) {
  await requireAdmin()
  // Positions go with it via ON DELETE CASCADE.
  await db.delete(trips).where(eq(trips.id, tripId))
  revalidatePath('/admin')
  revalidatePath('/admin/trips')
  return { ok: true }
}

/**
 * Sets the guest names for a trip (entered in the office). The guest COUNT is
 * kept in sync with the number of names so the Command Centre card never shows
 * a number that disagrees with the list beneath it.
 */
export async function saveTripGuestNames(
  tripId: string,
  guests: TripGuest[],
) {
  await requireAdmin()
  const clean = guests
    .map((g) => ({
      name: g.name.trim(),
      country: (g.country || '').trim().toLowerCase(),
    }))
    .filter((g) => g.name.length > 0)
  await db
    .update(trips)
    .set({ guestNames: clean, guests: clean.length })
    .where(eq(trips.id, tripId))
  revalidatePath('/admin')
  revalidatePath('/admin/trips')
  return { ok: true }
}

/**
 * Shared close-out. Distance is computed from the stored track, so it is the
 * distance actually covered rather than a guess or a straight line.
 */
async function closeTrip(input: {
  tripId: string
  fuelEndPct?: number | null
  engineHoursEnd?: number | null
  notes?: string | null
}) {
  const track = await db
    .select()
    .from(tripPositions)
    .where(eq(tripPositions.tripId, input.tripId))
    .orderBy(asc(tripPositions.recordedAt))

  const existing = await db
    .select()
    .from(trips)
    .where(eq(trips.id, input.tripId))
    .limit(1)
  if (!existing.length) throw new Error('Trip not found')

  await db
    .update(trips)
    .set({
      status: 'completed',
      endedAt: new Date(),
      fuelEndPct: input.fuelEndPct ?? existing[0].fuelEndPct,
      engineHoursEnd: input.engineHoursEnd ?? existing[0].engineHoursEnd,
      distanceNm: track.length > 1 ? trackDistanceNm(track) : null,
      notes: input.notes ?? existing[0].notes,
    })
    .where(eq(trips.id, input.tripId))
}

// ---------------------------------------------------------------------------
// Captains
// ---------------------------------------------------------------------------

export type CaptainRow = {
  id: string
  name: string
  phone: string | null
  licence: string | null
  licenceExpiry: string | null
  active: boolean
  notes: string | null
  tripCount: number
}

export async function getCaptains(): Promise<CaptainRow[]> {
  await requireAdmin()

  const [rows, counts] = await Promise.all([
    db.select().from(captains).orderBy(asc(captains.name)),
    db
      .select({ captainId: trips.captainId, n: sql<number>`count(*)::int` })
      .from(trips)
      .groupBy(trips.captainId),
  ])

  return rows.map((c) => ({
    id: c.id,
    name: c.name,
    phone: c.phone,
    licence: c.licence,
    licenceExpiry: c.licenceExpiry ? String(c.licenceExpiry).slice(0, 10) : null,
    active: c.active,
    notes: c.notes,
    tripCount: counts.find((x) => x.captainId === c.id)?.n ?? 0,
  }))
}

export async function saveCaptain(input: {
  id?: string
  name: string
  phone?: string | null
  licence?: string | null
  licenceExpiry?: string | null
  active?: boolean
  notes?: string | null
}) {
  await requireAdmin()

  const name = input.name.trim()
  if (!name) throw new Error('Name is required')

  const values = {
    name,
    phone: input.phone || null,
    licence: input.licence || null,
    licenceExpiry: input.licenceExpiry || null,
    active: input.active ?? true,
    notes: input.notes || null,
  }

  if (input.id) {
    await db.update(captains).set(values).where(eq(captains.id, input.id))
  } else {
    await db.insert(captains).values({ id: newId('cap'), ...values })
  }

  revalidatePath('/admin')
  revalidatePath('/admin/fleet')
  return { ok: true }
}

export async function deleteCaptain(id: string) {
  await requireAdmin()

  // Trips keep their history: the FK is ON DELETE NO ACTION, so a captain who
  // has sailed cannot be deleted. Deactivating is the right move there, and
  // saying so is better than a raw database error.
  const used = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(trips)
    .where(eq(trips.captainId, id))

  if ((used[0]?.n ?? 0) > 0) {
    await db.update(captains).set({ active: false }).where(eq(captains.id, id))
    revalidatePath('/admin/fleet')
    return { ok: true, deactivated: true }
  }

  await db.delete(captains).where(eq(captains.id, id))
  revalidatePath('/admin/fleet')
  return { ok: true, deactivated: false }
}

// ---------------------------------------------------------------------------
// Devices (what is allowed to report a position)
// ---------------------------------------------------------------------------

export type DeviceRow = {
  id: string
  boat: string
  boatLabel: string
  label: string | null
  token: string
  source: string
  lastSeenAt: string | null
  active: boolean
}

export async function getFleetDevices(): Promise<DeviceRow[]> {
  await requireAdmin()

  const rows = await db
    .select()
    .from(fleetDevices)
    .orderBy(asc(fleetDevices.boat), desc(fleetDevices.createdAt))

  return rows.map((d) => ({
    id: d.id,
    boat: d.boat,
    boatLabel: boatName(d.boat),
    label: d.label,
    token: d.token,
    source: d.source,
    lastSeenAt: d.lastSeenAt ? new Date(d.lastSeenAt).toISOString() : null,
    active: d.active,
  }))
}

export async function createFleetDevice(input: {
  boat: string
  label?: string | null
  source?: 'phone' | 'tracker'
}) {
  await requireAdmin()

  // crypto.randomUUID is available in the Node runtime and gives a token that
  // cannot be guessed — the whole point of having one.
  const token = `${input.boat}-${crypto.randomUUID().replace(/-/g, '')}`
  const id = newId('dev')

  await db.insert(fleetDevices).values({
    id,
    boat: input.boat,
    token,
    label: input.label || null,
    source: input.source || 'phone',
  })

  // The devices card lives on /admin/trips, not /admin/fleet — revalidating
  // the map page refreshed a screen that never lists devices.
  revalidatePath('/admin/trips')
  return { id, token }
}

export async function revokeFleetDevice(id: string) {
  await requireAdmin()
  // Kept, not deleted: the row records which device sent past positions.
  await db.update(fleetDevices).set({ active: false }).where(eq(fleetDevices.id, id))
  revalidatePath('/admin/trips')
  return { ok: true }
}

// ---------------------------------------------------------------------------
// Alerts
// ---------------------------------------------------------------------------

export async function acknowledgeAlert(input: {
  kind: string
  message: string
  boat?: string | null
  tripId?: string | null
  by?: string
}) {
  await requireAdmin()

  await db.insert(fleetAlerts).values({
    id: newId('alert'),
    kind: input.kind,
    boat: input.boat || null,
    tripId: input.tripId || null,
    message: input.message,
    acknowledgedAt: new Date(),
    acknowledgedBy: input.by || 'office',
  })

  revalidatePath('/admin')
  return { ok: true }
}

// ---------------------------------------------------------------------------
// Captain Mode — token-authorised, no admin session
// ---------------------------------------------------------------------------

export type CaptainBoard = {
  boat: BoatId
  boatName: string
  captains: { id: string; name: string }[]
  activeTrip: {
    id: string
    purpose: string
    startedTime: string
    guests: number
    captainId: string | null
    destination: string | null
    positionCount: number
    lastFixAgeMin: number | null
  } | null
  /** Today's booking, so the captain does not retype what the office knows. */
  todayBooking: {
    id: number
    label: string
    guests: number
    departureTime: string
    guestName: string
  } | null
  /** Saved fishing spots, so a catch can be tied to one with a single tap. */
  spots: { id: string; name: string }[]
  sunset: string
  nowLocal: string
}

export async function getCaptainBoard(token: string): Promise<CaptainBoard> {
  const boat = await boatForToken(token)
  const { today, nowLocal, instant } = lodgeNow()
  const { sunset } = sunTimes(today)

  const [openTrips, capRows, bookingRows, spotRows] = await Promise.all([
    db
      .select()
      .from(trips)
      .where(and(eq(trips.boat, boat), eq(trips.status, 'active')))
      .orderBy(desc(trips.startedAt))
      .limit(1),
    db
      .select()
      .from(captains)
      .where(eq(captains.active, true))
      .orderBy(asc(captains.name)),
    db
      .select()
      .from(boatBookings)
      .where(
        and(
          eq(boatBookings.boat, boat),
          eq(boatBookings.date, today),
          inArray(boatBookings.status, ['confirmed', 'pending']),
        ),
      )
      .limit(1),
    // Secret spots are included: this screen is the captain's, and hiding our
    // own best marks from the person standing over them would be absurd. The
    // flag only keeps them off guest-facing surfaces.
    db
      .select({ id: fishingSpots.id, name: fishingSpots.name })
      .from(fishingSpots)
      .where(eq(fishingSpots.active, true))
      .orderBy(asc(fishingSpots.name)),
  ])

  const t = openTrips[0] ?? null
  let positionCount = 0
  let lastFixAgeMin: number | null = null

  if (t) {
    const last = await db
      .select()
      .from(tripPositions)
      .where(eq(tripPositions.tripId, t.id))
      .orderBy(desc(tripPositions.recordedAt))
      .limit(1)
    const count = await db
      .select({ n: sql<number>`count(*)::int` })
      .from(tripPositions)
      .where(eq(tripPositions.tripId, t.id))
    positionCount = count[0]?.n ?? 0
    if (last.length) {
      lastFixAgeMin = Math.max(
        0,
        Math.round(
          (instant.getTime() - new Date(last[0].recordedAt).getTime()) / 60000,
        ),
      )
    }
  }

  const b = bookingRows[0] ?? null

  return {
    boat,
    boatName: boatName(boat),
    captains: capRows.map((c) => ({ id: c.id, name: c.name })),
    activeTrip: t
      ? {
          id: t.id,
          purpose: t.purpose,
          startedTime: lodgeTime(t.startedAt),
          guests: t.guests,
          captainId: t.captainId,
          destination: t.destination,
          positionCount,
          lastFixAgeMin,
        }
      : null,
    spots: spotRows,
    todayBooking: b
      ? {
          id: b.id,
          label: tripLabel(b.tripType),
          guests: b.guests,
          departureTime: b.departureTime,
          guestName: b.name,
        }
      : null,
    sunset,
    nowLocal,
  }
}

export async function startTripAsCaptain(
  token: string,
  input: {
    captainId?: string | null
    purpose?: string
    guests?: number
    destination?: string | null
    fuelStartPct?: number | null
    engineHoursStart?: number | null
    bookingId?: string | null
    notes?: string | null
  },
) {
  const boat = await boatForToken(token)

  // One open trip per boat. Without this a double tap on a laggy connection
  // would leave two trips open and the map would not know which is real.
  const open = await db
    .select()
    .from(trips)
    .where(and(eq(trips.boat, boat), eq(trips.status, 'active')))
    .limit(1)
  if (open.length) return { id: open[0].id, alreadyOpen: true }

  const id = newId('trip')
  await db.insert(trips).values({
    id,
    boat,
    captainId: input.captainId || null,
    purpose: input.purpose || 'excursion',
    guests: input.guests ?? 0,
    destination: input.destination || null,
    fuelStartPct: input.fuelStartPct ?? null,
    engineHoursStart: input.engineHoursStart ?? null,
    bookingId: input.bookingId || null,
    notes: input.notes || null,
  })

  revalidatePath('/admin')
  revalidatePath('/admin/trips')
  return { id, alreadyOpen: false }
}

export async function endTripAsCaptain(
  token: string,
  input: {
    tripId: string
    fuelEndPct?: number | null
    engineHoursEnd?: number | null
    notes?: string | null
  },
) {
  const boat = await boatForToken(token)

  // The token is per boat, so a captain can only close their own boat's trip.
  const owned = await db
    .select()
    .from(trips)
    .where(and(eq(trips.id, input.tripId), eq(trips.boat, boat)))
    .limit(1)
  if (!owned.length) throw new Error('Trip not found for this boat')

  await closeTrip(input)

  revalidatePath('/admin')
  revalidatePath('/admin/trips')
  return { ok: true }
}

/**
 * Positions from the captain's phone.
 *
 * Also exposed as POST /api/fleet/position, which is what the phone actually
 * uses: navigator.sendBeacon keeps sending during a page unload or a screen
 * lock, which a server action cannot do.
 */
export async function pushPositions(
  token: string,
  points: {
    lat: number
    lon: number
    speedKn?: number | null
    headingDeg?: number | null
    accuracyM?: number | null
    recordedAt?: string
  }[],
) {
  const boat = await boatForToken(token)

  const open = await db
    .select()
    .from(trips)
    .where(and(eq(trips.boat, boat), eq(trips.status, 'active')))
    .orderBy(desc(trips.startedAt))
    .limit(1)

  // No open trip means nothing to attach a position to. Not an error: the
  // phone may still be sending a buffered batch after the trip was closed.
  if (!open.length) return { stored: 0, reason: 'no-active-trip' as const }

  const rows = points
    .filter(
      (p) =>
        Number.isFinite(p.lat) &&
        Number.isFinite(p.lon) &&
        Math.abs(p.lat) <= 90 &&
        Math.abs(p.lon) <= 180,
    )
    .map((p) => ({
      id: newId('pos'),
      tripId: open[0].id,
      lat: p.lat,
      lon: p.lon,
      speedKn: p.speedKn ?? null,
      headingDeg: p.headingDeg ?? null,
      accuracyM: p.accuracyM ?? null,
      source: 'phone',
      // Trust the sender's time: a buffered fix must keep the moment it was
      // taken, not the moment the network came back.
      recordedAt: p.recordedAt ? new Date(p.recordedAt) : new Date(),
    }))

  if (!rows.length) return { stored: 0, reason: 'no-valid-points' as const }

  await db.insert(tripPositions).values(rows)
  await db
    .update(fleetDevices)
    .set({ lastSeenAt: new Date() })
    .where(eq(fleetDevices.token, token.trim()))

  return { stored: rows.length, reason: 'ok' as const }
}
