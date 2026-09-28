'use server'

import { put } from '@vercel/blob'
import { and, desc, eq, sql } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'

import { isAdmin } from '@/lib/admin-auth'
import { boatName } from '@/lib/boats'
import { db } from '@/lib/db'
import { catches, fishingSpots, fleetDevices, trips } from '@/lib/db/schema'
import { MIN_CONFIDENT_CATCHES } from '@/lib/fishing'

import { getWeather } from './vreme'

// ---------------------------------------------------------------------------
// Auth
//
// Two doors into the same tables, on purpose. The office is behind the admin
// code; the captain has no login at sea and is identified by the boat's device
// token — the same token the position endpoint already trusts.

async function boatForToken(token: string) {
  const clean = (token || '').trim()
  if (!clean) throw new Error('Missing device token')
  const rows = await db
    .select()
    .from(fleetDevices)
    .where(and(eq(fleetDevices.token, clean), eq(fleetDevices.active, true)))
    .limit(1)
  if (!rows.length) throw new Error('Unknown or revoked device')
  return rows[0].boat
}

async function assertAdmin() {
  if (!(await isAdmin())) throw new Error('Not authorised')
}

function newId(prefix: string) {
  return `${prefix}-${Date.now()}-${crypto.randomUUID().slice(0, 12)}`
}

// ---------------------------------------------------------------------------
// Types

export type SpotRow = {
  id: string
  name: string
  lat: number
  lon: number
  kind: string
  depthM: number | null
  notes: string | null
  secret: boolean
  active: boolean
  /** Aggregates over all catches ever logged here. */
  catchCount: number
  keptCount: number
  releasedCount: number
  bestKg: number | null
  lastCatchAt: string | null
  topSpecies: string | null
}

export type CatchRow = {
  id: string
  tripId: string
  boat: string
  boatLabel: string
  spotId: string | null
  spotName: string | null
  lat: number | null
  lon: number | null
  species: string
  weightKg: number | null
  lengthCm: number | null
  released: boolean
  guestName: string | null
  method: string | null
  lure: string | null
  notes: string | null
  photoUrl: string | null
  caughtAt: string
  caughtAtLabel: string
  // Conditions as they were at the moment of the catch.
  tideM: number | null
  tidePhase: string | null
  windKmh: number | null
  gustsKmh: number | null
  pressureHpa: number | null
  sstC: number | null
  moonPhase: string | null
}

/** What a spot produces, and in which conditions. */
export type SpotInsight = {
  spotId: string
  spotName: string
  catchCount: number
  species: { name: string; n: number }[]
  /** Share of catches on a rising tide, 0-1. Null when tide was never captured. */
  risingShare: number | null
  avgSstC: number | null
  avgPressureHpa: number | null
  avgGustsKmh: number | null
  bestHours: { hour: number; n: number }[]
  /**
   * False until the spot has enough catches for a pattern to mean anything.
   * A single fish makes risingShare exactly 1.0, which reads as "this spot
   * always produces on a rising tide" — a confident claim from one data point
   * that could send a boat two hours the wrong way. The UI must present
   * everything below the threshold as a tally, not a finding.
   */
  confident: boolean
}



// ---------------------------------------------------------------------------
// Conditions snapshot
//
// The whole value of this feature. The weather source only serves a forecast
// window, so what the tide, pressure and sea temperature were at 14:32 last
// March cannot be recovered later at any price. We therefore write them at the
// moment the fish is logged.
//
// It NEVER throws and never blocks the entry: a captain with one hand on a rod
// must be able to log a fish whether or not a weather API answers. Missing
// conditions cost us one row of analysis; a failed save costs the catch.

type Conditions = {
  tideM: number | null
  tidePhase: string | null
  windKmh: number | null
  gustsKmh: number | null
  windDir: number | null
  pressureHpa: number | null
  sstC: number | null
  swellM: number | null
  currentKmh: number | null
  moonPhase: string | null
}

const NO_CONDITIONS: Conditions = {
  tideM: null,
  tidePhase: null,
  windKmh: null,
  gustsKmh: null,
  windDir: null,
  pressureHpa: null,
  sstC: null,
  swellM: null,
  currentKmh: null,
  moonPhase: null,
}

