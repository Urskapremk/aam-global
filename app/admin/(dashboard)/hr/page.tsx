import { HrTab } from '@/components/admin/hr/hr-tab'
import { getT } from '@/lib/i18n/server'

export default async function AdminHrPage() {
  const t = await getT()
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4 print:hidden">
        <div>
          <p className="flex items-center gap-3 text-[11px] font-medium uppercase tracking-[0.3em] text-accent">
            <span className="h-px w-8 bg-accent" />
            {t('HR department')}
          </p>
          <h1 className="mt-2 font-serif text-3xl font-medium text-foreground lg:text-4xl">
            {t('People & payroll')}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {t('Staff records, Madagascar payroll, contracts, leave and the employer register — linked to the crew.')}
          </p>
        </div>
      </div>
      <HrTab />
    </div>
  )
}
