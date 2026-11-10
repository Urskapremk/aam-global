'use server'

import { and, desc, eq, gte, isNull } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'

import {
  checkCaretakerPin,
  isCaretaker,
  signInCaretaker,
  signOutCaretaker,
} from '@/lib/caretaker-auth'
import { boatName } from '@/lib/boats'
import { db } from '@/lib/db'
import { caretakerCans, fuelConfig, fuelLog } from '@/lib/db/schema'
import { ensureHisnikSchema } from '@/lib/hisnik-schema'
import {
  DEFAULT_DENSITY_KG_PER_L,
  ODYSSEY_II_CAN_L,
  clampDensity,
  kgFromLitres,
  litresFromKg,
  round1,
} from '@/lib/fuel-units'

const LODGE_OFFSET_MS = 3 * 60 * 60 * 1000

const newId = (p: string) =>
  `${p}-${Date.now()}-${Math.random().toString(16).slice(2, 14)}`

async function assertCaretaker() {
  // English source keys — the hisnik UI translates via the shared i18n system.
  if (!(await isCaretaker())) throw new Error('Not signed in')
}

function stockDelta(type: string, litres: number): number {
  if (type === 'refuel') return -Math.abs(litres)
  if (type === 'delivery') return Math.abs(litres)
  if (type === 'weigh') return 0
  return litres
}

async function getDensity(): Promise<number> {
  const rows = await db
    .select()
    .from(fuelConfig)
    .where(eq(fuelConfig.id, 1))
    .limit(1)
  return clampDensity(rows[0]?.densityKgPerL ?? DEFAULT_DENSITY_KG_PER_L)
}

async function getStockLitres(): Promise<number> {
  const rows = await db
    .select({ type: fuelLog.type, litres: fuelLog.litres })
    .from(fuelLog)
    .where(isNull(fuelLog.archivedAt))
  return round1(rows.reduce((s, r) => s + stockDelta(r.type, r.litres), 0))
}

function lodgeDayStart(): Date {
  // Lodge-local midnight as a UTC Date, matching fuel month logic (UTC+3).
  const shifted = new Date(Date.now() + LODGE_OFFSET_MS)
  const y = shifted.getUTCFullYear()
  const m = shifted.getUTCMonth()
  const d = shifted.getUTCDate()
  return new Date(Date.UTC(y, m, d) - LODGE_OFFSET_MS)
}

export type HisnikUnit = 'litres' | 'kg'

export type HisnikCanState = {
  id: string
  boat: string
  boatLabel: string
  label: string
  location: 'with_skipper' | 'at_warehouse'
  lastLitres: number | null
  lastKilograms: number | null
  issuedLitres: number | null
  issuedKilograms: number | null
  issuedAt: string | null
  lastWeighedAt: string | null
}

export type HisnikEvent = {
  id: string
  type: string
  eventType: string | null
  litres: number
  inputUnit: HisnikUnit | 'cans' | null
  inputQty: number | null
  canSizeL: number | null
  boat: string | null
  boatLabel: string | null
  note: string | null
  occurredAt: string
}

export type HisnikState = {
  stockLitres: number
  stockKg: number
  densityKgPerL: number
  can: HisnikCanState
  today: HisnikEvent[]
}

const III_CAN_ID = 'can-odyssey-iii'

async function getOrCreateIiiCan() {
  const [existing] = await db
    .select()
    .from(caretakerCans)
    .where(eq(caretakerCans.id, III_CAN_ID))
    .limit(1)
  if (existing) return existing
  await db.insert(caretakerCans).values({
    id: III_CAN_ID,
    boat: 'odyssey-iii',
    label: 'Prenosna kanta · Odyssey III',
    location: 'at_warehouse',
  })
  const [created] = await db
    .select()
    .from(caretakerCans)
    .where(eq(caretakerCans.id, III_CAN_ID))
    .limit(1)
  return created!
}

function mapCan(r: typeof caretakerCans.$inferSelect): HisnikCanState {
  return {
    id: r.id,
    boat: r.boat,
    boatLabel: boatName(r.boat),
    label: r.label,
    location: r.location === 'with_skipper' ? 'with_skipper' : 'at_warehouse',
    lastLitres: r.lastLitres ?? null,
    lastKilograms: r.lastKilograms ?? null,
    issuedLitres: r.issuedLitres ?? null,
    issuedKilograms: r.issuedKilograms ?? null,
    issuedAt: r.issuedAt
      ? r.issuedAt instanceof Date
        ? r.issuedAt.toISOString()
        : String(r.issuedAt)
      : null,
    lastWeighedAt: r.lastWeighedAt
      ? r.lastWeighedAt instanceof Date
        ? r.lastWeighedAt.toISOString()
        : String(r.lastWeighedAt)
      : null,
  }
}

