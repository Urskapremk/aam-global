'use server'

import { and, desc, eq, isNotNull, isNull } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'

import { isAdmin } from '@/lib/admin-auth'
import { BOATS, boatName, boatEngineSlots, type EngineSlot } from '@/lib/boats'
import { db } from '@/lib/db'
import {
  boatFuelReadings,
  fuelConfig,
  fuelLog,
  fuelProcurements,
  fxConfig,
} from '@/lib/db/schema'

async function assertAdmin() {
  if (!(await isAdmin())) throw new Error('Not authorised')
}

const newId = (p: string) =>
  `${p}-${Date.now()}-${Math.random().toString(16).slice(2, 14)}`

// Madagascar is a fixed UTC+3 with no DST, so a lodge-local month is just the
// stored instant shifted +3h — the same convention the rest of the app uses.
const LODGE_OFFSET_MS = 3 * 60 * 60 * 1000
const lodgeMonthKey = (d: Date) =>
  new Date(d.getTime() + LODGE_OFFSET_MS).toISOString().slice(0, 7)

// --- Informational currency conversion ---------------------------------
//
// Ariary is the only currency we store and bill in. EUR and ZAR are shown
// purely as a reference so the owner can gauge the size of a cost. Rates
// float, so we pull live values daily from a free, key-less source and fall
// back to a rough approximation if it is unavailable.
export type FxRates = {
  // The effective rate every calculation and hint uses. Live when fetched,
  // otherwise the manually-entered fallback below.
  arPerEur: number
  arPerZar: number
  live: boolean // true when fetched, false when the manual fallback is used
  // The manually-entered fallback as stored in fx_config, surfaced so the
  // exchange screen can show and edit it even while the live rate is in use.
  manualArPerEur: number
  manualArPerZar: number
  manualUpdatedAt: string | null
}

// Hard-coded last resort, only used if the fx_config row is somehow missing.
const FX_HARD_FALLBACK = { arPerEur: 4800, arPerZar: 250 }

// Reads the manually-entered fallback rate from fx_config (single row id=1).
async function getManualFx(): Promise<{
  arPerEur: number
  arPerZar: number
  updatedAt: string | null
}> {
  try {
    const rows = await db
      .select()
      .from(fxConfig)
      .where(eq(fxConfig.id, 1))
      .limit(1)
    if (rows.length) {
      return {
        arPerEur: rows[0].arPerEur,
        arPerZar: rows[0].arPerZar,
        updatedAt: rows[0].updatedAt.toISOString(),
      }
    }
  } catch {
    // fall through to the hard fallback
  }
  return { ...FX_HARD_FALLBACK, updatedAt: null }
}

export async function getFxRates(): Promise<FxRates> {
  const manual = await getManualFx()
  const base: FxRates = {
    arPerEur: manual.arPerEur,
    arPerZar: manual.arPerZar,
    live: false,
    manualArPerEur: manual.arPerEur,
    manualArPerZar: manual.arPerZar,
    manualUpdatedAt: manual.updatedAt,
  }
  try {
    // open.er-api.com is free and needs no API key. Base EUR gives us Ariary
    // (MGA) and Rand (ZAR) per 1 EUR in one call.
    const res = await fetch('https://open.er-api.com/v6/latest/EUR', {
      next: { revalidate: 60 * 60 * 12 }, // refresh twice a day
      signal: AbortSignal.timeout(8000),
    })
    if (!res.ok) return base
    const json = (await res.json()) as {
      result?: string
      rates?: Record<string, number>
    }
    const mga = json.rates?.MGA
    const zar = json.rates?.ZAR
    if (json.result !== 'success' || !mga || !zar || mga <= 0 || zar <= 0) {
      return base
    }
    // Live rate wins; the manual fields are kept for reference/editing.
    return {
      ...base,
      arPerEur: mga, // 1 EUR = mga Ar
      arPerZar: mga / zar, // 1 ZAR = (mga/zar) Ar
      live: true,
    }
  } catch {
    return base
  }
}

// Persists the manually-entered fallback rate (Ar per 1 EUR / per 1 ZAR).
export async function setManualFxRates(
  arPerEur: number,
  arPerZar: number,
): Promise<void> {
  await assertAdmin()
  const eur = Math.max(0, Number(arPerEur) || 0)
  const zar = Math.max(0, Number(arPerZar) || 0)
  if (eur <= 0 || zar <= 0) throw new Error('Rates must be greater than zero')
  await db
    .insert(fxConfig)
    .values({ id: 1, arPerEur: eur, arPerZar: zar, updatedAt: new Date() })
    .onConflictDoUpdate({
      target: fxConfig.id,
      set: { arPerEur: eur, arPerZar: zar, updatedAt: new Date() },
    })
  revalidatePath('/admin/exchange')
  revalidatePath('/admin/fuel')
  revalidatePath('/admin')
}

export type FuelEntryType = 'delivery' | 'refuel' | 'adjustment'

