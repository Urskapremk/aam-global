'use client'

import { useState } from 'react'
import { Loader2, Lock, Plus, Trash2 } from 'lucide-react'

import {
  saveVoyageJournalDraft,
  validateVoyageJournal,
  type JournalPatch,
} from '@/app/actions/voyage-journal'
import {
  fuelConsumption,
  NO_INCIDENT_TEXT,
  PURPOSES,
  SEA_OPTIONS,
  WEATHER_OPTIONS,
  WIND_OPTIONS,
  type CrewMember,
  type PassengerRow,
  type VoyageJournalRow,
} from '@/lib/voyage-journal'
import { cn } from '@/lib/utils'

const labelCls =
  'text-[10px] font-medium uppercase tracking-[0.12em] text-muted-foreground'
const inputCls =
  'mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground'

/** French label with a small English gloss underneath. */
function FieldLabel({ fr, en }: { fr: string; en: string }) {
  return (
    <span className={labelCls}>
      {fr}
      <span className="ml-1.5 font-normal normal-case tracking-normal text-muted-foreground/60">
        {en}
      </span>
    </span>
  )
}

function SectionTitle({
  n,
  fr,
  en,
}: {
  n: number
  fr: string
  en: string
}) {
  return (
    <div className="border-b border-border pb-2">
      <p className="font-serif text-lg text-foreground">
        <span className="mr-2 text-muted-foreground">{n}.</span>
        {fr}
      </p>
      <p className="text-xs text-muted-foreground">{en}</p>
    </div>
  )
}

