import { FlotaTab } from '@/components/flota-tab'
import { LODGE } from '@/lib/lodge'

export default function AdminFleetPage() {
  return (
    <div className="space-y-6">
      {/* Page head — same shape as the Weather page, so the two read as
          siblings in the sidebar. */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="flex items-center gap-3 text-[11px] font-medium uppercase tracking-[0.3em] text-accent">
            <span className="h-px w-8 bg-accent" />
            Fleet
          </p>
          <h1 className="mt-2 font-serif text-3xl font-medium text-foreground lg:text-4xl">
            {LODGE.name}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Where our boats are today, and the chart of the water around them
          </p>
        </div>
      </div>

      <FlotaTab />
    </div>
  )
}