// How a refuel amount was entered. Litres is the canonical stored unit; kg and
// cans are converted into litres on save but the original entry is kept so the
// archive shows exactly what was carried (e.g. "3 cans × 20 L").
export type FuelInputUnit = 'litres' | 'kg' | 'cans'

// Petrol density used to convert kilograms into litres (midpoint of 0.74–0.76).
const PETROL_KG_PER_L = 0.75

export type FuelEntry = {
  id: string
  type: FuelEntryType
  litres: number
  inputUnit: FuelInputUnit | null
  inputQty: number | null
  canSizeL: number | null
  boat: string | null
  boatLabel: string | null
  costAr: number | null
  note: string | null
  loggedBy: string | null
  occurredAt: string
}

// Converts a quantity entered in litres/kg/cans into canonical litres.
function toLitres(
  unit: FuelInputUnit,
  qty: number,
  canSizeL: number,
): number {
  if (unit === 'kg') return qty / PETROL_KG_PER_L
  if (unit === 'cans') return qty * canSizeL
  return qty
}

export type FuelState = {
  stockLitres: number
  reorderLitres: number // 0 = not set
  low: boolean // only true when a level is set AND stock is at/under it
  month: string // YYYY-MM, lodge-local
  thisMonth: {
    deliveredLitres: number
    refuelledLitres: number
    // Ariary — never mixed with the EUR figures on the owner report.
    spendAr: number
    deliveries: number
  }
  entries: FuelEntry[]
}

// The signed effect of an entry on stock. Deliveries add, refuels remove,
// adjustments are already signed by the person entering them.
function delta(type: string, litres: number): number {
  if (type === 'refuel') return -Math.abs(litres)
  if (type === 'delivery') return Math.abs(litres)
  return litres // adjustment: trust the sign as entered
}

// Shared row → FuelEntry mapping (used by the active list and the archive).
function mapFuelEntry(r: typeof fuelLog.$inferSelect): FuelEntry {
  return {
    id: r.id,
    type: r.type as FuelEntryType,
    litres: r.litres,
    inputUnit: (r.inputUnit as FuelInputUnit | null) ?? null,
    inputQty: r.inputQty,
    canSizeL: r.canSizeL,
    boat: r.boat,
    boatLabel: r.boat ? boatName(r.boat) : null,
    costAr: r.costAr,
    note: r.note,
    loggedBy: r.loggedBy,
    occurredAt: new Date(r.occurredAt).toISOString(),
  }
}

export async function getFuelState(): Promise<FuelState> {
  const [rows, cfg] = await Promise.all([
    // Archived entries are excluded everywhere stock is computed or shown.
    db
      .select()
      .from(fuelLog)
      .where(isNull(fuelLog.archivedAt))
      .orderBy(desc(fuelLog.occurredAt)),
    db.select().from(fuelConfig).where(eq(fuelConfig.id, 1)).limit(1),
  ])

  const stockLitres = rows.reduce((s, r) => s + delta(r.type, r.litres), 0)
  const reorderLitres = cfg.length ? cfg[0].reorderLitres : 0
  const month = lodgeMonthKey(new Date())

  let deliveredLitres = 0
  let refuelledLitres = 0
  let spendAr = 0
  let deliveries = 0
  for (const r of rows) {
    if (lodgeMonthKey(new Date(r.occurredAt)) !== month) continue
    if (r.type === 'delivery') {
      deliveredLitres += Math.abs(r.litres)
      deliveries++
      if (r.costAr != null) spendAr += r.costAr
    } else if (r.type === 'refuel') {
      refuelledLitres += Math.abs(r.litres)
    }
  }

  const entries: FuelEntry[] = rows.slice(0, 40).map(mapFuelEntry)

  return {
    stockLitres: Math.round(stockLitres * 10) / 10,
    reorderLitres,
    // A reorder level of 0 means "not set", so it can never raise a false alarm.
    low: reorderLitres > 0 && stockLitres <= reorderLitres,
    month,
    thisMonth: {
      deliveredLitres: Math.round(deliveredLitres * 10) / 10,
      refuelledLitres: Math.round(refuelledLitres * 10) / 10,
      spendAr: Math.round(spendAr),
      deliveries,
    },
    entries,
  }
}

function parseOccurredAt(occurredAt?: string): Date {
  if (!occurredAt) return new Date()
  const d = new Date(occurredAt)
  return Number.isNaN(d.getTime()) ? new Date() : d
}

export async function logFuelDelivery(input: {
  litres: number
  costAr?: number | null
  note?: string | null
  loggedBy?: string | null
  occurredAt?: string
}): Promise<void> {
  await assertAdmin()
  const litres = Math.abs(Number(input.litres))
  if (!litres) throw new Error('Enter how many litres were delivered')
  await db.insert(fuelLog).values({
    id: newId('fuel'),
    type: 'delivery',
    litres,
    boat: null,
    costAr: input.costAr != null && input.costAr > 0 ? input.costAr : null,
    note: input.note?.trim() || null,
    loggedBy: input.loggedBy?.trim() || null,
    occurredAt: parseOccurredAt(input.occurredAt),
  })
  revalidatePath('/admin/fuel')
  revalidatePath('/admin')
}

