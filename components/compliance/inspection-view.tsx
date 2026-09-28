'use client'

import { Printer } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  docCategoryLabel,
  incidentCategoryLabel,
  safetyCategoryLabel,
  statusChip,
  STATUS_LABEL,
} from '@/lib/compliance'
import type { InspectionView } from '@/app/actions/inspection'
import { BOATS } from '@/lib/boats'

function fmtDate(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-GB')
}

function fmtDateTime(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('en-GB')
}

// Legal references from the spec. Static, non-editable reference block — the
// laws the module is prepared against. NOT a claim of official approval.
const LEGAL_REFERENCES = [
  {
    name: 'Madagascar Maritime Code',
    covers: "Rôle d'équipage, Permis de navigation, Bon de partance, maritime safety",
  },
  {
    name: 'Malagasy Fisheries and Aquaculture Code — Loi n°2015-053, as amended',
    covers:
      'Journal de pêche, catch data, fishing effort & location, position reporting, vessel monitoring, inspections',
  },
  {
    name: 'Malagasy Customs Code',
    covers: 'Journal de bord for relevant port / customs procedures',
  },
]

type Props = { boat: string; view: InspectionView }

export function InspectionViewClient({ boat, view }: Props) {
  return (
    <div className="space-y-6">
      {/* Controls — hidden when printing. */}
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <div className="flex gap-2">
          {BOATS.map((b) => (
            <a
              key={b.id}
              href={`/admin/compliance/inspection?boat=${b.id}`}
              className={`rounded-lg border px-4 py-2 text-sm transition-colors ${
                b.id === boat
                  ? 'border-primary/40 bg-primary/10 text-foreground'
                  : 'border-border bg-card text-muted-foreground hover:bg-muted'
              }`}
            >
              {b.name}
            </a>
          ))}
        </div>
        <Button variant="outline" size="sm" onClick={() => window.print()}>
          <Printer className="mr-1 h-4 w-4" /> Print / save PDF
        </Button>
      </div>

      {/* The printable package. `print:` utilities force A4-friendly black text
          on white so it reads when printed in black and white. */}
      <article className="rounded-xl border border-border bg-card p-6 print:border-0 print:bg-white print:p-0 print:text-black">
        <header className="flex items-start justify-between border-b border-border pb-4 print:border-black">
          <div>
            <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground print:text-black">
              AMM Compliance Record
            </p>
            <h2 className="mt-1 font-serif text-2xl text-foreground print:text-black">
              {view.boatName}
            </h2>
            <p className="mt-0.5 text-sm text-muted-foreground print:text-black">
              {view.registrationNumber
                ? `Reg. ${view.registrationNumber}`
                : 'Registration not recorded'}
              {view.classification ? ` · ${view.classification}` : ''}
            </p>
          </div>
          <div className="text-right text-xs text-muted-foreground print:text-black">
            <p>Inspection view</p>
            <p>Generated {fmtDateTime(view.generatedAt)}</p>
          </div>
        </header>

        {/* Physical vs electronic vs authority — the spec's three-state note. */}
        <div className="mt-4 grid gap-2 rounded-lg bg-muted/50 p-4 text-sm print:bg-transparent sm:grid-cols-3">
          <p className="text-foreground print:text-black">
            Digital record: <span className="font-medium">Available</span>
          </p>
          <p className="text-foreground print:text-black">
            Official physical book:{' '}
            <span className="font-medium">On board</span>
          </p>
          <p className="text-foreground print:text-black">
            Authority visa: <span className="font-medium">See logbook</span>
          </p>
        </div>

        <Section title="Vessel documents">
          {view.documents.length === 0 ? (
            <Empty>No documents recorded.</Empty>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs uppercase tracking-[0.08em] text-muted-foreground print:border-black print:text-black">
                  <th className="py-2">Document</th>
                  <th className="py-2">Number</th>
                  <th className="py-2">Authority</th>
                  <th className="py-2">Expiry</th>
                  <th className="py-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {view.documents.map((d) => {
                  const chip = statusChip(d.status)
                  return (
                    <tr
                      key={d.id}
                      className="border-b border-border/60 print:border-black/30"
                    >
                      <td className="py-2 text-foreground print:text-black">
                        {docCategoryLabel(d.category)}
                      </td>
                      <td className="py-2 text-muted-foreground print:text-black">
                        {d.number ?? '—'}
                      </td>
                      <td className="py-2 text-muted-foreground print:text-black">
                        {d.issuingAuthority ?? '—'}
                      </td>
                      <td className="py-2 text-muted-foreground print:text-black">
                        {fmtDate(d.expiryDate)}
                      </td>
                      <td className="py-2">
                        <span
                          className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs ${chip.bg} ${chip.text} print:bg-transparent print:text-black`}
                        >
                          <span className={`h-1.5 w-1.5 rounded-full ${chip.dot}`} />
                          {STATUS_LABEL[d.status]}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </Section>

        <div className="grid gap-6 sm:grid-cols-2">
          <Section title="Last voyage — Journal de bord">
            {view.lastVoyage ? (
              <dl className="space-y-1 text-sm">
                <Row label="Date" value={fmtDate(view.lastVoyage.date)} />
                <Row label="Captain" value={view.lastVoyage.captain ?? '—'} />
                <Row
                  label="Route"
                  value={`${view.lastVoyage.departure ?? '—'} → ${
                    view.lastVoyage.arrival ?? '—'
                  }`}
                />
                <Row
                  label="Status"
                  value={view.lastVoyage.locked ? 'Approved & locked' : 'Open'}
                />
              </dl>
            ) : (
              <Empty>No voyage logbook yet.</Empty>
            )}
          </Section>

          <Section title="Last fishing — Journal de pêche">
            {view.lastFishing ? (
              <dl className="space-y-1 text-sm">
                <Row
                  label="Landing"
                  value={fmtDate(view.lastFishing.landingDate)}
                />
                <Row
                  label="Location"
                  value={view.lastFishing.landingLocation ?? '—'}
                />
                <Row
                  label="Catches"
                  value={String(view.lastFishing.catchCount)}
                />
                <Row
                  label="Status"
                  value={view.lastFishing.locked ? 'Approved & locked' : 'Open'}
                />
              </dl>
            ) : (
              <Empty>No fishing logbook yet.</Empty>
            )}
          </Section>
        </div>

        <Section title="Recent catches">
          {view.recentCatches.length === 0 ? (
            <Empty>No catches recorded.</Empty>
          ) : (
            <ul className="grid gap-1 text-sm sm:grid-cols-2">
              {view.recentCatches.map((c, i) => (
                <li
                  key={i}
                  className="flex justify-between border-b border-border/60 py-1.5 print:border-black/30"
                >
                  <span className="text-foreground print:text-black">
                    {c.species}
                  </span>
                  <span className="text-muted-foreground print:text-black">
                    {c.weightKg != null ? `${c.weightKg} kg` : '—'} ·{' '}
                    {fmtDate(c.at)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Section>

        <div className="grid gap-6 sm:grid-cols-2">
          <Section title="Safety equipment">
            {view.safety.length === 0 ? (
              <Empty>No safety equipment recorded.</Empty>
            ) : (
              <ul className="space-y-1 text-sm">
                {view.safety.map((s, i) => (
                  <li
                    key={i}
                    className="flex justify-between text-foreground print:text-black"
                  >
                    <span>{safetyCategoryLabel(s.category)}</span>
                    <span className="text-muted-foreground print:text-black">
                      {s.nextInspection
                        ? `next ${fmtDate(s.nextInspection)}`
                        : '—'}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Section>

          <Section title="Recent incidents">
            {view.incidents.length === 0 ? (
              <Empty>No incidents recorded.</Empty>
            ) : (
              <ul className="space-y-1 text-sm">
                {view.incidents.map((inc, i) => (
                  <li key={i} className="text-foreground print:text-black">
                    <span className="font-medium">
                      {incidentCategoryLabel(inc.category)}
                    </span>{' '}
                    <span className="text-muted-foreground print:text-black">
                      · {fmtDate(inc.at)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Section>
        </div>

        <Section title="Regulatory references">
          <ul className="space-y-2 text-sm">
            {LEGAL_REFERENCES.map((r) => (
              <li key={r.name}>
                <span className="font-medium text-foreground print:text-black">
                  {r.name}
                </span>
                <span className="block text-xs text-muted-foreground print:text-black">
                  {r.covers}
                </span>
              </li>
            ))}
          </ul>
        </Section>

        {/* Official-stamp space + the required non-official disclaimer footer. */}
        <div className="mt-8 flex items-end justify-between gap-6 border-t border-border pt-6 print:border-black">
          <div className="text-xs text-muted-foreground print:text-black">
            <p className="font-medium text-foreground print:text-black">
              Generated from AMM Compliance System
            </p>
            <p className="mt-1 max-w-md">
              Electronic record — official acceptance subject to the requirements
              of the competent Malagasy authority. Prepared for compliance and
              reporting purposes.
            </p>
          </div>
          <div className="shrink-0 text-center">
            <div className="h-24 w-40 rounded-md border border-dashed border-muted-foreground/50 print:border-black" />
            <p className="mt-1 text-[10px] uppercase tracking-[0.12em] text-muted-foreground print:text-black">
              Official visa / stamp
            </p>
          </div>
        </div>
      </article>
    </div>
  )
}

function Section({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <section className="mt-6">
      <h3 className="mb-2 text-[11px] uppercase tracking-[0.14em] text-muted-foreground print:text-black">
        {title}
      </h3>
      {children}
    </section>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-muted-foreground print:text-black">{label}</dt>
      <dd className="text-right text-foreground print:text-black">{value}</dd>
    </div>
  )
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-sm text-muted-foreground print:text-black">{children}</p>
  )
}