// Lodge-local minute string ("YYYY-MM-DDTHH:MM") for an instant. Madagascar is
// a fixed UTC+3 with no daylight saving, and this matches how the weather model
// reports its own `nowLocal`, so the two line up without a timezone library.
function toLodgeLocalMinute(at: Date): string {
  return new Date(at.getTime() + 3 * 3600_000).toISOString().slice(0, 16)
}

/**
 * Conditions to store against a catch.
 *
 * `at` is the whole reason this takes an argument. An offline catch is uploaded
 * when the boat finds signal — often hours after the fish was landed — and if
 * we snapshotted "now" every offline catch would carry the conditions at the
 * dock, not on the water. The weather model's hourly array covers earlier hours
 * of the same day, so we read the hour the fish was actually caught. Once that
 * day rolls out of the forecast window the past hour is gone for good (the whole
 * premise of this data), so we fall back to nulls rather than a wrong "now".
 */
async function snapshotConditions(at?: Date): Promise<Conditions> {
  try {
    const w = await getWeather()

    // For a live catch, the hour the model itself calls "now"; for a replayed
    // offline catch, the hour it was actually landed. Never new Date(), which
    // would read the server's timezone rather than the lodge's.
    const localMinute = at ? toLodgeLocalMinute(at) : w.nowLocal.slice(0, 16)
    const hourKey = `${localMinute.slice(0, 13)}:00`
    const hours = w.hours ?? []
    const i = hours.findIndex((h) => h.time === hourKey)
    const hour = i >= 0 ? hours[i] : null

    // Rising or falling is read from the NEXT turn after the catch: if that
    // turn is a high water, the water was on its way up. Comparing two hourly
    // samples would be wrong for the flat hour either side of the turn.
    const nextTurn = (w.tides ?? []).find((t) => t.time > localMinute)

    const sky = (w.sky ?? []).find((d) => d.date === localMinute.slice(0, 10))

    // `w.current` is a live instrument reading and only means anything for a
    // catch happening right now — a replayed one must take everything from the
    // historical hour or it would be stamped with the present.
    const live = !at

    return {
      tideM: hour?.tide ?? null,
      tidePhase: nextTurn ? (nextTurn.kind === 'high' ? 'rising' : 'falling') : null,
      windKmh: (live ? w.current?.wind : null) ?? hour?.wind ?? null,
      gustsKmh: (live ? w.current?.gusts : null) ?? hour?.gusts ?? null,
      windDir: (live ? w.current?.direction : null) ?? hour?.direction ?? null,
      pressureHpa: (live ? w.current?.pressure : null) ?? hour?.pressure ?? null,
      sstC: (live ? w.current?.sst : null) ?? hour?.sst ?? null,
      swellM: (live ? w.current?.swell : null) ?? hour?.swell ?? null,
      currentKmh: (live ? w.current?.currentVel : null) ?? hour?.currentVel ?? null,
      moonPhase: sky?.moonLabel ?? null,
    }
  } catch {
    // Deliberately silent. See the note above: no weather must never mean no
    // catch record.
    return NO_CONDITIONS
  }
}

// ---------------------------------------------------------------------------
// Spots

export async function listSpots(): Promise<SpotRow[]> {
  const spots = await db
    .select()
    .from(fishingSpots)
    .where(eq(fishingSpots.active, true))
    .orderBy(fishingSpots.name)

  if (!spots.length) return []

  // One grouped pass rather than a query per spot: this list is read on every
  // page load and the per-spot version would grow with the catalogue.
  const stats = await db
    .select({
      spotId: catches.spotId,
      n: sql<number>`count(*)::int`,
      kept: sql<number>`count(*) filter (where released = false)::int`,
      released: sql<number>`count(*) filter (where released = true)::int`,
      best: sql<number | null>`max("weightKg")`,
      last: sql<string | null>`max("caughtAt")`,
    })
    .from(catches)
    .groupBy(catches.spotId)

  // Most-caught species per spot, decided in the database so ties break the
  // same way every time.
  const top = await db
    .select({
      spotId: catches.spotId,
      species: catches.species,
      n: sql<number>`count(*)::int`,
    })
    .from(catches)
    .groupBy(catches.spotId, catches.species)

  const bySpot = new Map(stats.map((s) => [s.spotId, s]))
  const topBySpot = new Map<string, { species: string; n: number }>()
  for (const r of top) {
    if (!r.spotId) continue
    const cur = topBySpot.get(r.spotId)
    if (!cur || r.n > cur.n) topBySpot.set(r.spotId, { species: r.species, n: r.n })
  }

  return spots.map((s) => {
    const st = bySpot.get(s.id)
    return {
      id: s.id,
      name: s.name,
      lat: s.lat,
      lon: s.lon,
      kind: s.kind,
      depthM: s.depthM,
      notes: s.notes,
      secret: s.secret,
      active: s.active,
      catchCount: st?.n ?? 0,
      keptCount: st?.kept ?? 0,
      releasedCount: st?.released ?? 0,
      bestKg: st?.best ?? null,
      lastCatchAt: st?.last ? new Date(st.last).toISOString() : null,
      topSpecies: topBySpot.get(s.id)?.species ?? null,
    }
  })
}