export async function logFuelRefuel(input: {
  boat: string
  // The amount can be entered in litres, kilograms or cans. Litres is derived
  // and stored; the original entry is kept for the archive.
  inputUnit?: FuelInputUnit
  inputQty: number
  canSizeL?: number | null
  note?: string | null
  loggedBy?: string | null
  occurredAt?: string
}): Promise<void> {
  await assertAdmin()
  if (!input.boat) throw new Error('Choose which boat was refuelled')
  const unit: FuelInputUnit = input.inputUnit ?? 'litres'
  const qty = Math.abs(Number(input.inputQty))
  if (!qty) throw new Error('Enter how much fuel went into the boat')
  const canSizeL = Math.abs(Number(input.canSizeL)) || 0
  if (unit === 'cans' && canSizeL <= 0) {
    throw new Error('Enter the size of one can in litres')
  }
  const litres = toLitres(unit, qty, canSizeL)
  if (!litres || litres <= 0) throw new Error('Enter how much fuel went into the boat')
  await db.insert(fuelLog).values({
    id: newId('fuel'),
    type: 'refuel',
    litres,
    inputUnit: unit,
    inputQty: qty,
    canSizeL: unit === 'cans' ? canSizeL : null,
    boat: input.boat,
    costAr: null,
    note: input.note?.trim() || null,
    loggedBy: input.loggedBy?.trim() || null,
    occurredAt: parseOccurredAt(input.occurredAt),
  })
  revalidatePath('/admin/fuel')
  revalidatePath('/admin')
}

export async function logFuelAdjustment(input: {
  litres: number // signed: positive found stock, negative loss/leak/correction
  note?: string | null
  loggedBy?: string | null
}): Promise<void> {
  await assertAdmin()
  const litres = Number(input.litres)
  if (!litres) throw new Error('Enter a correction amount (+ or −)')
  await db.insert(fuelLog).values({
    id: newId('fuel'),
    type: 'adjustment',
    litres,
    boat: null,
    costAr: null,
    // A correction with no reason is useless months later, so a note is asked.
    note: input.note?.trim() || null,
    loggedBy: input.loggedBy?.trim() || null,
    occurredAt: new Date(),
  })
  revalidatePath('/admin/fuel')
  revalidatePath('/admin')
}

export async function setFuelReorderLevel(litres: number): Promise<void> {
  await assertAdmin()
  const value = Math.max(0, Number(litres) || 0)
  await db
    .insert(fuelConfig)
    .values({ id: 1, reorderLitres: value, updatedAt: new Date() })
    .onConflictDoUpdate({
      target: fuelConfig.id,
      set: { reorderLitres: value, updatedAt: new Date() },
    })
  revalidatePath('/admin/fuel')
  revalidatePath('/admin')
}

export async function deleteFuelEntry(id: string): Promise<void> {
  await assertAdmin()
  // Soft-delete: the row is never removed, it moves to the archive so the fuel
  // record stays auditable and restorable. Stock is recomputed from active rows
  // only, so an archived entry stops counting — exactly like a delete did.
  await db
    .update(fuelLog)
    .set({ archivedAt: new Date() })
    .where(eq(fuelLog.id, id))
  revalidatePath('/admin/fuel')
  revalidatePath('/admin')
}

export async function restoreFuelEntry(id: string): Promise<void> {
  await assertAdmin()
  await db
    .update(fuelLog)
    .set({ archivedAt: null })
    .where(eq(fuelLog.id, id))
  revalidatePath('/admin/fuel')
  revalidatePath('/admin')
}

export async function getArchivedFuelEntries(): Promise<FuelEntry[]> {
  const rows = await db
    .select()
    .from(fuelLog)
    .where(isNotNull(fuelLog.archivedAt))
    .orderBy(desc(fuelLog.archivedAt))
  return rows.map(mapFuelEntry)
}

/**
 * Low-stock alert for the Command Center. Pinned there for the same reason the
 * maintenance alerts are: nobody opens the Fuel page to discover a problem,
 * they open it once they already know. Returns at most one entry.
 */
export async function getFuelAlerts(): Promise<
  { id: string; message: string; severity: 'warning' | 'critical' }[]
