/**
 * Fishing constants and pure helpers.
 *
 * These live outside `app/actions/fishing.ts` because a `"use server"` file may
 * only export async functions — exporting a constant from there breaks the
 * whole page at runtime.
 */

/**
 * Minimum catches before a spot's conditions are presented as a pattern rather
 * than a tally. Five is a judgement, not statistics: low enough to be useful
 * within a first season, high enough that one lucky morning cannot masquerade
 * as a rule. A single catch would otherwise show "100% on a rising tide".
 */
export const MIN_CONFIDENT_CATCHES = 5

export const SPOT_KINDS = [
  { value: 'reef', label: 'Reef' },
  { value: 'dropoff', label: 'Drop-off' },
  { value: 'pinnacle', label: 'Pinnacle' },
  { value: 'wreck', label: 'Wreck' },
  { value: 'fad', label: 'FAD' },
  { value: 'current-line', label: 'Current line' },
  { value: 'other', label: 'Other' },
] as const

export function spotKindLabel(kind: string): string {
  return SPOT_KINDS.find((k) => k.value === kind)?.label ?? 'Other'
}

const METHOD_LABELS: Record<string, string> = {
  trolling: 'Trolling',
  jigging: 'Jigging',
  bottom: 'Bottom fishing',
  casting: 'Casting',
  'live-bait': 'Live bait',
  other: 'Other',
}

export function methodLabel(method: string | null): string | null {
  if (!method) return null
  return METHOD_LABELS[method] ?? method
}

/** "14:00–15:00", the way a captain thinks about a bite window. */
export function hourWindow(hour: number): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${pad(hour)}:00–${pad((hour + 1) % 24)}:00`
}
