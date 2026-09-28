/**
 * Shared config, French labels and helpers for the Journal de bord (APMF).
 *
 * A plain module (no "use server"): imported by both the client form and the
 * server actions, so option lists and the voyage-number format live in one
 * place. The official PDF/print is French; the on-screen form shows the French
 * term with an English gloss.
 */

import { boatName } from '@/lib/boats'

/** Armateur / Exploitant printed in the document header. */
export const OPERATOR_NAME = 'AAM Global Group'

export type VoyageStatus = 'brouillon' | 'valide' | 'cloture'

export const STATUS_LABELS: Record<VoyageStatus, { fr: string; en: string }> = {
  brouillon: { fr: 'BROUILLON', en: 'Draft' },
  valide: { fr: 'VALIDÉ', en: 'Validated' },
  cloture: { fr: 'CLÔTURÉ', en: 'Closed' },
}

type Option = { value: string; fr: string; en: string }

export const PURPOSES: Option[] = [
  { value: 'excursion', fr: 'Excursion touristique', en: 'Tourist excursion' },
  { value: 'transfert', fr: 'Transfert de passagers', en: 'Passenger transfer' },
  { value: 'prive', fr: 'Navigation privée', en: 'Private navigation' },
  { value: 'maintenance', fr: 'Maintenance / Essai', en: 'Maintenance / test' },
  { value: 'approvisionnement', fr: 'Approvisionnement', en: 'Supply run' },
  { value: 'autre', fr: 'Autre', en: 'Other' },
]

export const WEATHER_OPTIONS: Option[] = [
  { value: 'beau', fr: 'Beau', en: 'Clear' },
  { value: 'nuageux', fr: 'Nuageux', en: 'Cloudy' },
  { value: 'pluie', fr: 'Pluie', en: 'Rain' },
  { value: 'orage', fr: 'Orage', en: 'Storm' },
  { value: 'autre', fr: 'Autre', en: 'Other' },
]

export const SEA_OPTIONS: Option[] = [
  { value: 'calme', fr: 'Calme', en: 'Calm' },
  { value: 'peu-agitee', fr: 'Peu agitée', en: 'Slight' },
  { value: 'agitee', fr: 'Agitée', en: 'Moderate' },
  { value: 'forte', fr: 'Forte', en: 'Rough' },
]

export const WIND_OPTIONS: Option[] = [
  { value: 'faible', fr: 'Faible', en: 'Light' },
  { value: 'modere', fr: 'Modéré', en: 'Moderate' },
  { value: 'fort', fr: 'Fort', en: 'Strong' },
]

export const NO_INCIDENT_TEXT =
  'Aucun incident ou événement particulier à signaler.'

export function optionLabel(list: Option[], value: string | null | undefined) {
  return list.find((o) => o.value === value)
}

/** Vessel prefix for the voyage number: "odyssey-ii" → "ODYSSEY-II". */
export function voyageNumberPrefix(boat: string): string {
  return boatName(boat).toUpperCase().replace(/\s+/g, '-')
}

/** Format a full voyage number, e.g. ODYSSEY-II-2026-0001. */
export function formatVoyageNumber(boat: string, year: number, seq: number) {
  return `${voyageNumberPrefix(boat)}-${year}-${String(seq).padStart(4, '0')}`
}

/**
 * Fuel consumed = départ + ajouté − arrivée, in litres. Returns null unless all
 * three are present and the result is a sane, non-negative number.
 */
export function fuelConsumption(
  depart: number | null | undefined,
  added: number | null | undefined,
  arrival: number | null | undefined,
): number | null {
  if (depart == null || added == null || arrival == null) return null
  const c = depart + added - arrival
  if (!Number.isFinite(c) || c < 0) return null
  return Math.round(c * 10) / 10
}

export type CrewMember = { name: string; role: string }
export type PassengerRow = { name: string; nationality: string }
export type Rectificatif = {
  id: string
  date: string
  reason: string
  text: string
  addedBy: string
  at: string
}
export type EmailLogEntry = {
  id: string
  to: string
  copyToOperator: boolean
  at: string
  user: string
}

export type VoyageJournalRow = {
  id: string
  boat: string
  boatLabel: string
  voyageNumber: string
  seq: number
  year: number
  status: VoyageStatus
  voyageDate: string | null
  departureLocation: string | null
  departureTime: string | null
  destination: string | null
  stopovers: string | null
  arrivalLocation: string | null
  arrivalDate: string | null
  arrivalTime: string | null
  purpose: string | null
  purposeOther: string | null
  captainName: string | null
  captainLicense: string | null
  crew: CrewMember[]
  passengerCount: number | null
  passengers: PassengerRow[]
  weather: string | null
  seaState: string | null
  wind: string | null
  navigationZone: string | null
  fuelDepart: number | null
  fuelAdded: number | null
  fuelArrival: number | null
  fuelObservations: string | null
  eventsText: string | null
  noIncident: boolean
  certifiedBy: string | null
  validatedAt: string | null
  validatedByUser: string | null
  captainId: string | null
  locked: boolean
  rectificatifs: Rectificatif[]
  emailLog: EmailLogEntry[]
  createdAt: string
  updatedAt: string
}