> {
  const rows = await db
    .select({ type: fuelLog.type, litres: fuelLog.litres })
    .from(fuelLog)
    .where(isNull(fuelLog.archivedAt))
  const cfg = await db
    .select()
    .from(fuelConfig)
    .where(eq(fuelConfig.id, 1))
    .limit(1)
  const reorder = cfg.length ? cfg[0].reorderLitres : 0
  if (reorder <= 0) return []
  const stock = rows.reduce((s, r) => s + delta(r.type, r.litres), 0)
  if (stock > reorder) return []
  const litres = Math.round(stock * 10) / 10
  return [
    {
      id: 'fuel-low',
      // Empty or negative stock is a harder problem than merely low, so it is
      // raised as critical.
      severity: stock <= 0 ? 'critical' : 'warning',
      message:
        stock <= 0
          ? `Fuel drums are empty (${litres} L on record) — reorder now.`
          : `Fuel stock is down to ${litres} L, at or below the ${reorder} L reorder level.`,
    },
  ]
}

// ─────────────────────────────────────────────────────────────────────────
// Per-boat fuel ledger
//
// Separate from the shore stock above. Every boat keeps its own record of the
// fuel ON BOARD: measured before a trip, after a trip, or on a surprise
// spot-check. Litres and kilograms are tracked side by side (the fuel is
// weighed on some checks and gauged on others) and are NEVER converted into
// one another — no density is assumed. Consumption is only ever shown as the
// drop between two readings in the SAME unit.
// ─────────────────────────────────────────────────────────────────────────

export type FuelReadingKind = 'trip-start' | 'trip-end' | 'spot-check'

export type BoatFuelReading = {
  id: string
  boat: string
  kind: FuelReadingKind
  // Which tank/engine this reading is for. null on single-engine boats (and on
  // legacy whole-boat readings). 'left' | 'right' on the twin-engine Odyssey.
  engineSlot: EngineSlot | null
  litres: number | null
  kilograms: number | null
  tripId: string | null
  note: string | null
  loggedBy: string | null
  occurredAt: string
}

// Per-engine on-board figure for a twin-engine boat.
export type EngineFuel = {
  slot: EngineSlot
  lastLitres: number | null
  lastKilograms: number | null
  lastReadingAt: string | null
}

export type BoatFuelSummary = {
  boat: string
  boatLabel: string
  internal: boolean
  // Latest reading of each unit, whatever kind it was (the current on-board
  // figure). Null until the boat has ever been measured in that unit. On a
  // twin-engine boat this is the SUM of the two tanks' latest figures.
  lastLitres: number | null
  lastKilograms: number | null
  lastReadingAt: string | null
  // Per-engine breakdown for twin-engine boats; null for single-tank boats.
  engines: EngineFuel[] | null
  // The most recent completed trip pair (a trip-start followed by a trip-end)
  // and the fuel it burned, per unit. Null when there is no such pair yet. On a
  // twin-engine boat this is the sum of both tanks' consumption over that trip.
  lastTrip: {
    startAt: string
    endAt: string
    usedLitres: number | null
    usedKilograms: number | null
  } | null
  readings: BoatFuelReading[]
}

export type BoatFuelState = {
  boats: BoatFuelSummary[]
}

const READING_KINDS: FuelReadingKind[] = ['trip-start', 'trip-end', 'spot-check']

function round1(n: number): number {
  return Math.round(n * 10) / 10
}

