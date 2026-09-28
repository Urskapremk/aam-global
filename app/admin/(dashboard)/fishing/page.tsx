import { FishingTab } from '@/components/fishing-tab'
import { LODGE } from '@/lib/lodge'

export default function AdminFishingPage() {
  return (
    <div className="space-y-6">
      {/* Same head shape as Fleet and Weather, so the three read as siblings. */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="flex items-center gap-3 text-[11px] font-medium uppercase tracking-[0.3em] text-accent">
            <span className="h-px w-8 bg-accent" />
            Fishing
          </p>
          <h1 className="mt-2 font-serif text-3xl font-medium text-foreground lg:text-4xl">
            {LODGE.name}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Our marks, what came off them, and the conditions that were running
          </p>
        </div>
      </div>

      <FishingTab />
    </div>
  )
}
