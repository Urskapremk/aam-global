'use server'

import { and, desc, eq, isNotNull } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'

import { isAdmin } from '@/lib/admin-auth'
import { boatName, BOATS } from '@/lib/boats'
import { db } from '@/lib/db'
import {
  boatEngines,
  maintenanceLog,
  maintenanceTasks,
  trips,
} from '@/lib/db/schema'
import {
  computeDue,
  estimateEngineHours,
  worstState,
  type DueState,
  type TripSpan,
} from '@/lib/maintenance'

async function assertAdmin() {
  if (!(await isAdmin())) throw new Error('Not authorised')
}

const newId = (p: string) =>
  `${p}-${Date.now()}-${Math.random().toString(16).slice(2, 14)}`

const iso = (d: Date | string | null) =>
  d == null ? null : d instanceof Date ? d.toISOString() : String(d)

export type EngineRow = {
  id: string
  boat: string
  boatLabel: string
  label: string
  position: string
  hp: number | null
  serial: string | null
  /** Hand-entered baseline reading, and when it was taken. */
  hoursAt: number | null
  readAt: string | null
  /** Best current figure: metered when known, otherwise estimated. */
  hours: number | null
  /** True when `hours` includes time inferred from trip durations. */
  estimated: boolean
  /** How much of `hours` came from estimation. */
  sinceHours: number
  active: boolean
  notes: string | null
  /** Worst state across this engine's tasks, for the card badge. */
  worst: DueState
}

export type TaskRow = {
  id: string
  boat: string
  boatLabel: string
  engineId: string | null
  engineLabel: string | null
  name: string
  intervalHours: number | null
  intervalDays: number | null
  lastDoneHours: number | null
  lastDoneAt: string | null
  notes: string | null
  active: boolean
  state: DueState
  summary: string
  hoursLeft: number | null
  daysLeft: number | null
  dueAtHours: number | null
  dueAtDate: string | null
  /** Carried through so the UI can mark an estimate as such. */
  estimatedHours: boolean
  currentHours: number | null
  /** Nothing logged yet — the countdown runs from the baseline, not real work. */
  assumed: boolean
}

export type LogRow = {
  id: string
  boat: string
  boatLabel: string
  engineLabel: string | null
  name: string
  doneAt: string
  atHours: number | null
  costAr: number | null
  partsUsed: string | null
  doneBy: string | null
  notes: string | null
}

/**
 * Completed trips are the raw material for the hour estimate. Read once and
 * reused across every engine, rather than queried per engine.
 */
async function tripSpans(): Promise<TripSpan[]> {
  const rows = await db
    .select({
      boat: trips.boat,
      startedAt: trips.startedAt,
      endedAt: trips.endedAt,
      engineHoursStart: trips.engineHoursStart,
      engineHoursEnd: trips.engineHoursEnd,
    })
    .from(trips)
    .where(isNotNull(trips.endedAt))
  return rows as TripSpan[]
}

/**
 * Everything the maintenance page needs, in one round trip: engines with their
 * current hours, tasks with computed due states, and recent work.
 *
 * Due states are derived here on every read and never stored. A stored "due"
 * flag would be wrong the moment a trip is logged, and nobody would know.
 */
