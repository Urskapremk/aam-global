import { FuelTab } from '@/components/fuel-tab'
import { LODGE } from '@/lib/lodge'
import { getT } from '@/lib/i18n/server'

export default async function AdminFuelPage() {
  const t = await getT()
  return (
    <div className="space-y-6">
      {/* Same head shape as Fleet, Trips, Fishing and Maintenance. */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="flex items-center gap-3 text-[11px] font-medium uppercase tracking-[0.3em] text-accent">
            <span className="h-px w-8 bg-accent" />
            {t('Fuel')}
          </p>
          <h1 className="mt-2 font-serif text-3xl font-medium text-foreground lg:text-4xl">
            {LODGE.name}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {t('Fuel in the drums, deliveries in and refuels out')}
          </p>
        </div>
      </div>

      <FuelTab />
    </div>
  )
}
