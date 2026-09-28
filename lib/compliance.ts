// Shared config and pure helpers for the Compliance & Logbooks module.
// Kept free of server-only imports so both server actions and client
// components can use the labels and the expiry maths.

export const DOC_CATEGORIES = [
  { id: 'registration', label: 'Registration' },
  { id: 'permis-navigation', label: 'Permis de navigation' },
  { id: 'role-equipage', label: "Rôle d'équipage" },
  { id: 'bon-partance', label: 'Bon de partance' },
  { id: 'fishing-licence', label: 'Fishing licence' },
  { id: 'fishing-authorization', label: 'Fishing authorization' },
  { id: 'insurance', label: 'Insurance' },
  { id: 'safety-inspection', label: 'Safety inspection' },
  { id: 'radio-licence', label: 'Radio licence' },
  { id: 'captain-licence', label: 'Captain licence' },
  { id: 'other', label: 'Other' },
] as const

export type DocCategory = (typeof DOC_CATEGORIES)[number]['id']

export function docCategoryLabel(id: string): string {
  return DOC_CATEGORIES.find((c) => c.id === id)?.label ?? id
}

// The document types the compliance dashboard summarises per vessel, in the
// order the spec lists them. Others (radio licence, bon de partance…) still
// live in the register but do not gate the top-line status.
export const CORE_DOC_CATEGORIES: DocCategory[] = [
  'permis-navigation',
  'role-equipage',
  'fishing-licence',
  'insurance',
  'safety-inspection',
]

export type ComplianceStatus =
  | 'valid'
  | 'expiring'
  | 'expired'
  | 'suspended'
  | 'missing'
  | 'pending'

export const STATUS_LABEL: Record<ComplianceStatus, string> = {
  valid: 'Valid',
  expiring: 'Expiring',
  expired: 'Expired',
  suspended: 'Suspended',
  missing: 'Missing',
  pending: 'Pending',
}

// Expiry alert thresholds, from the spec. A document inside the widest window
// reads as "expiring"; past its date, "expired".
export const EXPIRY_ALERT_DAYS = [90, 60, 30, 14, 7] as const
const EXPIRING_WINDOW_DAYS = 30

// Whole days from today (lodge-local, UTC+3) until the given calendar date.
// Negative once the date has passed. Date-only maths on the YYYY-MM-DD string
// so a timezone conversion can never shift the day either way.
export function daysUntil(dateStr: string | null | undefined): number | null {
  if (!dateStr) return null
  const target = String(dateStr).slice(0, 10)
  const [y, m, d] = target.split('-').map(Number)
  if (!y || !m || !d) return null
  const targetUtc = Date.UTC(y, m - 1, d)
  const now = new Date()
  // Lodge day: shift to UTC+3 before truncating to a calendar day.
  const lodge = new Date(now.getTime() + 3 * 3600 * 1000)
  const todayUtc = Date.UTC(
    lodge.getUTCFullYear(),
    lodge.getUTCMonth(),
    lodge.getUTCDate(),
  )
  return Math.round((targetUtc - todayUtc) / (24 * 3600 * 1000))
}

// The status actually shown: a suspended/missing document keeps its stored
// state, everything else is derived from the expiry date so a row that nobody
// has touched still goes amber then red on its own.
export function effectiveStatus(doc: {
  status?: string | null
  expiryDate?: string | null
}): ComplianceStatus {
  const stored = (doc.status ?? 'valid') as ComplianceStatus
  if (stored === 'suspended' || stored === 'missing' || stored === 'pending') {
    return stored
  }
  const days = daysUntil(doc.expiryDate)
  if (days === null) return stored === 'expired' ? 'expired' : 'valid'
  if (days < 0) return 'expired'
  if (days <= EXPIRING_WINDOW_DAYS) return 'expiring'
  return 'valid'
}

// Rank for rolling several documents up into one vessel headline: the worst
// wins. `missing` is deliberately as bad as `expired` — a document that was
// never filed is not better than one that lapsed.
const STATUS_RANK: Record<ComplianceStatus, number> = {
  valid: 0,
  pending: 1,
  expiring: 2,
  suspended: 3,
  expired: 4,
  missing: 4,
}

