import { pool } from '@/lib/db'

export type FuelSkipper = {
  id: string
  name: string
}

/**
 * Position / role labels that mean “can take fuel for a boat” in admin HR.
 * Mirrors how HR schedule treats captains (role or position), plus skipper spellings.
 */
export const SKIPPER_POSITION_RE =
  /(skipper|skiper|capitaine|kapitan|captain|capitano)/i

/**
 * Owner / admin names that must not appear as operational fuel skippers.
 * Mike Schneider is the lodge owner (Captain Mode / marketing), not a fuel skipper.
 */
const NON_OPERATIONAL_SKIPPER_NAME_RE =
  /^(mike|michael|majk)\s+schneider$/i

export function isSkipperPosition(position: string | null | undefined): boolean {
  return SKIPPER_POSITION_RE.test(String(position ?? '').trim())
}

export function isOperationalSkipperName(name: string): boolean {
  return Boolean(name.trim()) && !NON_OPERATIONAL_SKIPPER_NAME_RE.test(name.trim())
}

/**
 * Skippers for `/hisnik`: same people Špela maintains in Admin → HR (Staff).
 * Read-only SELECT — does not sync/insert from the fleet `captains` table
 * (that list includes the owner for trip logging and is the wrong source here).
 */
export async function listFuelSkippersFromHr(): Promise<FuelSkipper[]> {
  try {
    const { rows } = await pool.query<{ id: string; name: string; role: string; position: string }>(
      `SELECT id, name, role, COALESCE(position, '') AS position
         FROM hr_staff
        WHERE active = true
        ORDER BY name ASC`,
    )
    return rows
      .filter(
        (r) =>
          isOperationalSkipperName(r.name) &&
          (r.role === 'captain' || isSkipperPosition(r.position)),
      )
      .map((r) => ({ id: r.id, name: r.name.trim() }))
  } catch {
    // Table may not exist yet in a fresh DB — picker stays empty / free-text.
    return []
  }
}

export async function resolveFuelSkipperFromHr(input: {
  skipperId?: string | null
  skipperName?: string | null
}): Promise<FuelSkipper> {
  const id = input.skipperId?.trim() || ''
  if (id) {
    try {
      const { rows } = await pool.query<{ id: string; name: string; role: string; position: string; active: boolean }>(
        `SELECT id, name, role, COALESCE(position, '') AS position, active
           FROM hr_staff
          WHERE id = $1
          LIMIT 1`,
        [id],
      )
      const row = rows[0]
      if (
        row &&
        row.active !== false &&
        isOperationalSkipperName(row.name) &&
        (row.role === 'captain' || isSkipperPosition(row.position))
      ) {
        return { id: row.id, name: row.name.trim() }
      }
    } catch {
      // fall through to free-text / error
    }
  }
  const name = input.skipperName?.trim() || ''
  if (name && isOperationalSkipperName(name)) return { id: '', name }
  throw new Error('Select a skipper')
}