export async function getBoatFuelState(): Promise<BoatFuelState> {
  const rows = await db
    .select()
    .from(boatFuelReadings)
    .where(isNull(boatFuelReadings.archivedAt))
    .orderBy(desc(boatFuelReadings.occurredAt))

  // Group readings by boat (newest first, as ordered above).
  const byBoat = new Map<string, BoatFuelReading[]>()
  for (const r of rows) {
    const reading: BoatFuelReading = {
      id: r.id,
      boat: r.boat,
      kind: (READING_KINDS as string[]).includes(r.kind)
        ? (r.kind as FuelReadingKind)
        : 'spot-check',
      engineSlot:
        r.engineSlot === 'left' || r.engineSlot === 'right'
          ? r.engineSlot
          : null,
      litres: r.litres ?? null,
      kilograms: r.kilograms ?? null,
      tripId: r.tripId ?? null,
      note: r.note ?? null,
      loggedBy: r.loggedBy ?? null,
      occurredAt:
        r.occurredAt instanceof Date
          ? r.occurredAt.toISOString()
          : String(r.occurredAt),
    }
    const list = byBoat.get(r.boat)
    if (list) list.push(reading)
    else byBoat.set(r.boat, [reading])
  }

  const boats: BoatFuelSummary[] = BOATS.map((b) => {
    const readings = byBoat.get(b.id) ?? []
    const slots = boatEngineSlots(b.id)

    if (slots.length === 0) {
      // Single-tank boat: one whole-boat figure, exactly as before.
      const lastLitres = readings.find((x) => x.litres != null)?.litres ?? null
      const lastKilograms =
        readings.find((x) => x.kilograms != null)?.kilograms ?? null
      const lastReadingAt = readings.length ? readings[0].occurredAt : null
      return {
        boat: b.id,
        boatLabel: b.name,
        internal: !!b.internal,
        lastLitres,
        lastKilograms,
        lastReadingAt,
        engines: null,
        lastTrip: computeLastTrip(readings),
        readings,
      }
    }

    // Twin-engine boat: read per tank, then present the sum plus a breakdown.
    const engines: EngineFuel[] = slots.map((slot) => {
      const own = readings.filter((x) => x.engineSlot === slot)
      return {
        slot,
        lastLitres: own.find((x) => x.litres != null)?.litres ?? null,
        lastKilograms: own.find((x) => x.kilograms != null)?.kilograms ?? null,
        lastReadingAt: own.length ? own[0].occurredAt : null,
      }
    })

    // Totals: sum of each tank's latest figure. Null only when NO tank has a
    // figure in that unit, so one measured tank still yields a total.
    const litresVals = engines
      .map((e) => e.lastLitres)
      .filter((v): v is number => v != null)
    const kgVals = engines
      .map((e) => e.lastKilograms)
      .filter((v): v is number => v != null)
    const lastLitres = litresVals.length ? round1(litresVals.reduce((s, v) => s + v, 0)) : null
    const lastKilograms = kgVals.length ? round1(kgVals.reduce((s, v) => s + v, 0)) : null
    const readAts = engines
      .map((e) => e.lastReadingAt)
      .filter((v): v is string => v != null)
      .sort()
    const lastReadingAt = readAts.length ? readAts[readAts.length - 1] : null

    // Trip consumption per tank, then summed — a left trip-end must only ever
    // pair with a left trip-start, so consumption is computed within each slot.
    const perSlotTrips = slots
      .map((slot) => computeLastTrip(readings.filter((x) => x.engineSlot === slot)))
      .filter((t): t is NonNullable<typeof t> => t != null)
    let lastTrip: BoatFuelSummary['lastTrip'] = null
    if (perSlotTrips.length) {
      const sumUnit = (pick: (t: (typeof perSlotTrips)[number]) => number | null) => {
        const vals = perSlotTrips.map(pick).filter((v): v is number => v != null)
        return vals.length ? round1(vals.reduce((s, v) => s + v, 0)) : null
      }
      const starts = perSlotTrips.map((t) => t.startAt).sort()
      const ends = perSlotTrips.map((t) => t.endAt).sort()
      lastTrip = {
        startAt: starts[0],
        endAt: ends[ends.length - 1],
        usedLitres: sumUnit((t) => t.usedLitres),
        usedKilograms: sumUnit((t) => t.usedKilograms),
      }
    }

    return {
      boat: b.id,
      boatLabel: b.name,
      internal: !!b.internal,
      lastLitres,
      lastKilograms,
      lastReadingAt,
      engines,
      lastTrip,
      readings,
    }
  })

  return { boats }
}

// Most recent completed trip (a trip-start followed by a trip-end) and the fuel
// it burned, per unit. `readings` must be newest-first. Consumption is computed
// independently per unit so a weighed check and a gauged check never mix.
function computeLastTrip(
  readings: BoatFuelReading[],
): BoatFuelSummary['lastTrip'] {
  const end = readings.find((x) => x.kind === 'trip-end')
  if (!end) return null
  const endIdx = readings.indexOf(end)
  const start = readings.slice(endIdx + 1).find((x) => x.kind === 'trip-start')
  if (!start) return null
  return {
    startAt: start.occurredAt,
    endAt: end.occurredAt,
    usedLitres:
      start.litres != null && end.litres != null
        ? round1(start.litres - end.litres)
        : null,
    usedKilograms:
      start.kilograms != null && end.kilograms != null
        ? round1(start.kilograms - end.kilograms)
        : null,
  }
}

export async function logBoatFuelReading(input: {
  boat: string
  kind: FuelReadingKind
  engineSlot?: EngineSlot | null
  litres?: number | null
  kilograms?: number | null
  tripId?: string | null
  note?: string | null
  loggedBy?: string | null
  occurredAt?: string
}): Promise<void> {
  await assertAdmin()
  if (!input.boat || !BOATS.some((b) => b.id === input.boat)) {
    throw new Error('Choose which boat this reading is for')
  }
  const kind: FuelReadingKind = READING_KINDS.includes(input.kind)
    ? input.kind
    : 'spot-check'

  // Only twin-engine boats carry a tank slot; ignore a stray slot on a
  // single-tank boat and require one where the boat has two tanks.
  const slots = boatEngineSlots(input.boat)
  const engineSlot =
    slots.length > 0 &&
    (input.engineSlot === 'left' || input.engineSlot === 'right')
      ? input.engineSlot
      : null
  if (slots.length > 0 && engineSlot == null) {
    throw new Error('Choose which engine this reading is for')
  }

  // Both units are optional individually, but a reading with neither figure is
  // meaningless — require at least one.
  const litres =
    input.litres != null && Number(input.litres) >= 0
      ? Math.abs(Number(input.litres))
      : null
  const kilograms =
    input.kilograms != null && Number(input.kilograms) >= 0
      ? Math.abs(Number(input.kilograms))
      : null
  if (litres == null && kilograms == null) {
    throw new Error('Enter litres, kilograms, or both')
  }

  await db.insert(boatFuelReadings).values({
    id: newId('bfr'),
    boat: input.boat,
    kind,
    engineSlot,
    litres,
    kilograms,
    tripId: input.tripId?.trim() || null,
    note: input.note?.trim() || null,
    loggedBy: input.loggedBy?.trim() || null,
    occurredAt: parseOccurredAt(input.occurredAt),
  })
  revalidatePath('/admin/fuel')
  revalidatePath('/admin')
}

