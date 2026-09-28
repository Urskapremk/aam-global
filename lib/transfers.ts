// Shared, client-safe config + helpers for the Odyssey II transfer system.
// No server-only imports here — used by both the admin UI and server actions.

export type TransferStatus =
  | 'pending'
  | 'confirmed'
  | 'paid'
  | 'completed'
  | 'cancelled'

export type PaymentMethod = '' | 'cash' | 'bank' | 'orange'

export type PriceType = 'flat' | 'per_person'

export const TRANSFER_STATUSES: { id: TransferStatus; label: string }[] = [
  { id: 'pending', label: 'Pending' },
  { id: 'confirmed', label: 'Confirmed' },
  { id: 'paid', label: 'Paid' },
  { id: 'completed', label: 'Completed' },
  { id: 'cancelled', label: 'Cancelled' },
]

export const STATUS_LABEL: Record<string, string> = Object.fromEntries(
  TRANSFER_STATUSES.map((s) => [s.id, s.label]),
)

export function paymentMethodLabel(m: string): string {
  if (m === 'cash') return 'Cash'
  if (m === 'bank') return 'Bank transfer'
  if (m === 'orange') return 'Orange Money'
  return '—'
}

/**
 * Total price of a transfer for a given route + party size.
 * Flat prices apply once; per-person prices multiply by the number of guests.
 */
export function computeRoutePrice(
  priceEur: number,
  priceType: string,
  pax: number,
): number {
  const n = Math.max(1, Math.round(pax || 1))
  return priceType === 'per_person' ? priceEur * n : priceEur
}

/** Short human label for a route, e.g. "Big Port Nosy Be → Ampangorina". */
export function routeLabel(from: string, to: string): string {
  const f = (from || '').trim()
  const t = (to || '').trim()
  if (f && t) return `${f} → ${t}`
  return f || t || 'Transfer'
}

/**
 * Add minutes to a HH:MM time, returning a HH:MM string (wraps past midnight).
 * Returns '' when the input time is missing or invalid.
 */
export function addMinutesToTime(time: string, minutes: number): string {
  const m = /^(\d{1,2}):(\d{2})$/.exec((time || '').trim())
  if (!m) return ''
  const total = (Number(m[1]) * 60 + Number(m[2]) + Math.round(minutes || 0)) % (24 * 60)
  const norm = (total + 24 * 60) % (24 * 60)
  const hh = Math.floor(norm / 60)
  const mm = norm % 60
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`
}

/** Computed arrival time from departure + trip duration; '' if unknown. */
export function arrivalTime(time: string, durationMin: number): string {
  if (!time || !durationMin || durationMin <= 0) return ''
  return addMinutesToTime(time, durationMin)
}

/** Human label for a trip duration in minutes, e.g. 90 → "1 h 30 min". */
export function formatDuration(minutes: number): string {
  const n = Math.round(minutes || 0)
  if (n <= 0) return ''
  const h = Math.floor(n / 60)
  const m = n % 60
  if (h && m) return `${h} h ${m} min`
  if (h) return `${h} h`
  return `${m} min`
}

/** Format a whole-euro amount, e.g. 60 → "€60". */
export function formatEur(n: number): string {
  return `\u20ac${Math.round(n || 0).toLocaleString('en-GB')}`
}

/** Format a YYYY-MM-DD date as e.g. "Mon, 3 August 2026". */
export function formatTransferDate(ymd: string): string {
  const [y, m, d] = (ymd || '').split('-').map(Number)
  if (!y || !m || !d) return ymd || ''
  return new Date(y, m - 1, d).toLocaleDateString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}