export function VoyageJournalForm({
  entry,
  onChanged,
}: {
  entry: VoyageJournalRow
  onChanged: () => void
}) {
  const locked = entry.locked
  const [busy, setBusy] = useState(false)
  const [validating, setValidating] = useState(false)

  // Section 2
  const [voyageDate, setVoyageDate] = useState(entry.voyageDate ?? '')
  const [departureLocation, setDepartureLocation] = useState(
    entry.departureLocation ?? '',
  )
  const [departureTime, setDepartureTime] = useState(entry.departureTime ?? '')
  const [destination, setDestination] = useState(entry.destination ?? '')
  const [stopovers, setStopovers] = useState(entry.stopovers ?? '')
  const [arrivalLocation, setArrivalLocation] = useState(
    entry.arrivalLocation ?? '',
  )
  const [arrivalDate, setArrivalDate] = useState(entry.arrivalDate ?? '')
  const [arrivalTime, setArrivalTime] = useState(entry.arrivalTime ?? '')
  const [purpose, setPurpose] = useState(entry.purpose ?? '')
  const [purposeOther, setPurposeOther] = useState(entry.purposeOther ?? '')

  // Section 3
  const [captainName, setCaptainName] = useState(entry.captainName ?? '')
  const [captainLicense, setCaptainLicense] = useState(
    entry.captainLicense ?? '',
  )
  const [crew, setCrew] = useState<CrewMember[]>(entry.crew ?? [])

  // Section 4
  const [passengerCount, setPassengerCount] = useState(
    entry.passengerCount != null ? String(entry.passengerCount) : '',
  )
  const [passengers, setPassengers] = useState<PassengerRow[]>(
    entry.passengers ?? [],
  )

  // Section 5
  const [weather, setWeather] = useState(entry.weather ?? '')
  const [seaState, setSeaState] = useState(entry.seaState ?? '')
  const [wind, setWind] = useState(entry.wind ?? '')
  const [navigationZone, setNavigationZone] = useState(
    entry.navigationZone ?? '',
  )

  // Section 6
  const [fuelDepart, setFuelDepart] = useState(
    entry.fuelDepart != null ? String(entry.fuelDepart) : '',
  )
  const [fuelAdded, setFuelAdded] = useState(
    entry.fuelAdded != null ? String(entry.fuelAdded) : '',
  )
  const [fuelArrival, setFuelArrival] = useState(
    entry.fuelArrival != null ? String(entry.fuelArrival) : '',
  )
  const [fuelObservations, setFuelObservations] = useState(
    entry.fuelObservations ?? '',
  )

  // Section 7
  const [noIncident, setNoIncident] = useState(entry.noIncident)
  const [eventsText, setEventsText] = useState(entry.eventsText ?? '')

  // Section 8
  const [certifiedBy, setCertifiedBy] = useState(
    entry.certifiedBy ?? entry.captainName ?? '',
  )

  const num = (s: string): number | null => {
    if (s.trim() === '') return null
    const n = Number(s.replace(',', '.'))
    return Number.isFinite(n) ? n : null
  }

  const consumption = fuelConsumption(
    num(fuelDepart),
    num(fuelAdded),
    num(fuelArrival),
  )

  function collect(): JournalPatch {
    return {
      voyageDate: voyageDate || null,
      departureLocation: departureLocation || null,
      departureTime: departureTime || null,
      destination: destination || null,
      stopovers: stopovers || null,
      arrivalLocation: arrivalLocation || null,
      arrivalDate: arrivalDate || null,
      arrivalTime: arrivalTime || null,
      purpose: purpose || null,
      purposeOther: purpose === 'autre' ? purposeOther || null : null,
      captainName: captainName || null,
      captainLicense: captainLicense || null,
      crew,
      passengerCount: num(passengerCount),
      passengers,
      weather: weather || null,
      seaState: seaState || null,
      wind: wind || null,
      navigationZone: navigationZone || null,
      fuelDepart: num(fuelDepart),
      fuelAdded: num(fuelAdded),
      fuelArrival: num(fuelArrival),
      fuelObservations: fuelObservations || null,
      eventsText: noIncident ? NO_INCIDENT_TEXT : eventsText || null,
      noIncident,
    }
  }

  async function save() {
    setBusy(true)
    try {
      await saveVoyageJournalDraft(entry.id, collect())
      onChanged()
    } finally {
      setBusy(false)
    }
  }

  async function validate() {
    if (!certifiedBy.trim()) {
      alert('Nom du capitaine requis pour valider. / Captain name required.')
      return
    }
    if (
      !confirm(
        'Après validation, cette entrée du journal de bord sera verrouillée et ne pourra plus être modifiée.\n\nAfter validation, this logbook entry will be locked and can no longer be edited.',
      )
    )
      return
    setValidating(true)
    try {
      // Persist the current form first, then lock.
      await saveVoyageJournalDraft(entry.id, collect())
      await validateVoyageJournal(entry.id, {
        certifiedBy: certifiedBy.trim(),
        captainId: entry.captainId,
      })
      onChanged()
    } finally {
      setValidating(false)
    }
  }

  return (
    <div className="flex flex-col gap-8">
      {locked && (
        <div className="flex items-center gap-2 rounded-lg border border-[#8f6d3a]/40 bg-[#8f6d3a]/10 p-3 text-sm text-[#8f6d3a] dark:border-[#e0b877]/40 dark:bg-[#e0b877]/10 dark:text-[#e0b877]">
          <Lock className="h-4 w-4 flex-shrink-0" aria-hidden />
          <span>
            Voyage validé et verrouillé — lecture seule.{' '}
            <span className="opacity-70">
              Validated and locked — read only. Use a rectificatif to add a
              correction.
            </span>
          </span>
        </div>
      )}

      {/* Section 2 */}
      <section className="flex flex-col gap-4">
        <SectionTitle n={2} fr="Informations sur le voyage" en="Voyage information" />
        <div className="grid gap-4 sm:grid-cols-3">
          <label>
            <FieldLabel fr="Date du voyage" en="Voyage date" />
            <input
              type="date"
              value={voyageDate}
              onChange={(e) => setVoyageDate(e.target.value)}
              disabled={locked}
              className={inputCls}
            />
          </label>
          <label>
            <FieldLabel fr="Lieu / Port de départ" en="Departure port" />
            <input
              value={departureLocation}
              onChange={(e) => setDepartureLocation(e.target.value)}
              disabled={locked}
              className={inputCls}
            />
          </label>
          <label>
            <FieldLabel fr="Heure de départ" en="Departure time" />
            <input
              type="time"
              value={departureTime}
              onChange={(e) => setDepartureTime(e.target.value)}
              disabled={locked}
              className={inputCls}
            />
          </label>
          <label>
            <FieldLabel fr="Destination" en="Destination" />
            <input
              value={destination}
              onChange={(e) => setDestination(e.target.value)}
              disabled={locked}
              className={inputCls}
            />
          </label>
          <label>
            <FieldLabel fr="Escales / Ports visités" en="Stopovers" />
            <input
              value={stopovers}
              onChange={(e) => setStopovers(e.target.value)}
              disabled={locked}
              className={inputCls}
            />
          </label>
          <div className="hidden sm:block" />
          <label>
            <FieldLabel fr="Lieu / Port d'arrivée" en="Arrival port" />
            <input
              value={arrivalLocation}
              onChange={(e) => setArrivalLocation(e.target.value)}
              disabled={locked}
              className={inputCls}
            />
          </label>
          <label>
            <FieldLabel fr="Date d'arrivée" en="Arrival date" />
            <input
              type="date"
              value={arrivalDate}
              onChange={(e) => setArrivalDate(e.target.value)}
              disabled={locked}
              className={inputCls}
            />
          </label>
          <label>
            <FieldLabel fr="Heure d'arrivée" en="Arrival time" />
            <input
              type="time"
              value={arrivalTime}
              onChange={(e) => setArrivalTime(e.target.value)}
              disabled={locked}
              className={inputCls}
            />
          </label>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <label>
            <FieldLabel fr="Objet du voyage" en="Purpose of voyage" />
            <select
              value={purpose}
              onChange={(e) => setPurpose(e.target.value)}
              disabled={locked}
              className={inputCls}
            >
              <option value="">—</option>
              {PURPOSES.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.fr} · {p.en}
                </option>
              ))}
            </select>
          </label>
          {purpose === 'autre' && (
            <label>
              <FieldLabel fr="Préciser" en="Specify" />
              <input
                value={purposeOther}
                onChange={(e) => setPurposeOther(e.target.value)}
                disabled={locked}
                className={inputCls}
              />
            </label>
          )}
        </div>
      </section>

      {/* Section 3 */}
      <section className="flex flex-col gap-4">
        <SectionTitle n={3} fr="Capitaine et équipage" en="Captain and crew" />
        <div className="grid gap-4 sm:grid-cols-2">
          <label>
            <FieldLabel fr="Capitaine — Nom et prénom" en="Captain — full name" />
            <input
              value={captainName}
              onChange={(e) => setCaptainName(e.target.value)}
              disabled={locked}
              className={inputCls}
            />
          </label>
          <label>
            <FieldLabel fr="N° brevet / licence" en="Licence no. (if any)" />
            <input
              value={captainLicense}
              onChange={(e) => setCaptainLicense(e.target.value)}
              disabled={locked}
              className={inputCls}
            />
          </label>
        </div>
        <div className="flex flex-col gap-2">
          <FieldLabel fr="Équipage" en="Crew members" />
          {crew.map((c, i) => (
            <div key={i} className="flex items-center gap-2">
              <input
                value={c.name}
                onChange={(e) =>
                  setCrew((p) =>
                    p.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)),
                  )
                }
                placeholder="Nom et prénom · Full name"
                disabled={locked}
                className="min-h-11 min-w-0 flex-1 rounded-lg border border-border bg-background px-3 text-sm text-foreground"
              />
              <input
                value={c.role}
                onChange={(e) =>
                  setCrew((p) =>
                    p.map((x, j) => (j === i ? { ...x, role: e.target.value } : x)),
                  )
                }
                placeholder="Fonction · Role"
                disabled={locked}
                className="min-h-11 w-40 flex-shrink-0 rounded-lg border border-border bg-background px-3 text-sm text-foreground"
              />
              {!locked && (
                <button
                  type="button"
                  onClick={() => setCrew((p) => p.filter((_, j) => j !== i))}
                  aria-label="Retirer / Remove"
                  className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:text-[#b0203a] dark:hover:text-[#f0a8b4]"
                >
                  <Trash2 className="h-4 w-4" aria-hidden />
                </button>
              )}
            </div>
          ))}
          {!locked && (
            <button
              type="button"
              onClick={() => setCrew((p) => [...p, { name: '', role: '' }])}
              className="flex min-h-11 w-fit items-center gap-1.5 rounded-full border border-border px-4 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground transition-colors hover:bg-secondary"
            >
              <Plus className="h-3.5 w-3.5" aria-hidden />
              Ajouter un membre · Add crew
            </button>
          )}
          <p className="text-xs text-muted-foreground">
            Nombre total de membres d&apos;équipage ·{' '}
            <span className="text-foreground">
              {crew.filter((c) => c.name.trim()).length}
            </span>
          </p>
        </div>
      </section>

      {/* Section 4 */}
      <section className="flex flex-col gap-4">
        <SectionTitle n={4} fr="Passagers" en="Passengers" />
        <label className="max-w-xs">
          <FieldLabel fr="Nombre de passagers" en="Number of passengers" />
          <input
            type="number"
            min={0}
            value={passengerCount}
            onChange={(e) => setPassengerCount(e.target.value)}
            disabled={locked}
            className={inputCls}
          />
        </label>
        <div className="flex flex-col gap-2">
          <p className="text-xs text-muted-foreground">
            Liste des passagers (optionnelle) · Passenger list (optional)
          </p>
          {passengers.map((p, i) => (
            <div key={i} className="flex items-center gap-2">
              <input
                value={p.name}
                onChange={(e) =>
                  setPassengers((prev) =>
                    prev.map((x, j) =>
                      j === i ? { ...x, name: e.target.value } : x,
                    ),
                  )
                }
                placeholder="Nom et prénom · Full name"
                disabled={locked}
                className="min-h-11 min-w-0 flex-1 rounded-lg border border-border bg-background px-3 text-sm text-foreground"
              />
              <input
                value={p.nationality}
                onChange={(e) =>
                  setPassengers((prev) =>
                    prev.map((x, j) =>
                      j === i ? { ...x, nationality: e.target.value } : x,
                    ),
                  )
                }
                placeholder="Nationalité · Nationality"
                disabled={locked}
                className="min-h-11 w-40 flex-shrink-0 rounded-lg border border-border bg-background px-3 text-sm text-foreground"
              />
              {!locked && (
                <button
                  type="button"
                  onClick={() =>
                    setPassengers((prev) => prev.filter((_, j) => j !== i))
                  }
                  aria-label="Retirer / Remove"
                  className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:text-[#b0203a] dark:hover:text-[#f0a8b4]"
                >
                  <Trash2 className="h-4 w-4" aria-hidden />
                </button>
              )}
            </div>
          ))}
          {!locked && (
            <button
              type="button"
              onClick={() =>
                setPassengers((p) => [...p, { name: '', nationality: '' }])
              }
              className="flex min-h-11 w-fit items-center gap-1.5 rounded-full border border-border px-4 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground transition-colors hover:bg-secondary"
            >
              <Plus className="h-3.5 w-3.5" aria-hidden />
              Ajouter un passager · Add passenger
            </button>
          )}
        </div>
      </section>

      {/* Section 5 */}
      <section className="flex flex-col gap-4">
        <SectionTitle n={5} fr="Conditions de navigation" en="Navigation conditions" />
        <div className="grid gap-4 sm:grid-cols-3">
          <label>
            <FieldLabel fr="Météo" en="Weather" />
            <select
              value={weather}
              onChange={(e) => setWeather(e.target.value)}
              disabled={locked}
              className={inputCls}
            >
              <option value="">—</option>
              {WEATHER_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.fr} · {o.en}
                </option>
              ))}
            </select>
          </label>
          <label>
            <FieldLabel fr="État de la mer" en="Sea state" />
            <select
              value={seaState}
              onChange={(e) => setSeaState(e.target.value)}
              disabled={locked}
              className={inputCls}
            >
              <option value="">—</option>
              {SEA_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.fr} · {o.en}
                </option>
              ))}
            </select>
          </label>
          <label>
            <FieldLabel fr="Vent" en="Wind" />
            <select
              value={wind}
              onChange={(e) => setWind(e.target.value)}
              disabled={locked}
              className={inputCls}
            >
              <option value="">—</option>
              {WIND_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.fr} · {o.en}
                </option>
              ))}
            </select>
          </label>
        </div>
        <label>
          <FieldLabel fr="Zone / itinéraire de navigation" en="Navigation zone / route" />
          <textarea
            value={navigationZone}
            onChange={(e) => setNavigationZone(e.target.value)}
            disabled={locked}
            rows={2}
            className={inputCls}
          />
        </label>
      </section>

      {/* Section 6 */}
      <section className="flex flex-col gap-4">
        <SectionTitle n={6} fr="Carburant" en="Fuel (litres)" />
        <div className="grid gap-4 sm:grid-cols-3">
          <label>
            <FieldLabel fr="Carburant au départ" en="At departure" />
            <input
              inputMode="decimal"
              value={fuelDepart}
              onChange={(e) => setFuelDepart(e.target.value)}
              disabled={locked}
              className={inputCls}
            />
          </label>
          <label>
            <FieldLabel fr="Carburant ajouté" en="Added during voyage" />
            <input
              inputMode="decimal"
              value={fuelAdded}
              onChange={(e) => setFuelAdded(e.target.value)}
              disabled={locked}
              className={inputCls}
            />
          </label>
          <label>
            <FieldLabel fr="Carburant à l'arrivée" en="At arrival" />
            <input
              inputMode="decimal"
              value={fuelArrival}
              onChange={(e) => setFuelArrival(e.target.value)}
              disabled={locked}
              className={inputCls}
            />
          </label>
        </div>
        <div className="rounded-lg border border-border bg-muted/40 p-3">
          <p className={labelCls}>Consommation · Consumption</p>
          <p className="mt-1 text-lg font-light tabular-nums text-foreground">
            {consumption != null ? `${consumption} L` : '—'}
          </p>
        </div>
        <label>
          <FieldLabel fr="Observations carburant" en="Fuel observations" />
          <textarea
            value={fuelObservations}
            onChange={(e) => setFuelObservations(e.target.value)}
            disabled={locked}
            rows={2}
            className={inputCls}
          />
        </label>
      </section>

      {/* Section 7 */}
      <section className="flex flex-col gap-4">
        <SectionTitle
          n={7}
          fr="Événements, incidents et observations"
          en="Events, incidents and observations"
        />
        <label className="flex items-center gap-2 text-sm text-foreground">
          <input
            type="checkbox"
            checked={noIncident}
            onChange={(e) => setNoIncident(e.target.checked)}
            disabled={locked}
            className="h-4 w-4"
          />
          Aucun incident ou événement particulier à signaler.{' '}
          <span className="text-muted-foreground">(No incident to report.)</span>
        </label>
        {!noIncident && (
          <textarea
            value={eventsText}
            onChange={(e) => setEventsText(e.target.value)}
            disabled={locked}
            rows={5}
            placeholder="Incidents, pannes, changements de route, météo, assistance, événements médicaux, retards…"
            className={inputCls}
          />
        )}
      </section>

      {/* Section 8 */}
      <section className="flex flex-col gap-4">
        <SectionTitle n={8} fr="Validation du capitaine" en="Captain validation" />
        <p className="text-sm text-foreground">
          Je certifie l&apos;exactitude des informations consignées dans le
          présent journal de bord.
        </p>
        <p className="text-xs text-muted-foreground">
          I certify the accuracy of the information recorded in this logbook.
        </p>
        <label className="max-w-md">
          <FieldLabel fr="Capitaine — Nom et prénom" en="Captain — full name" />
          <input
            value={certifiedBy}
            onChange={(e) => setCertifiedBy(e.target.value)}
            disabled={locked}
            className={inputCls}
          />
        </label>
        {locked && entry.validatedAt && (
          <p className="text-xs text-muted-foreground">
            Validé le {new Date(entry.validatedAt).toLocaleString('fr-FR')} ·{' '}
            {entry.certifiedBy}
          </p>
        )}

        {!locked && (
          <>
            <div className="rounded-lg border border-[#b0203a]/25 bg-[#b0203a]/[0.06] p-3 text-sm text-[#8f1a2f] dark:text-[#f0a8b4]">
              Après validation, cette entrée du journal de bord sera verrouillée
              et ne pourra plus être modifiée.
              <span className="mt-1 block text-xs opacity-70">
                After validation this entry is locked and can no longer be
                edited.
              </span>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={save}
                disabled={busy || validating}
                className="flex min-h-11 items-center gap-2 rounded-full border border-border px-5 text-[11px] font-semibold uppercase tracking-[0.14em] text-foreground transition-colors hover:bg-secondary disabled:opacity-50"
              >
                {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
                Enregistrer le brouillon · Save draft
              </button>
              <button
                type="button"
                onClick={validate}
                disabled={busy || validating}
                className={cn(
                  'flex min-h-11 items-center gap-2 rounded-full bg-accent px-5 text-[11px] font-semibold uppercase tracking-[0.14em] text-accent-foreground disabled:opacity-50',
                )}
              >
                {validating && (
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                )}
                <Lock className="h-3.5 w-3.5" aria-hidden />
                Valider et clôturer le voyage
              </button>
            </div>
          </>
        )}
      </section>
    </div>
  )
}