export async function createSpot(input: {
  name: string
  lat: number
  lon: number
  kind?: string
  depthM?: number | null
  notes?: string | null
  secret?: boolean
  createdBy?: string | null
}) {
  await assertAdmin()

  const name = (input.name || '').trim()
  if (!name) throw new Error('Spot needs a name')
  // A spot with no position is not a spot. Guarding here rather than trusting
  // the form keeps a bad row out of the map for good.
  if (!Number.isFinite(input.lat) || !Number.isFinite(input.lon)) {
    throw new Error('Spot needs a position')
  }

  const id = newId('spot')
  await db.insert(fishingSpots).values({
    id,
    name,
    lat: input.lat,
    lon: input.lon,
    kind: input.kind || 'reef',
    depthM: input.depthM ?? null,
    notes: input.notes || null,
    secret: input.secret ?? false,
    createdBy: input.createdBy || null,
  })

  revalidatePath('/admin/fishing')
  return { id }
}

/** Saved from Captain Mode, where the position comes from the phone's GPS. */
export async function createSpotAsCaptain(
  token: string,
  input: { name: string; lat: number; lon: number; kind?: string; notes?: string | null },
) {
  await boatForToken(token)

  const name = (input.name || '').trim()
  if (!name) throw new Error('Spot needs a name')
  if (!Number.isFinite(input.lat) || !Number.isFinite(input.lon)) {
    throw new Error('Spot needs a position')
  }

  const id = newId('spot')
  await db.insert(fishingSpots).values({
    id,
    name,
    lat: input.lat,
    lon: input.lon,
    kind: input.kind || 'reef',
    notes: input.notes || null,
    createdBy: 'captain',
  })

  revalidatePath('/admin/fishing')
  return { id }
}

export async function updateSpot(
  id: string,
  patch: {
    name?: string
    kind?: string
    depthM?: number | null
    notes?: string | null
    secret?: boolean
  },
) {
  await assertAdmin()
  await db
    .update(fishingSpots)
    .set({
      ...(patch.name !== undefined ? { name: patch.name.trim() } : {}),
      ...(patch.kind !== undefined ? { kind: patch.kind } : {}),
      ...(patch.depthM !== undefined ? { depthM: patch.depthM } : {}),
      ...(patch.notes !== undefined ? { notes: patch.notes || null } : {}),
      ...(patch.secret !== undefined ? { secret: patch.secret } : {}),
    })
    .where(eq(fishingSpots.id, id))

  revalidatePath('/admin/fishing')
  return { ok: true }
}

/**
 * Archive, not delete. Catches reference the spot, and years of history is
 * exactly what makes a spot worth anything — losing it to a stray tap would be
 * unrecoverable.
 */
export async function archiveSpot(id: string) {
  await assertAdmin()
  await db.update(fishingSpots).set({ active: false }).where(eq(fishingSpots.id, id))
  revalidatePath('/admin/fishing')
  return { ok: true }
}

// ---------------------------------------------------------------------------
// Catches

export type CatchInput = {
  species: string
  spotId?: string | null
  lat?: number | null
  lon?: number | null
  weightKg?: number | null
  lengthCm?: number | null
  released?: boolean
  guestName?: string | null
  method?: string | null
  lure?: string | null
  notes?: string | null
  /** ISO, set by the phone so an offline entry keeps the real time. */
  caughtAt?: string | null
  /** UUID minted on the phone; the idempotency key for the offline queue. */
  clientId?: string | null
}

