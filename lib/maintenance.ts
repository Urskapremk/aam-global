/**
 * Engine-hour estimation and service-due maths.
 *
 * Lives in lib/ rather than in the action so it can be reasoned about (and
 * tested) without a database, and so the UI can use the same thresholds the
 * server uses — two copies of "when is this due" would drift.
 */

/** Status of one service task, worst first. */
export type DueState = 'overdue' | 'due' | 'soon' | 'ok' | 'unknown'

/**
 * How close to the interval counts as "soon". 10 h is roughly one long fishing
 * day on the Odyssey, which is the point at which parts have to be ordered —
 * on Nosy Be an oil filter is not something you fetch the same afternoon.
 */
export const SOON_HOURS = 10

/** Same idea on the calendar: two weeks is enough notice to book a mechanic. */
export const SOON_DAYS = 14

export const DUE_TONE: Record<
  DueState,
  { label: string; fg: string; bg: string; border: string }
> = {
  // Bordeaux / amber / sage / muted: the established meanings in this app.
  overdue: {
    label: 'Overdue',
    fg: '#f0a8b4',
    bg: 'rgba(176,32,58,0.14)',
    border: 'rgba(240,168,180,0.35)',
  },
  due: {
    label: 'Due now',
    fg: '#e0b877',
    bg: 'rgba(168,118,26,0.14)',
    border: 'rgba(224,184,119,0.35)',
  },
  soon: {
    label: 'Soon',
    fg: '#9ecbdd',
    bg: 'rgba(31,111,150,0.14)',
    border: 'rgba(158,203,221,0.30)',
  },
  ok: {
    label: 'OK',
    fg: '#8fae92',
    bg: 'rgba(69,107,73,0.14)',
    border: 'rgba(143,174,146,0.28)',
  },
  unknown: {
    label: 'No baseline',
    fg: '#9b958c',
    bg: 'rgba(155,149,140,0.10)',
    border: 'rgba(155,149,140,0.25)',
  },
}

/** One completed trip, reduced to what the hour estimate needs. */
export type TripSpan = {
  boat: string
  startedAt: Date | string
  endedAt: Date | string | null
  engineHoursStart: number | null
  engineHoursEnd: number | null
}

const ms = (v: Date | string) =>
  v instanceof Date ? v.getTime() : Date.parse(v)

/**
 * Estimate an engine's hour meter now.
 *
 * Preference order matters:
 *  1. A trip that recorded both meter readings is the truth — use the highest
 *     `engineHoursEnd` seen after the baseline reading.
 *  2. Otherwise add up the running time of trips since the baseline.
 *
 * The second is an ESTIMATE and the UI must say so. Wall-clock trip length
 * over-counts (the boat drifts at a spot with engines off) which is the safe
 * direction to be wrong in: it brings a service forward, never delays it.
 *
 * On a twin-engine boat both engines run together, so trip hours apply to each
 * engine equally — this is why hours are not divided between them.
 */
export function estimateEngineHours(
  engine: { boat: string; hoursAt: number | null; readAt: Date | string | null },
  trips: TripSpan[],
): { hours: number | null; estimated: boolean; sinceHours: number } {
  if (engine.hoursAt == null) {
    return { hours: null, estimated: false, sinceHours: 0 }
  }

  const from = engine.readAt ? ms(engine.readAt) : 0
  const mine = trips.filter(
    (t) => t.boat === engine.boat && t.endedAt && ms(t.startedAt) >= from,
  )

  // A logged meter reading beats any estimate.
  let metered: number | null = null
  for (const t of mine) {
    if (t.engineHoursEnd != null && t.engineHoursEnd >= engine.hoursAt) {
      metered = Math.max(metered ?? 0, t.engineHoursEnd)
    }
  }
  if (metered != null) {
    return {
      hours: metered,
      estimated: false,
      sinceHours: Math.max(0, metered - engine.hoursAt),
    }
  }

  let added = 0
  for (const t of mine) {
    // Prefer this trip's own meter delta when it has one.
    if (t.engineHoursStart != null && t.engineHoursEnd != null) {
      const d = t.engineHoursEnd - t.engineHoursStart
      if (d > 0) {
        added += d
        continue
      }
    }
    const d = (ms(t.endedAt as string) - ms(t.startedAt)) / 3_600_000
    // Guard against a trip left open for days and closed from the office: a
    // 40-hour "trip" would silently inflate the meter and hide a real service.
    if (d > 0 && d < 24) added += d
  }

  return {
    hours: engine.hoursAt + added,
    estimated: added > 0,
    sinceHours: added,
  }
}

export type DueInput = {
  intervalHours: number | null
  intervalDays: number | null
  lastDoneHours: number | null
  lastDoneAt: Date | string | null
  /** Estimated or metered hours now; null when the engine has no baseline. */
  currentHours: number | null
}

