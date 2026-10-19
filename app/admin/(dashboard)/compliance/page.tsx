import { getComplianceOverview } from '@/app/actions/compliance'
import { ComplianceDashboard } from '@/components/compliance/compliance-dashboard'
import { getT } from '@/lib/i18n/server'

export default async function AdminCompliancePage() {
  const t = await getT()
  const { vessels, alerts } = await getComplianceOverview()

  return (
    <div className="space-y-6">
      {/* Page head — same shape as Fleet/Weather so it reads as a sibling. */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="flex items-center gap-3 text-[11px] font-medium uppercase tracking-[0.3em] text-accent">
            <span className="h-px w-8 bg-accent" />
            {t('Compliance & logbooks')}
          </p>
          <h1 className="mt-2 font-serif text-3xl font-medium text-foreground lg:text-4xl">
            {t('Maritime & Fisheries Compliance')}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {t(
              'Official and internal records for ODYSSEY and ODYSSEY II — documents, logbooks and reporting',
            )}
          </p>
        </div>
      </div>

      <ComplianceDashboard vessels={vessels} alerts={alerts} />
    </div>
  )
}