// Which trip a catch belongs to. Normally the one trip open for the boat — but
// an offline catch can arrive after the trip was already closed at the dock, so
// we match by the moment it was landed and only fall back to "currently open".
// Asking the captain to pick a trip would be a question he cannot get wrong but
// also cannot answer with a fish on the line.
async function tripForCatch(boat: string, caughtAt: Date): Promise<string | null> {
  const spanning = await db
    .select({ id: trips.id })
    .from(trips)
    .where(
      and(
        eq(trips.boat, boat),
        sql`${trips.startedAt} <= ${caughtAt}`,
        sql`(${trips.endedAt} IS NULL OR ${caughtAt} <= ${trips.endedAt})`,
      ),
    )
    .orderBy(desc(trips.startedAt))
    .limit(1)
  if (spanning.length) return spanning[0].id

  const open = await db
    .select({ id: trips.id })
    .from(trips)
    .where(and(eq(trips.boat, boat), eq(trips.status, 'active')))
    .orderBy(desc(trips.startedAt))
    .limit(1)
  return open.length ? open[0].id : null
}

async function insertOneCatch(boat: string, input: CatchInput) {
  const species = (input.species || '').trim()
  if (!species) throw new Error('Which fish?')

  const caughtAt = input.caughtAt ? new Date(input.caughtAt) : new Date()
  const tripId = await tripForCatch(boat, caughtAt)
  if (!tripId) throw new Error('No trip is running — start the trip first')

  // Dedup by clientId before inserting. A retried flush over a weak signal
  // must land as a no-op, not a second fish. This is done with an explicit
  // check rather than ON CONFLICT because the unique index is PARTIAL
  // (clientId IS NOT NULL): Drizzle's onConflictDoNothing does not emit the
  // matching WHERE predicate, so Postgres cannot use the partial index as the
  // arbiter and the insert throws instead of deduping. The partial unique index
  // still stands as the hard backstop against a genuine race.
  if (input.clientId) {
    const existing = await db
      .select({ id: catches.id })
      .from(catches)
      .where(eq(catches.clientId, input.clientId))
      .limit(1)
    if (existing.length) return
  }

  const cond = await snapshotConditions(input.caughtAt ? caughtAt : undefined)

  await db.insert(catches).values({
    id: newId('catch'),
    tripId,
    spotId: input.spotId || null,
    lat: input.lat ?? null,
    lon: input.lon ?? null,
    species,
    weightKg: input.weightKg ?? null,
    lengthCm: input.lengthCm ?? null,
    released: input.released ?? false,
    guestName: input.guestName || null,
    method: input.method || null,
    lure: input.lure || null,
    notes: input.notes || null,
    caughtAt,
    clientId: input.clientId || null,
    ...cond,
  })
}

export async function logCatchAsCaptain(token: string, input: CatchInput) {
  const boat = await boatForToken(token)
  await insertOneCatch(boat, input)
  revalidatePath('/admin/fishing')
  revalidatePath('/admin/trips')
  return { ok: true }
}

/**
 * Replay a batch of catches held on the phone while offline. Returns the client
 * ids that are now safely stored — including any that were already there from a
 * previous partial flush — so the phone can drop exactly those from its queue
 * and retry only the ones that genuinely failed. One bad row (e.g. its trip was
 * deleted) must not block the rest, so each is attempted independently.
 */
export async function logCatchesBatch(
  token: string,
  items: CatchInput[],
): Promise<{ saved: string[]; failed: { clientId: string; error: string }[] }> {
  const boat = await boatForToken(token)
  const saved: string[] = []
  const failed: { clientId: string; error: string }[] = []

  for (const item of items) {
    const cid = item.clientId
    if (!cid) continue // no id, no dedup — skip rather than risk a duplicate
    try {
      await insertOneCatch(boat, item)
      saved.push(cid)
    } catch (e) {
      failed.push({ clientId: cid, error: e instanceof Error ? e.message : 'Failed' })
    }
  }

  if (saved.length) {
    revalidatePath('/admin/fishing')
    revalidatePath('/admin/trips')
  }
  return { saved, failed }
}