function mapEvent(r: typeof fuelLog.$inferSelect): HisnikEvent {
  return {
    id: r.id,
    type: r.type,
    eventType: r.eventType ?? null,
    litres: r.litres,
    inputUnit: (r.inputUnit as HisnikEvent['inputUnit']) ?? null,
    inputQty: r.inputQty ?? null,
    canSizeL: r.canSizeL ?? null,
    boat: r.boat,
    boatLabel: r.boat ? boatName(r.boat) : null,
    note: r.note,
    occurredAt:
      r.occurredAt instanceof Date
        ? r.occurredAt.toISOString()
        : String(r.occurredAt),
  }
}

export async function caretakerLogin(pin: string): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!checkCaretakerPin(pin)) {
    return { ok: false, error: 'Wrong PIN' }
  }
  await signInCaretaker()
  return { ok: true }
}

export async function caretakerLogout(): Promise<void> {
  await signOutCaretaker()
}

export async function caretakerSession(): Promise<{ authenticated: boolean }> {
  return { authenticated: await isCaretaker() }
}

export async function getHisnikState(): Promise<HisnikState> {
  await assertCaretaker()
  await ensureHisnikSchema()

  const [density, stockLitres, can, todayRows] = await Promise.all([
    getDensity(),
    getStockLitres(),
    getOrCreateIiiCan(),
    db
      .select()
      .from(fuelLog)
      .where(
        and(
          isNull(fuelLog.archivedAt),
          eq(fuelLog.source, 'caretaker'),
          gte(fuelLog.occurredAt, lodgeDayStart()),
        ),
      )
      .orderBy(desc(fuelLog.occurredAt)),
  ])

  return {
    stockLitres,
    stockKg: round1(kgFromLitres(stockLitres, density)),
    densityKgPerL: density,
    can: mapCan(can),
    today: todayRows.map(mapEvent),
  }
}

function resolveAmount(
  unit: HisnikUnit,
  qty: number,
  density: number,
): { litres: number; kilograms: number; inputUnit: HisnikUnit; inputQty: number } {
  const q = Math.abs(Number(qty))
  if (!q || !Number.isFinite(q)) {
    throw new Error('Enter an amount')
  }
  if (unit === 'kg') {
    const litres = round1(litresFromKg(q, density))
    return { litres, kilograms: round1(q), inputUnit: 'kg', inputQty: q }
  }
  const litres = round1(q)
  return {
    litres,
    kilograms: round1(kgFromLitres(litres, density)),
    inputUnit: 'litres',
    inputQty: q,
  }
}

/** Odyssey II: issue 1 or 2 × 25 L cans from warehouse stock. */
export async function hisnikIssueOdysseyIi(cans: 1 | 2): Promise<HisnikState> {
  await assertCaretaker()
  await ensureHisnikSchema()

  const n = cans === 2 ? 2 : 1
  const litres = n * ODYSSEY_II_CAN_L
  const stock = await getStockLitres()
  if (stock + 1e-6 < litres) {
    throw new Error(`Not enough stock (${stock} L; need ${litres} L)`)
  }

  await db.insert(fuelLog).values({
    id: newId('fuel'),
    type: 'refuel',
    litres,
    inputUnit: 'cans',
    inputQty: n,
    canSizeL: ODYSSEY_II_CAN_L,
    boat: 'odyssey-ii',
    costAr: null,
    note: `Hišnik · Odyssey II · ${n}×${ODYSSEY_II_CAN_L} L`,
    loggedBy: 'Hišnik',
    source: 'caretaker',
    eventType: 'issue',
    occurredAt: new Date(),
  })

  revalidatePath('/admin/fuel')
  revalidatePath('/admin')
  revalidatePath('/hisnik')
  return getHisnikState()
}

/**
 * After trip: skipper returns the portable can. Weigh → record consumption.
 * Can stays at warehouse until next-day fill. No warehouse stock change.
 */
