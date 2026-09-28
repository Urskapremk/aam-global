import { BOATS } from '@/lib/boats'
import { getFishingLog, type FishingLogEntry } from '@/app/actions/fishing-log'
import { FishingLogbook } from '@/components/compliance/fishing-logbook'

export const dynamic = 'force-dynamic'

export default async function FishingLogPage() {
  const boats = BOATS.map((b) => ({ id: b.id, label: b.name }))
  const logsByBoat: Record<string, FishingLogEntry[]> = {}
  await Promise.all(
    boats.map(async (b) => {
      logsByBoat[b.id] = await getFishingLog(b.id)
    }),
  )

  return (
    <div className="space-y-6">
      <header>
        <div className="mb-2 h-px w-8 bg-accent" />
        <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
          Compliance
        </p>
        <h1 className="mt-1 font-serif text-3xl text-foreground">
          Journal de p&ecirc;che
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Fishing logbook — activity and effort, catches by species, bycatch and
          discards, protected-species interactions, landing and catch
          declarations. Built from each fishing trip.
        </p>
      </header>

      <FishingLogbook boats={boats} logsByBoat={logsByBoat} />
    </div>
  )
}