/**
 * Attach a photo to a catch the phone already logged, matched by clientId.
 *
 * clientId, not the database id, is the key on purpose: the phone always knows
 * the clientId it minted — even for a fish still sitting in the offline queue —
 * whereas the database id only comes back after the catch has synced. Matching
 * on clientId means "photograph this fish" works the same whether the catch is
 * already on the server or was logged offline moments ago, and re-sending the
 * same photo simply overwrites, so a retry over a weak signal is harmless.
 *
 * The image is uploaded through the boat token, not isAdmin(): the captain has
 * no admin session, only the device token, so uploadImage() cannot be reused.
 */
export async function attachCatchPhoto(
  token: string,
  clientId: string,
  dataUrl: string,
): Promise<{ ok: true; url: string }> {
  const boat = await boatForToken(token)

  const row = await db
    .select({ id: catches.id, tripId: catches.tripId })
    .from(catches)
    .where(eq(catches.clientId, clientId))
    .limit(1)
  if (!row.length) throw new Error('That catch has not synced yet')

  // Confirm the catch belongs to this boat before spending an upload on it —
  // the token proves which boat, and a catch is only reachable through its trip.
  const trip = await db
    .select({ boat: trips.boat })
    .from(trips)
    .where(eq(trips.id, row[0].tripId))
    .limit(1)
  if (!trip.length || trip[0].boat !== boat) {
    throw new Error('That catch is not on this boat')
  }

  // The phone sends a compressed JPEG data URL; turn it back into bytes for Blob.
  const match = /^data:(image\/[a-z+]+);base64,(.+)$/i.exec(dataUrl)
  if (!match) throw new Error('Not an image')
  const buffer = Buffer.from(match[2], 'base64')
  // Guard the size server-side too: the client compresses, but a crafted request
  // must not push a huge blob. 6 MB is generous for a single 1600px JPEG.
  if (buffer.length > 6_000_000) throw new Error('Photo too large')

  const blob = await put(`aam/catch/${clientId}.jpg`, buffer, {
    access: 'public',
    contentType: match[1],
    // Same key per catch, so a re-upload replaces rather than piles up.
    addRandomSuffix: false,
    allowOverwrite: true,
  })

  await db
    .update(catches)
    .set({ photoUrl: blob.url })
    .where(eq(catches.id, row[0].id))

  revalidatePath('/admin/fishing')
  return { ok: true, url: blob.url }
}

/** Office entry, for fish reported after the boat is back. */
export async function logCatch(input: {
  tripId: string
  species: string
  spotId?: string | null
  weightKg?: number | null
  lengthCm?: number | null
  released?: boolean
  guestName?: string | null
  method?: string | null
  notes?: string | null
  caughtAt?: string | null
}) {
  await assertAdmin()

  const species = (input.species || '').trim()
  if (!species) throw new Error('Which fish?')
  if (!input.tripId) throw new Error('Which trip?')

  // Only snapshot live conditions when the catch is being logged as it happens.
  // For a fish entered days later the current weather is not its weather, and a
  // wrong number is worse than an empty column — it would poison the analysis.
  const sameHour =
    !input.caughtAt || Date.now() - Date.parse(input.caughtAt) < 60 * 60 * 1000
  const cond = sameHour ? await snapshotConditions() : NO_CONDITIONS

  const id = newId('catch')
  await db.insert(catches).values({
    id,
    tripId: input.tripId,
    spotId: input.spotId || null,
    species,
    weightKg: input.weightKg ?? null,
    lengthCm: input.lengthCm ?? null,
    released: input.released ?? false,
    guestName: input.guestName || null,
    method: input.method || null,
    notes: input.notes || null,
    caughtAt: input.caughtAt ? new Date(input.caughtAt) : new Date(),
    ...cond,
  })

  revalidatePath('/admin/fishing')
  revalidatePath('/admin/trips')
  return { id }
}

export async function deleteCatch(id: string) {
  await assertAdmin()
  await db.delete(catches).where(eq(catches.id, id))
  revalidatePath('/admin/fishing')
  return { ok: true }
}

