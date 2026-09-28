import { VoyageLogbook } from '@/components/compliance/voyage-logbook'
import { VoyageJournalManager } from '@/components/compliance/voyage-journal-manager'
import { getVoyageLogs, type VoyageLogRow } from '@/app/actions/voyage-log'
import { listVoyageJournals } from '@/app/actions/voyage-journal'
import { BOATS } from '@/lib/boats'

export const dynamic = 'force-dynamic'

export default async function VoyageLogbookPage() {
  const boats = BOATS.map((b) => ({ boat: b.id, label: b.name }))

  const [journals, ...entries] = await Promise.all([
    listVoyageJournals(),
    ...boats.map((b) => getVoyageLogs(b.boat)),
  ])
  const logsByBoat: Record<string, VoyageLogRow[]> = {}
  boats.forEach((b, i) => {
    logsByBoat[b.boat] = entries[i]
  })

  return (
    <div className="space-y-6">
      <header>
        <div className="mb-2 h-px w-8 bg-accent" />
        <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
          Compliance
        </p>
        <h1 className="font-serif text-3xl text-foreground">Journal de bord</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          The official APMF voyage logbook. Open a new voyage, fill in every
          section, then have the captain validate it — a validated entry is
          locked and can only be corrected with a rectificatif. Export a signed
          A4 PDF or send it by email for an inspection.
        </p>
      </header>

      <VoyageJournalManager boats={boats} entries={journals} />

      {/* Secondary reference: the GPS-derived trip log stays available below —
          it is drawn automatically from Captain Mode fixes, separate from the
          hand-entered official journal above. */}
      <section className="space-y-4 border-t border-border pt-8">
        <div>
          <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
            Reference — GPS trips
          </p>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Trips recorded automatically from Captain Mode. Use these to fill
            the official journal above; they are not themselves an official
            record.
          </p>
        </div>
        <VoyageLogbook boats={boats} logsByBoat={logsByBoat} />
      </section>
    </div>
  )
}
