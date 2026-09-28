/**
 * Base location and go/no-go limits for the weather station.
 *
 * These live in a plain module (not in the "use server" action file) because a
 * file with "use server" may only export async functions — exporting a constant
 * from there breaks the whole page at runtime.
 */

export const LODGE = {
  name: 'Nosy Komba',
  latitude: -13.45,
  longitude: 48.34,
  timezone: 'Indian/Antananarivo',
} as const

/**
 * Sea-state thresholds. THE CANONICAL UNIT IS km/h.
 *
 * Read by BOTH the sea-state badge and the ensemble exceedance probability. If
 * you change one place only, the percentage would describe a limit the badge
 * does not use. Switching the display to m/s does not move the judgement,
 * because the comparison always happens in km/h.
 *
 * Limits are set on GUSTS, not mean wind: a boat is knocked over by a gust.
 */
export const SEA_LIMITS = {
  cautionGusts: 33,
  dangerGusts: 46,
  cautionWaves: 1,
  dangerWaves: 1.5,
  /**
   * Wave period, seconds. Below this the sea is CHOPPY even when the waves are
   * low — short, steep seas beat the hull and the guests, which low significant
   * wave height alone never shows. Only counts once there is something to chop
   * (see choppyWaves), otherwise a glassy 0.1 m sea would read as caution.
   */
  choppyPeriod: 4,
  choppyWaves: 0.4,
} as const
