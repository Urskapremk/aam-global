import { SafetyPanel } from '@/components/compliance/safety-panel'
import { getSafetyEquipment, getIncidents } from '@/app/actions/safety'
import { BOATS } from '@/lib/boats'

export const dynamic = 'force-dynamic'

export default async function SafetyPage({
  searchParams,
}: {
  searchParams: Promise<{ boat?: string }>
}) {
  const { boat: boatParam } = await searchParams
  const boat = BOATS.find((b) => b.id === boatParam)?.id ?? BOATS[0].id

  const [safety, incidents] = await Promise.all([
    getSafetyEquipment(boat),
    getIncidents(boat),
  ])

  return (
    <div className="space-y-6">
      <div>
        <div className="mb-2 h-px w-8 bg-accent" />
        <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
          Compliance
        </p>
        <h1 className="mt-1 font-serif text-3xl text-foreground">
          Safety &amp; departure
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          The legal &amp; safety pre-departure check, the vessel safety-equipment
          register, and the incident / accident log with authority notification.
        </p>
      </div>

      <SafetyPanel boat={boat} safety={safety} incidents={incidents} />
    </div>
  )
}