export type DueResult = {
  state: DueState
  /** Hours left until due; negative means overdue. Null when not hour-based. */
  hoursLeft: number | null
  /** Days left until due; negative means overdue. Null when not date-based. */
  daysLeft: number | null
  dueAtHours: number | null
  dueAtDate: Date | null
  /** Short human line, e.g. "in 32 h" or "18 days overdue". */
  summary: string
  /**
   * True when nothing has ever been logged for this task, so the countdown is
   * measured from the baseline reading rather than from a real service.
   *
   * This matters more than it looks: without it, an engine that was already 60 h
   * past its oil change before this app existed reads as a confident "in 100 h"
   * — green, and wrong in the one direction that costs an engine. The number is
   * still the best available guess, so it is shown, but never as a fact.
   */
  assumed: boolean
}

/**
 * Work out whether a task is due.
 *
 * When a task has both an hour and a day interval, the tighter one governs —
 * that is what "every 100 h or 12 months, whichever comes first" means, and
 * taking the looser one would let an idle engine go years without an oil
 * change.
 */
export function computeDue(t: DueInput, now = new Date()): DueResult {
  // Nothing on record either way: every countdown below is measured from the
  // baseline instead of from real work, which is a guess and has to be labelled.
  const assumed = t.lastDoneHours == null && t.lastDoneAt == null

  let hoursLeft: number | null = null
  let dueAtHours: number | null = null
  if (t.intervalHours != null && t.currentHours != null) {
    // No completion on record yet: measure the interval from the baseline, so a
    // fresh install shows a plausible date instead of "overdue by 1000 h".
    const base = t.lastDoneHours ?? t.currentHours
    dueAtHours = base + t.intervalHours
    hoursLeft = dueAtHours - t.currentHours
  }

  let daysLeft: number | null = null
  let dueAtDate: Date | null = null
  if (t.intervalDays != null) {
    const base = t.lastDoneAt ? new Date(ms(t.lastDoneAt)) : null
    if (base) {
      dueAtDate = new Date(base.getTime() + t.intervalDays * 86_400_000)
      daysLeft = Math.ceil((dueAtDate.getTime() - now.getTime()) / 86_400_000)
    }
  }

  if (hoursLeft == null && daysLeft == null) {
    return {
      state: 'unknown',
      hoursLeft: null,
      daysLeft: null,
      dueAtHours,
      dueAtDate,
      summary:
        t.intervalHours != null
          ? 'Needs an hour-meter reading'
          : 'Needs a first service date',
      assumed,
    }
  }

  const byHours: DueState =
    hoursLeft == null
      ? 'ok'
      : hoursLeft < 0
        ? 'overdue'
        : hoursLeft === 0
          ? 'due'
          : hoursLeft <= SOON_HOURS
            ? 'soon'
            : 'ok'

  const byDays: DueState =
    daysLeft == null
      ? 'ok'
      : daysLeft < 0
        ? 'overdue'
        : daysLeft === 0
          ? 'due'
          : daysLeft <= SOON_DAYS
            ? 'soon'
            : 'ok'

  const rank: DueState[] = ['overdue', 'due', 'soon', 'ok', 'unknown']
  const state =
    rank.indexOf(byHours) < rank.indexOf(byDays) ? byHours : byDays

  // Report whichever measure is driving the state, so the line explains itself.
  let summary: string
  const hDrives = state === byHours && hoursLeft != null
  if (hDrives && hoursLeft != null) {
    const n = Math.round(Math.abs(hoursLeft))
    summary =
      hoursLeft < 0
        ? `${n} h overdue`
        : hoursLeft === 0
          ? 'Due now'
          : `in ${n} h of running`
  } else if (daysLeft != null) {
    const n = Math.abs(daysLeft)
    summary =
      daysLeft < 0
        ? `${n} ${n === 1 ? 'day' : 'days'} overdue`
        : daysLeft === 0
          ? 'Due today'
          : `in ${n} ${n === 1 ? 'day' : 'days'}`
  } else {
    summary = 'OK'
  }

  return {
    state,
    hoursLeft,
    daysLeft,
    dueAtHours,
    dueAtDate,
    summary,
    assumed,
  }
}

/**
 * Worst state across a list, for a boat-level or page-level badge.
 *
 * `unknown` deliberately ranks WORSE than `ok`: a task with no baseline is not
 * being watched at all, and a green "OK" over an unconfigured schedule reads as
 * "nothing to do" — the one conclusion that must never be drawn from it.
 * Inside `computeDue` the order is the opposite, because there `unknown` means
 * "cannot judge this measure" and must not outrank a real overdue.
 */
export function worstState(states: DueState[]): DueState {
  const rank: DueState[] = ['overdue', 'due', 'soon', 'unknown', 'ok']
  let worst: DueState = 'ok'
  for (const s of states) {
    if (rank.indexOf(s) < rank.indexOf(worst)) worst = s
  }
  return worst
}

export function fmtHours(h: number | null): string {
  if (h == null) return '—'
  return `${h.toFixed(1).replace(/\.0$/, '')} h`
}