export async function deleteBoatFuelReading(id: string): Promise<void> {
  await assertAdmin()
  // Soft-delete → archive. Every figure (on board, consumption) is derived from
  // active rows only, so an archived reading stops counting yet stays on record
  // and can be restored.
  await db
    .update(boatFuelReadings)
    .set({ archivedAt: new Date() })
    .where(eq(boatFuelReadings.id, id))
  revalidatePath('/admin/fuel')
  revalidatePath('/admin')
}

export async function restoreBoatFuelReading(id: string): Promise<void> {
  await assertAdmin()
  await db
    .update(boatFuelReadings)
    .set({ archivedAt: null })
    .where(eq(boatFuelReadings.id, id))
  revalidatePath('/admin/fuel')
  revalidatePath('/admin')
}

// Archived per-boat readings, grouped per boat, for the archive drawer.
export async function getArchivedBoatReadings(): Promise<
  { boat: string; boatLabel: string; readings: BoatFuelReading[] }[]
> {
  const rows = await db
    .select()
    .from(boatFuelReadings)
    .where(isNotNull(boatFuelReadings.archivedAt))
    .orderBy(desc(boatFuelReadings.archivedAt))
  const byBoat = new Map<string, BoatFuelReading[]>()
  for (const r of rows) {
    const reading: BoatFuelReading = {
      id: r.id,
      boat: r.boat,
      kind: (READING_KINDS as string[]).includes(r.kind)
        ? (r.kind as FuelReadingKind)
        : 'spot-check',
      engineSlot:
        r.engineSlot === 'left' || r.engineSlot === 'right'
          ? r.engineSlot
          : null,
      litres: r.litres ?? null,
      kilograms: r.kilograms ?? null,
      tripId: r.tripId ?? null,
      note: r.note ?? null,
      loggedBy: r.loggedBy ?? null,
      occurredAt:
        r.occurredAt instanceof Date
          ? r.occurredAt.toISOString()
          : String(r.occurredAt),
    }
    const list = byBoat.get(r.boat)
    if (list) list.push(reading)
    else byBoat.set(r.boat, [reading])
  }
  return BOATS.filter((b) => byBoat.has(b.id)).map((b) => ({
    boat: b.id,
    boatLabel: b.name,
    readings: byBoat.get(b.id)!,
  }))
}

// ─────────────────────────────────────────────────────────────────────────
// Combined stock: everything we hold, anywhere.
//
// Total fuel = the shore warehouse + the fuel currently on board every boat.
// Litres and kilograms are summed SEPARATELY and never converted: the
// warehouse is litres only, so the kilogram total is the boats' weighed fuel
// alone. This is a snapshot of holdings, not a running ledger.
// ─────────────────────────────────────────────────────────────────────────

export type FuelTotals = {
  warehouseLitres: number
  boatsLitres: number
  boatsKilograms: number
  totalLitres: number // warehouse + boats, litres
  boats: { boat: string; boatLabel: string; litres: number | null; kilograms: number | null }[]
}

export async function getFuelTotals(): Promise<FuelTotals> {
  const [warehouse, boatState] = await Promise.all([
    db
      .select({ type: fuelLog.type, litres: fuelLog.litres })
      .from(fuelLog)
      .where(isNull(fuelLog.archivedAt)),
    getBoatFuelState(),
  ])

  const warehouseLitres = round1(
    warehouse.reduce((s, r) => s + delta(r.type, r.litres), 0),
  )

  let boatsLitres = 0
  let boatsKilograms = 0
  const boats = boatState.boats.map((b) => {
    if (b.lastLitres != null) boatsLitres += b.lastLitres
    if (b.lastKilograms != null) boatsKilograms += b.lastKilograms
    return {
      boat: b.boat,
      boatLabel: b.boatLabel,
      litres: b.lastLitres,
      kilograms: b.lastKilograms,
    }
  })

  return {
    warehouseLitres,
    boatsLitres: round1(boatsLitres),
    boatsKilograms: round1(boatsKilograms),
    totalLitres: round1(warehouseLitres + boatsLitres),
    boats,
  }
}