export function worstStatus(list: ComplianceStatus[]): ComplianceStatus {
  return list.reduce<ComplianceStatus>(
    (worst, s) => (STATUS_RANK[s] > STATUS_RANK[worst] ? s : worst),
    'valid',
  )
}

// Tailwind class pairs for a status pill. Sage / amber / bordo are the
// project's established semantic trio; these are the sand-card variants (dark
// ink text on a tinted chip) so they read on the pale compliance cards.
export function statusChip(status: ComplianceStatus): {
  bg: string
  text: string
  dot: string
} {
  switch (status) {
    case 'valid':
      return { bg: 'bg-[#4f7a54]/12', text: 'text-[#3a5c3f]', dot: 'bg-[#4f7a54]' }
    case 'expiring':
      return { bg: 'bg-[#8f6d3a]/14', text: 'text-[#7d5f31]', dot: 'bg-[#8f6d3a]' }
    case 'pending':
      return { bg: 'bg-[#1f6f96]/12', text: 'text-[#1a5c7d]', dot: 'bg-[#1f6f96]' }
    case 'suspended':
    case 'expired':
    case 'missing':
    default:
      return { bg: 'bg-[#b0203a]/12', text: 'text-[#8f1a2f]', dot: 'bg-[#b0203a]' }
  }
}

// A short human phrase for how far off an expiry is, e.g. "in 21 days",
// "expired 4 days ago", "today".
export function expiryPhrase(dateStr: string | null | undefined): string | null {
  const days = daysUntil(dateStr)
  if (days === null) return null
  if (days === 0) return 'expires today'
  if (days < 0) {
    const n = Math.abs(days)
    return `expired ${n} day${n === 1 ? '' : 's'} ago`
  }
  return `in ${days} day${days === 1 ? '' : 's'}`
}

// --- Journal de bord (voyage logbook) --------------------------------------

// Voyage purpose. Maps the operational `trips.purpose` onto the regulatory
// vocabulary the logbook must show.
export const VOYAGE_PURPOSES = [
  { id: 'fishing', label: 'Fishing' },
  { id: 'transfer', label: 'Passenger transport' },
  { id: 'charter', label: 'Charter' },
  { id: 'excursion', label: 'Excursion' },
  { id: 'supply', label: 'Supply' },
  { id: 'maintenance', label: 'Maintenance / test' },
  { id: 'other', label: 'Other' },
] as const

export function voyagePurposeLabel(id: string | null | undefined): string {
  return VOYAGE_PURPOSES.find((p) => p.id === id)?.label ?? 'Other'
}

// Significant events that can happen on a voyage. Order is roughly
// least-to-most serious so the picker reads sensibly.
export const VOYAGE_EVENT_TYPES = [
  { id: 'weather', label: 'Weather deterioration' },
  { id: 'strong-wind', label: 'Strong wind' },
  { id: 'heavy-sea', label: 'Heavy sea' },
  { id: 'navigation-hazard', label: 'Navigation hazard' },
  { id: 'mechanical', label: 'Mechanical problem' },
  { id: 'engine-failure', label: 'Engine failure' },
  { id: 'medical', label: 'Medical incident' },
  { id: 'passenger-incident', label: 'Passenger incident' },
  { id: 'collision', label: 'Collision' },
  { id: 'grounding', label: 'Grounding' },
  { id: 'assistance', label: 'Assistance to another vessel' },
  { id: 'emergency', label: 'Emergency' },
  { id: 'forced-landing', label: 'Forced landing / emergency port entry' },
  { id: 'other', label: 'Other significant event' },
] as const

export function voyageEventLabel(id: string | null | undefined): string {
  return VOYAGE_EVENT_TYPES.find((e) => e.id === id)?.label ?? 'Event'
}

