import { TripsTab } from '@/components/trips-tab'
import { getT } from '@/lib/i18n/server'
import { LODGE } from '@/lib/lodge'

export const dynamic = 'force-dynamic'

export default async function TripsPage() {
  const t = await getT()
  return (
    <div>
      {/* Same head shape as Weather and Fleet — without it the page reads as
          foreign to the rest of the admin. */}
      <div className="mb-6">
        <div className="mb-3 flex items-center gap-3">
          <div className="h-px w-8 bg-accent" aria-hidden />
          <p className="text-[10px] font-medium uppercase tracking-[0.22em] text-muted-foreground">
            {t('Trips')}
          </p>
        </div>
        <h1 className="font-serif text-3xl text-foreground">{LODGE.name}</h1>
        <p className="text-muted-foreground">
          {t('The log of every trip, and who is allowed to record one')}
        </p>
      </div>

      <TripsTab />
    </div>
  )
}