// ─────────────────────────────────────────────────────────────────────────
// Fuel procurement — a two-step event
//
// Step 1  logFuelPurchase  → the owner pays at the station. Money is spent,
//                            fuel is NOT in the warehouse yet (status 'paid').
// Step 2  receiveFuelPurchase → the employee brings it in 20 L / 25 L cans;
//                            we record the transport cost and, only now, add a
//                            fuelLog 'delivery' for the litres actually carried
//                            in. Warehouse stock stays driven by fuelLog alone.
//
// Canister sizes are fixed at 20 L and 25 L (as the owner described). Litres
// added to the warehouse = the cans actually received, which may differ a
// little from the litres paid for.
// ─────────────────────────────────────────────────────────────────────────

const CANISTER_20 = 20
const CANISTER_25 = 25

export type ProcurementStatus = 'paid' | 'received'

export type PaymentMethod = 'cash' | 'orange_money' | 'card'

export type FuelProcurement = {
  id: string
  status: ProcurementStatus
  paidLitres: number | null
  pricePerLitreAr: number | null
  fuelCostAr: number | null
  paymentMethod: PaymentMethod | null
  receiptUrl: string | null
  transportCostAr: number | null
  canisters20: number
  canisters25: number
  receivedLitres: number | null
  receivedBy: string | null
  station: string | null
  note: string | null
  paidBy: string | null
  paidAt: string
  receivedAt: string | null
  // Total the owner is out of pocket for this run (fuel + transport), Ariary.
  totalCostAr: number | null
}

function mapProcurement(r: typeof fuelProcurements.$inferSelect): FuelProcurement {
  const fuel = r.fuelCostAr ?? null
  const transport = r.transportCostAr ?? null
  const totalCostAr =
    fuel == null && transport == null ? null : (fuel ?? 0) + (transport ?? 0)
  const pm = r.paymentMethod
  return {
    id: r.id,
    status: (r.status as ProcurementStatus) === 'received' ? 'received' : 'paid',
    paidLitres: r.paidLitres ?? null,
    pricePerLitreAr: r.pricePerLitreAr ?? null,
    fuelCostAr: fuel,
    paymentMethod:
      pm === 'cash' || pm === 'orange_money' || pm === 'card' ? pm : null,
    receiptUrl: r.receiptUrl ?? null,
    transportCostAr: transport,
    canisters20: r.canisters20 ?? 0,
    canisters25: r.canisters25 ?? 0,
    receivedLitres: r.receivedLitres ?? null,
    receivedBy: r.receivedBy ?? null,
    station: r.station ?? null,
    note: r.note ?? null,
    paidBy: r.paidBy ?? null,
    paidAt:
      r.paidAt instanceof Date ? r.paidAt.toISOString() : String(r.paidAt),
    receivedAt: r.receivedAt
      ? r.receivedAt instanceof Date
        ? r.receivedAt.toISOString()
        : String(r.receivedAt)
      : null,
    totalCostAr,
  }
}

export async function getFuelProcurements(): Promise<{
  open: FuelProcurement[] // paid, awaiting pickup
  done: FuelProcurement[] // received
}> {
  const rows = await db
    .select()
    .from(fuelProcurements)
    .where(isNull(fuelProcurements.archivedAt))
    .orderBy(desc(fuelProcurements.paidAt))
  const all = rows.map(mapProcurement)
  return {
    open: all.filter((p) => p.status === 'paid'),
    done: all.filter((p) => p.status === 'received'),
  }
}

// Step 1: record the payment at the station.
//
// The owner enters the litres paid for and the price per 1 L; the total fuel
// cost is COMPUTED (paidLitres × pricePerLitreAr) — never typed by hand — so
// the number can't drift from its parts. A receipt photo (public blob URL) and
// the payment method (cash / Orange Money / card) are optional.
export async function logFuelPurchase(input: {
  paidLitres?: number | null
  pricePerLitreAr?: number | null
  station?: string | null
  note?: string | null
  paidBy?: string | null
  paymentMethod?: PaymentMethod | null
  receiptUrl?: string | null
  paidAt?: string
}): Promise<void> {
  await assertAdmin()
  const paidLitres =
    input.paidLitres != null && Number(input.paidLitres) > 0
      ? Math.abs(Number(input.paidLitres))
      : null
  const pricePerLitreAr =
    input.pricePerLitreAr != null && Number(input.pricePerLitreAr) >= 0
      ? Math.abs(Number(input.pricePerLitreAr))
      : null
  // Total is derived, and only when both parts are present.
  const fuelCostAr =
    paidLitres != null && pricePerLitreAr != null
      ? Math.round(paidLitres * pricePerLitreAr)
      : null
  if (paidLitres == null && pricePerLitreAr == null) {
    throw new Error('Enter the litres paid for and the price per litre')
  }
  const pm = input.paymentMethod
  await db.insert(fuelProcurements).values({
    id: newId('proc'),
    status: 'paid',
    paidLitres,
    pricePerLitreAr,
    fuelCostAr,
    paymentMethod:
      pm === 'cash' || pm === 'orange_money' || pm === 'card' ? pm : null,
    receiptUrl: input.receiptUrl?.trim() || null,
    station: input.station?.trim() || null,
    note: input.note?.trim() || null,
    paidBy: input.paidBy?.trim() || null,
    paidAt: parseOccurredAt(input.paidAt),
  })
  revalidatePath('/admin/fuel')
  revalidatePath('/admin')
}

