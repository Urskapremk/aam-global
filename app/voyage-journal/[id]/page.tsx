import { notFound } from 'next/navigation'
import { BOATS } from '@/lib/boats'
import { getVoyageJournalPublic } from '@/app/actions/voyage-journal'
import {
  OPERATOR_NAME,
  PURPOSES,
  SEA_OPTIONS,
  STATUS_LABELS,
  WEATHER_OPTIONS,
  WIND_OPTIONS,
  fuelConsumption,
  optionLabel,
  type CrewMember,
  type PassengerRow,
  type Rectificatif,
} from '@/lib/voyage-journal'
import { PrintControls } from './print-controls'

export const dynamic = 'force-dynamic'

function fmtDate(v: string | null | undefined) {
  if (!v) return '—'
  const d = new Date(v)
  if (Number.isNaN(d.getTime())) return v
  return d.toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

function fmtDateTime(v: string | null | undefined) {
  if (!v) return '—'
  const d = new Date(v)
  if (Number.isNaN(d.getTime())) return String(v)
  return d.toLocaleString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export default async function VoyageJournalDocument({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ print?: string }>
}) {
  const { id } = await params
  const { print } = await searchParams
  const j = await getVoyageJournalPublic(id)
  if (!j) notFound()

  const boatName = BOATS.find((b) => b.id === j.boat)?.name ?? j.boat
  const crew = (j.crew ?? []) as CrewMember[]
  const passengers = (j.passengers ?? []) as PassengerRow[]
  const rects = (j.rectificatifs ?? []) as Rectificatif[]
  const consumption = fuelConsumption(j.fuelDepart, j.fuelAdded, j.fuelArrival)
  const purpose =
    j.purpose === 'autre' && j.purposeOther
      ? j.purposeOther
      : (optionLabel(PURPOSES, j.purpose)?.fr ?? null)

  return (
    <main className="min-h-screen bg-[#e9edf1] text-[#111] print:bg-white">
      <PrintControls autoPrint={print === '1'} />

      <article className="mx-auto max-w-[800px] bg-white px-10 py-10 text-[13px] leading-relaxed shadow-sm print:max-w-none print:px-0 print:py-0 print:shadow-none">
        {/* Header */}
        <header className="flex items-start justify-between border-b-2 border-[#1e3a5f] pb-4">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#1e3a5f]">
              République de Madagascar · APMF
            </p>
            <h1 className="mt-1 text-[22px] font-bold text-[#1e3a5f]">
              Journal de bord
            </h1>
            <p className="mt-0.5 text-[12px] text-[#444]">
              Registre officiel des voyages — {OPERATOR_NAME}
            </p>
          </div>
          <div className="text-right">
            <p className="text-[10px] uppercase tracking-[0.14em] text-[#666]">
              N° de voyage
            </p>
            <p className="text-[16px] font-bold text-[#1e3a5f]">
              {j.voyageNumber}
            </p>
            <p className="mt-1 inline-block rounded-full border border-[#1e3a5f] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-[#1e3a5f]">
              {STATUS_LABELS[j.status].fr}
            </p>
          </div>
        </header>

        {/* 1 — Navire */}
        <Section n={1} title="Navire">
          <Grid>
            <Field label="Nom du navire" value={boatName} />
            <Field label="Exploitant" value={OPERATOR_NAME} />
          </Grid>
        </Section>

        {/* 2 — Informations sur le voyage */}
        <Section n={2} title="Informations sur le voyage">
          <Grid>
            <Field label="Date du voyage" value={fmtDate(j.voyageDate)} />
            <Field label="Objet du voyage" value={purpose} />
            <Field label="Lieu de départ" value={j.departureLocation} />
            <Field label="Heure de départ" value={j.departureTime} />
            <Field label="Destination" value={j.destination} />
            <Field label="Escales" value={j.stopovers} />
            <Field label="Lieu d'arrivée" value={j.arrivalLocation} />
            <Field label="Date d'arrivée" value={fmtDate(j.arrivalDate)} />
            <Field label="Heure d'arrivée" value={j.arrivalTime} />
          </Grid>
        </Section>

        {/* 3 — Capitaine et équipage */}
        <Section n={3} title="Capitaine et équipage">
          <Grid>
            <Field label="Capitaine" value={j.captainName} />
            <Field label="Brevet / licence" value={j.captainLicense} />
          </Grid>
          {crew.length > 0 && (
            <table className="mt-3 w-full border-collapse text-[12px]">
              <thead>
                <tr className="border-b border-[#ccc] text-left text-[10px] uppercase tracking-[0.08em] text-[#666]">
                  <th className="py-1.5">Membre d&apos;équipage</th>
                  <th className="py-1.5">Fonction</th>
                </tr>
              </thead>
              <tbody>
                {crew.map((c, i) => (
                  <tr key={i} className="border-b border-[#eee]">
                    <td className="py-1.5">{c.name || '—'}</td>
                    <td className="py-1.5">{c.role || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Section>

        {/* 4 — Passagers */}
        <Section n={4} title="Passagers">
          <Field
            label="Nombre de passagers"
            value={
              j.passengerCount != null ? String(j.passengerCount) : undefined
            }
          />
          {passengers.length > 0 && (
            <table className="mt-3 w-full border-collapse text-[12px]">
              <thead>
                <tr className="border-b border-[#ccc] text-left text-[10px] uppercase tracking-[0.08em] text-[#666]">
                  <th className="py-1.5">Nom</th>
                  <th className="py-1.5">Nationalité</th>
                </tr>
              </thead>
              <tbody>
                {passengers.map((p, i) => (
                  <tr key={i} className="border-b border-[#eee]">
                    <td className="py-1.5">{p.name || '—'}</td>
                    <td className="py-1.5">{p.nationality || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Section>

        {/* 5 — Conditions de navigation */}
        <Section n={5} title="Conditions de navigation">
          <Grid>
            <Field
              label="Météo"
              value={optionLabel(WEATHER_OPTIONS, j.weather)?.fr ?? null}
            />
            <Field
              label="État de la mer"
              value={optionLabel(SEA_OPTIONS, j.seaState)?.fr ?? null}
            />
            <Field
              label="Vent"
              value={optionLabel(WIND_OPTIONS, j.wind)?.fr ?? null}
            />
            <Field label="Zone de navigation" value={j.navigationZone} />
          </Grid>
        </Section>

        {/* 6 — Carburant */}
        <Section n={6} title="Carburant (litres)">
          <Grid>
            <Field
              label="Au départ"
              value={j.fuelDepart != null ? `${j.fuelDepart} L` : undefined}
            />
            <Field
              label="Ajouté"
              value={j.fuelAdded != null ? `${j.fuelAdded} L` : undefined}
            />
            <Field
              label="À l'arrivée"
              value={j.fuelArrival != null ? `${j.fuelArrival} L` : undefined}
            />
            <Field
              label="Consommation estimée"
              value={consumption != null ? `${consumption} L` : undefined}
            />
          </Grid>
          {j.fuelObservations && (
            <Field label="Observations" value={j.fuelObservations} />
          )}
        </Section>

        {/* 7 — Événements / observations */}
        <Section n={7} title="Événements, incidents et observations">
          {j.noIncident ? (
            <p className="italic text-[#444]">
              Aucun incident à signaler pour ce voyage.
            </p>
          ) : (
            <p className="whitespace-pre-wrap">{j.eventsText || '—'}</p>
          )}
        </Section>

        {/* 8 — Validation */}
        <section className="mt-8 flex items-end justify-between gap-6 border-t-2 border-[#1e3a5f] pt-5">
          <div className="text-[12px] text-[#444]">
            <p className="text-[10px] uppercase tracking-[0.14em] text-[#666]">
              Certifié par le capitaine
            </p>
            <p className="mt-1 text-[14px] font-semibold text-[#111]">
              {j.certifiedBy || j.captainName || '—'}
            </p>
            {j.validatedAt && (
              <p className="mt-0.5">Validé le {fmtDateTime(j.validatedAt)}</p>
            )}
          </div>
          <div className="shrink-0 text-center">
            <div className="h-20 w-44 rounded-md border border-dashed border-[#999]" />
            <p className="mt-1 text-[10px] uppercase tracking-[0.12em] text-[#666]">
              Signature / cachet
            </p>
          </div>
        </section>

        {/* 15 — Rectificatifs */}
        {rects.length > 0 && (
          <section className="mt-8 border-t border-[#ccc] pt-5">
            <h2 className="mb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#1e3a5f]">
              Rectificatifs
            </h2>
            <ul className="space-y-2">
              {rects.map((r) => (
                <li
                  key={r.id}
                  className="border-l-2 border-[#b0203a] pl-3 text-[12px]"
                >
                  <p className="text-[10px] uppercase tracking-[0.1em] text-[#666]">
                    {fmtDateTime(r.at)} · {r.reason}
                  </p>
                  <p className="mt-0.5 whitespace-pre-wrap">{r.text}</p>
                </li>
              ))}
            </ul>
          </section>
        )}

        <footer className="mt-8 border-t border-[#ccc] pt-3 text-[10px] text-[#888]">
          <p>
            Ce document n&apos;est pas un visa officiel de l&apos;autorité
            maritime. Il constitue le registre interne de l&apos;exploitant,
            tenu conformément aux obligations du journal de bord et présentable
            lors d&apos;une inspection.
          </p>
        </footer>
      </article>
    </main>
  )
}

function Section({
  n,
  title,
  children,
}: {
  n: number
  title: string
  children: React.ReactNode
}) {
  return (
    <section className="mt-6 break-inside-avoid">
      <h2 className="mb-2 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#1e3a5f]">
        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#1e3a5f] text-[10px] text-white">
          {n}
        </span>
        {title}
      </h2>
      {children}
    </section>
  )
}

function Grid({ children }: { children: React.ReactNode }) {
  return <div className="grid gap-x-6 gap-y-2 sm:grid-cols-2">{children}</div>
}

function Field({
  label,
  value,
}: {
  label: string
  value: string | null | undefined
}) {
  return (
    <div className="flex justify-between gap-4 border-b border-[#eee] py-1">
      <span className="text-[#666]">{label}</span>
      <span className="text-right font-medium text-[#111]">{value || '—'}</span>
    </div>
  )
}