// Reasons for an unscheduled / force-majeure port entry.
export const UNSCHEDULED_REASONS = [
  { id: 'weather', label: 'Weather' },
  { id: 'mechanical', label: 'Mechanical failure' },
  { id: 'medical', label: 'Medical emergency' },
  { id: 'safety', label: 'Safety' },
  { id: 'fuel', label: 'Fuel' },
  { id: 'navigation', label: 'Navigation problem' },
  { id: 'passenger', label: 'Passenger emergency' },
  { id: 'force-majeure', label: 'Force majeure' },
  { id: 'other', label: 'Other' },
] as const

// Authorities that might be notified of an unscheduled entry.
export const NOTIFY_AUTHORITIES = [
  { id: 'marine', label: 'Marine authority' },
  { id: 'gendarmerie', label: 'Gendarmerie' },
  { id: 'police', label: 'Police' },
  { id: 'mayor', label: 'Mayor' },
  { id: 'customs', label: 'Customs' },
  { id: 'other', label: 'Other' },
] as const

// Official validation status: a record only that the logbook was presented to
// an authority — NOT an official state visa (spec is explicit).
export type OfficialStatus =
  | 'not-required'
  | 'to-present'
  | 'presented'
  | 'validated'

export const OFFICIAL_STATUS_LABEL: Record<OfficialStatus, string> = {
  'not-required': 'Not required',
  'to-present': 'To be presented',
  presented: 'Presented',
  validated: 'Validated / visa obtained',
}

// Persons on board = captain (always 1) + crew + passengers.
export function personsOnBoard(
  crewCount: number | null | undefined,
  passengerCount: number | null | undefined,
): number {
  return 1 + (crewCount ?? 0) + (passengerCount ?? 0)
}

// --- Journal de peche (fishing logbook) ------------------------------------

export const FISHING_METHODS = [
  { id: 'trolling', label: 'Trolling' },
  { id: 'jigging', label: 'Jigging' },
  { id: 'bottom', label: 'Bottom fishing' },
  { id: 'casting', label: 'Casting' },
  { id: 'live-bait', label: 'Live bait' },
  { id: 'handline', label: 'Handline' },
  { id: 'other', label: 'Other' },
] as const

export function fishingMethodLabel(id: string | null | undefined): string {
  return FISHING_METHODS.find((m) => m.id === id)?.label ?? 'Other'
}

// Discard reasons — the regulatory closed list from the spec.
export const DISCARD_REASONS = [
  { id: 'undersized', label: 'Undersized' },
  { id: 'protected', label: 'Protected species' },
  { id: 'damaged', label: 'Damaged' },
  { id: 'unwanted', label: 'Unwanted' },
  { id: 'regulatory', label: 'Regulatory requirement' },
  { id: 'other', label: 'Other' },
] as const

export function discardReasonLabel(id: string | null | undefined): string {
  return DISCARD_REASONS.find((r) => r.id === id)?.label ?? '—'
}

// How a protected-species interaction happened.
export const PROTECTED_INTERACTIONS = [
  { id: 'accidental-catch', label: 'Caught accidentally' },
  { id: 'entangled', label: 'Entangled' },
  { id: 'observed', label: 'Observed only' },
  { id: 'other', label: 'Other' },
] as const

export const PROTECTED_OUTCOMES = [
  { id: 'released', label: 'Released alive' },
  { id: 'died', label: 'Died' },
  { id: 'unknown', label: 'Unknown' },
] as const

// Catch-declaration lifecycle.
export type DeclarationStatus =
  | 'draft'
  | 'ready'
  | 'captain-approved'
  | 'submitted'
  | 'accepted'
  | 'correction-required'

export const DECLARATION_STATUS_LABEL: Record<DeclarationStatus, string> = {
  draft: 'Draft',
  ready: 'Ready for review',
  'captain-approved': 'Captain approved',
  submitted: 'Submitted',
  accepted: 'Accepted',
  'correction-required': 'Correction required',
}

export const DECLARATION_STATUS_TONE: Record<DeclarationStatus, string> = {
  draft: 'border-border bg-muted text-muted-foreground',
  ready: 'border-[#8f6d3a]/40 bg-[#8f6d3a]/10 text-[#8f6d3a]',
  'captain-approved': 'border-[#8f6d3a]/40 bg-[#8f6d3a]/10 text-[#8f6d3a]',
  submitted: 'border-[#1f6f96]/40 bg-[#1f6f96]/10 text-[#1f6f96]',
  accepted: 'border-[#4f7a54]/40 bg-[#4f7a54]/12 text-[#4f7a54]',
  'correction-required': 'border-[#b0203a]/40 bg-[#b0203a]/10 text-[#b0203a]',
}