// Step 2: the fuel arrives in cans. This is the moment it enters the warehouse.
export async function receiveFuelPurchase(input: {
  id: string
  canisters20?: number | null
  canisters25?: number | null
  transportCostAr?: number | null
  receivedBy?: string | null
  receivedAt?: string
}): Promise<void> {
  await assertAdmin()
  const [existing] = await db
    .select()
    .from(fuelProcurements)
    .where(eq(fuelProcurements.id, input.id))
    .limit(1)
  if (!existing) throw new Error('Purchase not found')
  if (existing.status === 'received') {
    throw new Error('This purchase has already been received')
  }

  const c20 = Math.max(0, Math.floor(Number(input.canisters20) || 0))
  const c25 = Math.max(0, Math.floor(Number(input.canisters25) || 0))
  const receivedLitres = c20 * CANISTER_20 + c25 * CANISTER_25
  if (receivedLitres <= 0) {
    throw new Error('Enter how many 20 L and 25 L cans arrived')
  }
  const transportCostAr =
    input.transportCostAr != null && Number(input.transportCostAr) >= 0
      ? Math.abs(Number(input.transportCostAr))
      : null

  // The warehouse delivery carries the FULL cost of getting this fuel on the
  // boat's home base: fuel paid at the station + transport by the employee.
  const totalCostAr =
    existing.fuelCostAr == null && transportCostAr == null
      ? null
      : (existing.fuelCostAr ?? 0) + (transportCostAr ?? 0)
  const when = parseOccurredAt(input.receivedAt)
  const deliveryId = newId('fuel')

  const noteParts = ['Procurement']
  if (c20) noteParts.push(`${c20}×20 L`)
  if (c25) noteParts.push(`${c25}×25 L`)
  if (existing.station) noteParts.push(existing.station)

  // Two writes that must both land: the warehouse delivery and the status flip.
  await db.transaction(async (tx) => {
    await tx.insert(fuelLog).values({
      id: deliveryId,
      type: 'delivery',
      litres: receivedLitres,
      costAr: totalCostAr,
      note: noteParts.join(' · '),
      loggedBy: input.receivedBy?.trim() || existing.paidBy || null,
      occurredAt: when,
    })
    await tx
      .update(fuelProcurements)
      .set({
        status: 'received',
        canisters20: c20,
        canisters25: c25,
        receivedLitres,
        transportCostAr,
        receivedBy: input.receivedBy?.trim() || null,
        receivedAt: when,
        deliveryEntryId: deliveryId,
      })
      .where(eq(fuelProcurements.id, input.id))
  })

  revalidatePath('/admin/fuel')
  revalidatePath('/admin')
}

// Archive a procurement. If it was already received, the linked warehouse
// delivery is archived in the same breath so stock does not keep counting fuel
// whose procurement record was removed.
export async function deleteFuelProcurement(id: string): Promise<void> {
  await assertAdmin()
  const [existing] = await db
    .select()
    .from(fuelProcurements)
    .where(eq(fuelProcurements.id, id))
    .limit(1)
  if (!existing) return
  await db.transaction(async (tx) => {
    await tx
      .update(fuelProcurements)
      .set({ archivedAt: new Date() })
      .where(eq(fuelProcurements.id, id))
    if (existing.deliveryEntryId) {
      await tx
        .update(fuelLog)
        .set({ archivedAt: new Date() })
        .where(eq(fuelLog.id, existing.deliveryEntryId))
    }
  })
  revalidatePath('/admin/fuel')
  revalidatePath('/admin')
}

export async function restoreFuelProcurement(id: string): Promise<void> {
  await assertAdmin()
  const [existing] = await db
    .select()
    .from(fuelProcurements)
    .where(eq(fuelProcurements.id, id))
    .limit(1)
  if (!existing) return
  await db.transaction(async (tx) => {
    await tx
      .update(fuelProcurements)
      .set({ archivedAt: null })
      .where(eq(fuelProcurements.id, id))
    if (existing.deliveryEntryId) {
      await tx
        .update(fuelLog)
        .set({ archivedAt: null })
        .where(eq(fuelLog.id, existing.deliveryEntryId))
    }
  })
  revalidatePath('/admin/fuel')
  revalidatePath('/admin')
}

export async function getArchivedFuelProcurements(): Promise<FuelProcurement[]> {
  const rows = await db
    .select()
    .from(fuelProcurements)
    .where(isNotNull(fuelProcurements.archivedAt))
    .orderBy(desc(fuelProcurements.archivedAt))
  return rows.map(mapProcurement)
}