export async function hisnikWeighReturn(input: {
  unit: HisnikUnit
  qty: number
}): Promise<HisnikState> {
  await assertCaretaker()
  await ensureHisnikSchema()

  const density = await getDensity()
  const amount = resolveAmount(input.unit, input.qty, density)
  const can = await getOrCreateIiiCan()
  const issued = can.issuedLitres
  const used =
    issued != null ? round1(Math.max(0, issued - amount.litres)) : null

  const noteParts = [
    'Hišnik · vrnjena kanta',
    `ostanek ${amount.litres} L (${amount.kilograms} kg)`,
  ]
  if (used != null) noteParts.push(`poraba ${used} L`)

  const now = new Date()
  await db.transaction(async (tx) => {
    await tx.insert(fuelLog).values({
      id: newId('fuel'),
      type: 'weigh',
      litres: amount.litres,
      inputUnit: amount.inputUnit,
      inputQty: amount.inputQty,
      canSizeL: null,
      boat: 'odyssey-iii',
      costAr: null,
      note: noteParts.join(' · '),
      loggedBy: 'Hišnik',
      source: 'caretaker',
      eventType: 'weigh-return',
      occurredAt: now,
    })
    await tx
      .update(caretakerCans)
      .set({
        location: 'at_warehouse',
        lastLitres: amount.litres,
        lastKilograms: amount.kilograms,
        lastWeighedAt: now,
        updatedAt: now,
      })
      .where(eq(caretakerCans.id, III_CAN_ID))
  })

  revalidatePath('/admin/fuel')
  revalidatePath('/admin')
  revalidatePath('/hisnik')
  return getHisnikState()
}

/**
 * Next day: weigh remaining, fill from warehouse, hand to skipper.
 * Stock decreases only by the filled litres.
 */
export async function hisnikWeighFillIssue(input: {
  weighUnit: HisnikUnit
  weighQty: number
  fillUnit: HisnikUnit
  fillQty: number
}): Promise<HisnikState> {
  await assertCaretaker()
  await ensureHisnikSchema()

  const density = await getDensity()
  const weigh = resolveAmount(input.weighUnit, input.weighQty, density)
  const fill = resolveAmount(input.fillUnit, input.fillQty, density)
  if (fill.litres <= 0) throw new Error('Enter how much you fill from stock')

  const stock = await getStockLitres()
  if (stock + 1e-6 < fill.litres) {
    throw new Error(`Not enough stock (${stock} L; need ${fill.litres} L)`)
  }

  const afterLitres = round1(weigh.litres + fill.litres)
  const afterKg = round1(kgFromLitres(afterLitres, density))
  const now = new Date()

  await db.transaction(async (tx) => {
    // Morning weigh — no stock change.
    await tx.insert(fuelLog).values({
      id: newId('fuel'),
      type: 'weigh',
      litres: weigh.litres,
      inputUnit: weigh.inputUnit,
      inputQty: weigh.inputQty,
      canSizeL: null,
      boat: 'odyssey-iii',
      costAr: null,
      note: `Hišnik · jutranje tehtanje · ${weigh.litres} L (${weigh.kilograms} kg)`,
      loggedBy: 'Hišnik',
      source: 'caretaker',
      eventType: 'weigh-morning',
      occurredAt: now,
    })
    // Fill from warehouse → stock −fill.
    await tx.insert(fuelLog).values({
      id: newId('fuel'),
      type: 'refuel',
      litres: fill.litres,
      inputUnit: fill.inputUnit,
      inputQty: fill.inputQty,
      canSizeL: null,
      boat: 'odyssey-iii',
      costAr: null,
      note: `Hišnik · natočeno iz zaloge · ${fill.litres} L → skupaj ${afterLitres} L`,
      loggedBy: 'Hišnik',
      source: 'caretaker',
      eventType: 'fill-issue',
      occurredAt: new Date(now.getTime() + 1000),
    })
    await tx
      .update(caretakerCans)
      .set({
        location: 'with_skipper',
        lastLitres: afterLitres,
        lastKilograms: afterKg,
        issuedLitres: afterLitres,
        issuedKilograms: afterKg,
        issuedAt: now,
        lastWeighedAt: now,
        updatedAt: now,
      })
      .where(eq(caretakerCans.id, III_CAN_ID))
  })

  revalidatePath('/admin/fuel')
  revalidatePath('/admin')
  revalidatePath('/hisnik')
  return getHisnikState()
}

/** Convert helper for the UI (server-trusted density). */
export async function hisnikConvert(input: {
  from: HisnikUnit
  qty: number
}): Promise<{ litres: number; kilograms: number; densityKgPerL: number }> {
  await assertCaretaker()
  await ensureHisnikSchema()
  const density = await getDensity()
  const q = Math.abs(Number(input.qty)) || 0
  if (input.from === 'kg') {
    const litres = round1(litresFromKg(q, density))
    return { litres, kilograms: round1(q), densityKgPerL: density }
  }
  const litres = round1(q)
  return {
    litres,
    kilograms: round1(kgFromLitres(litres, density)),
    densityKgPerL: density,
  }
}