export async function listCatches(limit = 100): Promise<CatchRow[]> {
  const rows = await db
    .select({
      c: catches,
      boat: trips.boat,
      spotName: fishingSpots.name,
    })
    .from(catches)
    .innerJoin(trips, eq(catches.tripId, trips.id))
    .leftJoin(fishingSpots, eq(catches.spotId, fishingSpots.id))
    .orderBy(desc(catches.caughtAt))
    .limit(limit)

  return rows.map(({ c, boat, spotName }) => ({
    id: c.id,
    tripId: c.tripId,
    boat,
    boatLabel: boatName(boat as Parameters<typeof boatName>[0]),
    spotId: c.spotId,
    spotName: spotName ?? null,
    lat: c.lat,
    lon: c.lon,
    species: c.species,
    weightKg: c.weightKg,
    lengthCm: c.lengthCm,
    released: c.released,
    guestName: c.guestName,
    method: c.method,
    lure: c.lure,
    notes: c.notes,
    photoUrl: c.photoUrl,
    caughtAt: c.caughtAt.toISOString(),
    // Date AND time: `lodgeTime` alone gives "14:32", which is useless in a log
    // that spans seasons. Lodge timezone, so the hour matches what the captain
    // remembers.
    caughtAtLabel: c.caughtAt.toLocaleString('en-GB', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
      timeZone: 'Indian/Antananarivo',
    }),
    tideM: c.tideM,
    tidePhase: c.tidePhase,
    windKmh: c.windKmh,
    gustsKmh: c.gustsKmh,
    pressureHpa: c.pressureHpa,
    sstC: c.sstC,
    moonPhase: c.moonPhase,
  }))
}

/**
 * What each spot produces, and in what conditions. This is the question the
 * whole feature exists to answer, and it only becomes trustworthy with
 * seasons of data — so the UI states the sample size next to every figure.
 */
export async function getSpotInsights(): Promise<SpotInsight[]> {
  const rows = await db
    .select({
      spotId: catches.spotId,
      spotName: fishingSpots.name,
      species: catches.species,
      tidePhase: catches.tidePhase,
      sstC: catches.sstC,
      pressureHpa: catches.pressureHpa,
      gustsKmh: catches.gustsKmh,
      caughtAt: catches.caughtAt,
    })
    .from(catches)
    .innerJoin(fishingSpots, eq(catches.spotId, fishingSpots.id))

  const bySpot = new Map<string, typeof rows>()
  for (const r of rows) {
    if (!r.spotId) continue
    const list = bySpot.get(r.spotId) ?? []
    list.push(r)
    bySpot.set(r.spotId, list)
  }

  const avg = (vals: (number | null)[]) => {
    const nums = vals.filter((v): v is number => v != null)
    return nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : null
  }

  const out: SpotInsight[] = []
  for (const [spotId, list] of bySpot) {
    const speciesCount = new Map<string, number>()
    const hourCount = new Map<number, number>()
    for (const r of list) {
      speciesCount.set(r.species, (speciesCount.get(r.species) ?? 0) + 1)
      // Hour of day in the lodge's timezone, not the server's — the whole point
      // is which hour of the local day fishes well.
      const h = Number(
        r.caughtAt.toLocaleString('en-GB', {
          hour: '2-digit',
          hour12: false,
          timeZone: 'Indian/Antananarivo',
        }),
      )
      if (Number.isFinite(h)) hourCount.set(h, (hourCount.get(h) ?? 0) + 1)
    }

    const withTide = list.filter((r) => r.tidePhase)
    out.push({
      spotId,
      spotName: list[0].spotName,
      catchCount: list.length,
      species: [...speciesCount.entries()]
        .map(([name, n]) => ({ name, n }))
        .sort((a, b) => b.n - a.n),
      risingShare: withTide.length
        ? withTide.filter((r) => r.tidePhase === 'rising').length / withTide.length
        : null,
      avgSstC: avg(list.map((r) => r.sstC)),
      avgPressureHpa: avg(list.map((r) => r.pressureHpa)),
      avgGustsKmh: avg(list.map((r) => r.gustsKmh)),
      bestHours: [...hourCount.entries()]
        .map(([hour, n]) => ({ hour, n }))
        .sort((a, b) => b.n - a.n)
        .slice(0, 3),
      confident: list.length >= MIN_CONFIDENT_CATCHES,
    })
  }

  return out.sort((a, b) => b.catchCount - a.catchCount)
}