export async function getMaintenance() {
  await assertAdmin()

  const [engines, tasks, log, spans] = await Promise.all([
    db.select().from(boatEngines).orderBy(boatEngines.sortOrder),
    db.select().from(maintenanceTasks).orderBy(maintenanceTasks.sortOrder),
    db
      .select()
      .from(maintenanceLog)
      .orderBy(desc(maintenanceLog.doneAt))
      .limit(60),
    tripSpans(),
  ])

  const hoursById = new Map<
    string,
    { hours: number | null; estimated: boolean; sinceHours: number }
  >()
  for (const e of engines) {
    hoursById.set(
      e.id,
      estimateEngineHours(
        { boat: e.boat, hoursAt: e.hoursAt, readAt: e.readAt },
        spans,
      ),
    )
  }

  const engineLabel = new Map(engines.map((e) => [e.id, e.label]))

  const taskRows: TaskRow[] = tasks
    .filter((t) => t.active)
    .map((t) => {
      const h = t.engineId ? hoursById.get(t.engineId) : undefined
      const due = computeDue({
        intervalHours: t.intervalHours,
        intervalDays: t.intervalDays,
        lastDoneHours: t.lastDoneHours,
        lastDoneAt: t.lastDoneAt,
        currentHours: h?.hours ?? null,
      })
      return {
        id: t.id,
        boat: t.boat,
        boatLabel: boatName(t.boat),
        engineId: t.engineId,
        engineLabel: t.engineId ? engineLabel.get(t.engineId) ?? null : null,
        name: t.name,
        intervalHours: t.intervalHours,
        intervalDays: t.intervalDays,
        lastDoneHours: t.lastDoneHours,
        lastDoneAt: iso(t.lastDoneAt),
        notes: t.notes,
        active: t.active,
        state: due.state,
        summary: due.summary,
        assumed: due.assumed,
        hoursLeft: due.hoursLeft,
        daysLeft: due.daysLeft,
        dueAtHours: due.dueAtHours,
        dueAtDate: iso(due.dueAtDate),
        estimatedHours: h?.estimated ?? false,
        currentHours: h?.hours ?? null,
      }
    })

  const engineRows: EngineRow[] = engines.map((e) => {
    const h = hoursById.get(e.id)
    const mine = taskRows.filter((t) => t.engineId === e.id)
    return {
      id: e.id,
      boat: e.boat,
      boatLabel: boatName(e.boat),
      label: e.label,
      position: e.position,
      hp: e.hp,
      serial: e.serial,
      hoursAt: e.hoursAt,
      readAt: iso(e.readAt),
      hours: h?.hours ?? null,
      estimated: h?.estimated ?? false,
      sinceHours: h?.sinceHours ?? 0,
      active: e.active,
      notes: e.notes,
      worst: worstState(mine.map((t) => t.state)),
    }
  })

  const logRows: LogRow[] = log.map((l) => ({
    id: l.id,
    boat: l.boat,
    boatLabel: boatName(l.boat),
    engineLabel: l.engineId ? engineLabel.get(l.engineId) ?? null : null,
    name: l.name,
    doneAt: iso(l.doneAt)!,
    atHours: l.atHours,
    costAr: l.costAr,
    partsUsed: l.partsUsed,
    doneBy: l.doneBy,
    notes: l.notes,
  }))

  // Whole-boat tasks have no engine, so they need their own roll-up for the
  // boat badge — otherwise an overdue hull clean would show as "OK".
  const boats = BOATS.map((b) => {
    const mine = taskRows.filter((t) => t.boat === b.id)
    return {
      id: b.id,
      label: b.name,
      worst: worstState(mine.map((t) => t.state)),
      overdue: mine.filter((t) => t.state === 'overdue').length,
      due: mine.filter((t) => t.state === 'due').length,
      soon: mine.filter((t) => t.state === 'soon').length,
      noBaseline: mine.filter((t) => t.state === 'unknown').length,
    }
  })

  return {
    engines: engineRows,
    tasks: taskRows,
    log: logRows,
    boats,
    worst: worstState(taskRows.map((t) => t.state)),
  }
}

/**
 * Record a real hour-meter reading. This is the anchor the whole estimate hangs
 * off, so it is deliberately a separate, explicit action rather than a field
 * buried in an edit form.
 */
export async function setEngineHours(
  engineId: string,
  hours: number,
  readAt?: string | null,
) {
  await assertAdmin()
  if (!Number.isFinite(hours) || hours < 0) {
    throw new Error('Hours must be a positive number')
  }

  await db
    .update(boatEngines)
    .set({
      hoursAt: hours,
      // Defaults to now: the reading was taken when it was typed in, unless the
      // office is entering one from an older service sheet.
      readAt: readAt ? new Date(readAt) : new Date(),
    })
    .where(eq(boatEngines.id, engineId))

  revalidatePath('/admin/maintenance')
  return { ok: true }
}

export async function saveEngine(input: {
  id?: string | null
  boat: string
  label: string
  position?: string
  hp?: number | null
  serial?: string | null
  notes?: string | null
  active?: boolean
}) {
  await assertAdmin()
  const label = (input.label || '').trim()
  if (!label) throw new Error('Engine needs a label')

  if (input.id) {
    await db
      .update(boatEngines)
      .set({
        boat: input.boat,
        label,
        position: input.position || 'single',
        hp: input.hp ?? null,
        serial: input.serial || null,
        notes: input.notes || null,
        active: input.active ?? true,
      })
      .where(eq(boatEngines.id, input.id))
      revalidatePath('/admin/maintenance')
    return { id: input.id }
  }

  const id = newId('eng')
  await db.insert(boatEngines).values({
    id,
    boat: input.boat,
    label,
    position: input.position || 'single',
    hp: input.hp ?? null,
    serial: input.serial || null,
    notes: input.notes || null,
  })
  revalidatePath('/admin/maintenance')
  return { id }
}