// Authorities a catch declaration can be submitted to.
export const FISHERIES_AUTHORITIES = [
  { id: 'ministry', label: 'Ministry responsible for Fisheries' },
  { id: 'fisheries-authority', label: 'Fisheries authority' },
  { id: 'csp', label: 'CSP / fisheries monitoring authority' },
  { id: 'other', label: 'Other' },
] as const

// The mandatory transshipment warning shown before any transshipment record.
export const TRANSSHIPMENT_WARNING =
  'Transshipment may be restricted or prohibited under Malagasy fisheries legislation. Verify legal authorization before proceeding.'

// --- Safety, incidents & pre-departure -------------------------------------

// Mandatory safety-equipment categories from the spec.
export const SAFETY_CATEGORIES = [
  { id: 'life-jackets', label: 'Life jackets' },
  { id: 'fire-extinguishers', label: 'Fire extinguishers' },
  { id: 'first-aid', label: 'First aid kit' },
  { id: 'vhf-radio', label: 'VHF / radio' },
  { id: 'gps', label: 'GPS' },
  { id: 'nav-lights', label: 'Navigation lights' },
  { id: 'bilge-pump', label: 'Bilge pump' },
  { id: 'emergency', label: 'Emergency equipment' },
  { id: 'other', label: 'Other' },
] as const

export function safetyCategoryLabel(id: string | null | undefined): string {
  return SAFETY_CATEGORIES.find((c) => c.id === id)?.label ?? 'Other'
}

// Incident / accident categories.
export const INCIDENT_CATEGORIES = [
  { id: 'injury', label: 'Injury' },
  { id: 'medical', label: 'Medical emergency' },
  { id: 'collision', label: 'Collision' },
  { id: 'grounding', label: 'Grounding' },
  { id: 'engine-failure', label: 'Engine failure' },
  { id: 'fire', label: 'Fire' },
  { id: 'man-overboard', label: 'Man overboard' },
  { id: 'weather', label: 'Weather incident' },
  { id: 'passenger', label: 'Passenger incident' },
  { id: 'equipment', label: 'Equipment failure' },
  { id: 'pollution', label: 'Pollution' },
  { id: 'fishing', label: 'Fishing incident' },
  { id: 'other', label: 'Other' },
] as const

export function incidentCategoryLabel(id: string | null | undefined): string {
  return INCIDENT_CATEGORIES.find((c) => c.id === id)?.label ?? 'Other'
}

// Result of the legal & safety pre-departure check.
export type CheckResult = 'green' | 'yellow' | 'red'

export const CHECK_RESULT_LABEL: Record<CheckResult, string> = {
  green: 'Compliance check passed',
  yellow: 'Requires verification',
  red: 'Trip cannot be released',
}

export const CHECK_RESULT_TONE: Record<CheckResult, string> = {
  green: 'border-[#4f7a54]/40 bg-[#4f7a54]/12 text-[#3a5c3f]',
  yellow: 'border-[#8f6d3a]/40 bg-[#8f6d3a]/12 text-[#7d5f31]',
  red: 'border-[#b0203a]/40 bg-[#b0203a]/12 text-[#8f1a2f]',
}

// One line of the pre-departure checklist.
export type CheckItem = {
  key: string
  label: string
  // 'pass' contributes green, 'verify' yellow, 'fail' red, 'n/a' ignored.
  state: 'pass' | 'verify' | 'fail' | 'n/a'
  detail: string | null
}

// Roll a set of check items up into one traffic-light result. Any fail → red,
// else any verify → yellow, else green — the worst line drives the whole gate.
export function rollUpCheck(items: CheckItem[]): CheckResult {
  if (items.some((i) => i.state === 'fail')) return 'red'
  if (items.some((i) => i.state === 'verify')) return 'yellow'
  return 'green'
}