export async function saveTask(input: {
  id?: string | null
  boat: string
  engineId?: string | null
  name: string
  intervalHours?: number | null
  intervalDays?: number | null
  notes?: string | null
  active?: boolean
}) {
  await assertAdmin()
  const name = (input.name || '').trim()
  if (!name) throw new Error('Task needs a name')
  // A task with neither interval can never come due, so it would sit on the
  // page looking supervised while telling nobody anything.
  if (input.intervalHours == null && input.intervalDays == null) {
    throw new Error('Task needs an interval in hours or days')
  }

  const values = {
    boat: input.boat,
    engineId: input.engineId || null,
    name,
    intervalHours: input.intervalHours ?? null,
    intervalDays: input.intervalDays ?? null,
    notes: input.notes || null,
    active: input.active ?? true,
  }

  if (input.id) {
    await db
      .update(maintenanceTasks)
      .set(values)
      .where(eq(maintenanceTasks.id, input.id))
    revalidatePath('/admin/maintenance')
    return { id: input.id }
  }

  const id = newId('mt')
  await db.insert(maintenanceTasks).values({ id, ...values })
  revalidatePath('/admin/maintenance')
  return { id }
}

export async function deleteTask(id: string) {
  await assertAdmin()
  // Retired, not removed: the log rows reference it, and a service history with
  // holes in it is worth less than one that admits a task was discontinued.
  await db
    .update(maintenanceTasks)
    .set({ active: false })
    .where(eq(maintenanceTasks.id, id))
  revalidatePath('/admin/maintenance')
  return { ok: true }
}

/**
 * Mark work as done. Writes the history row AND advances the task's counters in
 * the same call, because a completion that updates one but not the other either
 * loses the record or leaves the job showing overdue forever.
 */
export async function logWork(input: {
  taskId?: string | null
  boat: string
  engineId?: string | null
  name?: string | null
  doneAt?: string | null
  atHours?: number | null
  costAr?: number | null
  partsUsed?: string | null
  doneBy?: string | null
  notes?: string | null
}) {
  await assertAdmin()

  let name = (input.name || '').trim()
  let boat = input.boat
  let engineId = input.engineId ?? null

  if (input.taskId) {
    const rows = await db
      .select()
      .from(maintenanceTasks)
      .where(eq(maintenanceTasks.id, input.taskId))
      .limit(1)
    if (!rows.length) throw new Error('Unknown task')
    const t = rows[0]
    if (!name) name = t.name
    boat = t.boat
    engineId = t.engineId
  }

  if (!name) throw new Error('Work needs a name')

  const doneAt = input.doneAt ? new Date(input.doneAt) : new Date()

  // When the hours were not given, fall back to the current estimate so the
  // next interval is measured from somewhere sensible rather than from null.
  let atHours = input.atHours ?? null
  if (atHours == null && engineId) {
    const [eng] = await db
      .select()
      .from(boatEngines)
      .where(eq(boatEngines.id, engineId))
      .limit(1)
    if (eng) {
      const est = estimateEngineHours(
        { boat: eng.boat, hoursAt: eng.hoursAt, readAt: eng.readAt },
        await tripSpans(),
      )
      atHours = est.hours
    }
  }

  await db.insert(maintenanceLog).values({
    id: newId('ml'),
    boat,
    engineId,
    taskId: input.taskId || null,
    name,
    doneAt,
    atHours,
    costAr: input.costAr ?? null,
    partsUsed: input.partsUsed || null,
    doneBy: input.doneBy || null,
    notes: input.notes || null,
  })

  if (input.taskId) {
    await db
      .update(maintenanceTasks)
      .set({ lastDoneAt: doneAt, lastDoneHours: atHours })
      .where(eq(maintenanceTasks.id, input.taskId))
  }

  revalidatePath('/admin/maintenance')
  revalidatePath('/admin')
  return { ok: true }
}

/**
 * Overdue and due-now items only, for the Command Center.
 *
 * Kept separate from `getMaintenance` so the dashboard does not pull the full
 * task list and log it will never show.
 */
export async function getMaintenanceAlerts() {
  await assertAdmin()
  const { tasks } = await getMaintenance()
  return tasks
    .filter((t) => t.state === 'overdue' || t.state === 'due')
    .sort((a, b) => (a.state === b.state ? 0 : a.state === 'overdue' ? -1 : 1))
    .map((t) => ({
      id: t.id,
      boat: t.boat,
      boatLabel: t.boatLabel,
      label: [t.engineLabel, t.name].filter(Boolean).join(' — '),
      state: t.state,
      summary: t.summary,
    }))
}
