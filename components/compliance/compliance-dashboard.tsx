'use client'

import Link from 'next/link'
import {
  AlertTriangle,
  ArrowRight,
  FileText,
  ShieldCheck,
} from 'lucide-react'

import type {
  ExpiryAlert,
  VesselCompliance,
} from '@/app/actions/compliance'
import {
  daysUntil,
  docCategoryLabel,
  docTitleGlossKey,
  formatExpiryLine,
  STATUS_LABEL,
  statusChip,
  type ComplianceStatus,
} from '@/lib/compliance'
import { useT } from '@/lib/i18n/context'
import { cn } from '@/lib/utils'

function OfficialTitle({ name }: { name: string }) {
  const t = useT()
  const key = docTitleGlossKey(name)
  if (!key) return <>{name}</>
  const gloss = t(key)
  if (gloss === key) return <>{name}</>
  return (
    <>
      {gloss}
      <span className="font-normal"> · {name}</span>
    </>
  )
}

function StatusPill({ status }: { status: ComplianceStatus }) {
  const t = useT()
  const c = statusChip(status)
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.08em]',
        c.bg,
        c.text,
      )}
    >
      <span className={cn('h-1.5 w-1.5 rounded-full', c.dot)} />
      {t(STATUS_LABEL[status])}
    </span>
  )
}

function AlertRow({ alert }: { alert: ExpiryAlert }) {
  const t = useT()
  const critical = alert.status === 'expired'
  const when =
    alert.expiryDate != null
      ? formatExpiryLine(t, alert.expiryDate, alert.days ?? daysUntil(alert.expiryDate))
      : null
  return (
    <div className="flex items-center gap-3 border-b border-border/60 px-1 py-3 last:border-b-0">
      <AlertTriangle
        className={cn(
          'h-5 w-5 shrink-0',
          critical ? 'text-[#b0203a]' : 'text-[#8f6d3a]',
        )}
        strokeWidth={1.75}
      />
      <StatusPill status={alert.status} />
      <p className="text-sm text-foreground">
        <span className="font-semibold">{alert.boatName}</span>{' '}
        <span className="text-muted-foreground">·</span>{' '}
        <OfficialTitle name={alert.docName} />{' '}
        <span className="text-muted-foreground">
          ({t(docCategoryLabel(alert.category))}) {when}
        </span>
      </p>
    </div>
  )
}

function VesselCard({ vessel }: { vessel: VesselCompliance }) {
  const t = useT()
  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="font-serif text-2xl text-foreground">{vessel.name}</h2>
          {vessel.registrationNumber && (
            <p className="mt-0.5 text-xs uppercase tracking-[0.14em] text-muted-foreground">
              {vessel.registrationNumber}
            </p>
          )}
        </div>
        <StatusPill status={vessel.headline} />
      </div>

      <div className="mt-4 h-px w-full bg-border" />

      <ul className="mt-4 space-y-2.5">
        {vessel.core.map(({ category, doc, status }) => (
          <li
            key={category}
            className="flex items-center justify-between gap-3"
          >
            <div className="min-w-0">
              <p className="truncate text-sm text-foreground">
                {t(docCategoryLabel(category))}
              </p>
              {doc?.expiryDate && (
                <p className="text-[11px] text-muted-foreground">
                  {formatExpiryLine(t, doc.expiryDate, doc.daysUntilExpiry)}
                </p>
              )}
              {!doc && (
                <p className="text-[11px] text-[#8f1a2f]">
                  {t('No document on file')}
                </p>
              )}
            </div>
            <StatusPill status={status} />
          </li>
        ))}
      </ul>

      <Link
        href={`/admin/compliance/${vessel.boat}`}
        className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-lg border border-border px-3.5 py-2 text-xs font-medium uppercase tracking-[0.12em] text-foreground transition-colors hover:bg-foreground/[0.04]"
      >
        <FileText className="h-4 w-4" strokeWidth={1.5} />
        {t('Document register')}
        <ArrowRight className="h-3.5 w-3.5" strokeWidth={1.5} />
      </Link>
    </div>
  )
}

export function ComplianceDashboard({
  vessels,
  alerts,
}: {
  vessels: VesselCompliance[]
  alerts: ExpiryAlert[]
}) {
  const t = useT()
  return (
    <div className="space-y-6">
      {alerts.length > 0 && (
        <div className="rounded-xl border border-border bg-card px-4 py-1">
          {alerts.map((a) => (
            <AlertRow key={a.docId} alert={a} />
          ))}
        </div>
      )}

      {alerts.length === 0 && (
        <div className="flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-4">
          <ShieldCheck className="h-5 w-5 text-[#4f7a54]" strokeWidth={1.75} />
          <p className="text-sm text-foreground">
            {t('No documents expiring in the next 30 days.')}
          </p>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        {vessels.map((v) => (
          <VesselCard key={v.boat} vessel={v} />
        ))}
      </div>

      {/* Quick access to the two logbooks. They live under /compliance so they
          share the module, but they are the daily working screens, so surface
          them here rather than burying them behind a vessel. */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Link
          href="/admin/compliance/logbook"
          className="group flex items-center justify-between rounded-xl border border-border bg-card p-5 transition-colors hover:bg-muted"
        >
          <span>
            <span className="font-serif text-lg text-foreground">
              {t('Journal de bord')}
            </span>
            <span className="mt-0.5 block text-xs text-muted-foreground">
              {t('Ship / voyage logbook — one entry per trip')}
            </span>
          </span>
          <ArrowRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
        </Link>
        <Link
          href="/admin/compliance/fishing-log"
          className="group flex items-center justify-between rounded-xl border border-border bg-card p-5 transition-colors hover:bg-muted"
        >
          <span>
            <span className="font-serif text-lg text-foreground">
              {t('Journal de pêche')}
            </span>
            <span className="mt-0.5 block text-xs text-muted-foreground">
              {t('Fishing logbook — activity, catches & declarations')}
            </span>
          </span>
          <ArrowRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
        </Link>
        <Link
          href="/admin/compliance/safety"
          className="group flex items-center justify-between rounded-xl border border-border bg-card p-5 transition-colors hover:bg-muted"
        >
          <span>
            <span className="font-serif text-lg text-foreground">
              {t('Safety & departure')}
            </span>
            <span className="mt-0.5 block text-xs text-muted-foreground">
              {t('Pre-departure check, safety equipment & incidents')}
            </span>
          </span>
          <ArrowRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
        </Link>
      </div>

      {/* The single screen a control officer is handed: a print-ready package
          of everything about one vessel. Full-width so it reads as the endpoint
          of the module, not one card among the working screens. */}
      <Link
        href="/admin/compliance/inspection"
        className="group flex items-center justify-between rounded-xl border border-primary/30 bg-primary/[0.06] p-5 transition-colors hover:bg-primary/10"
      >
        <span>
          <span className="font-serif text-lg text-foreground">
            {t('Inspection view')}
          </span>
          <span className="mt-0.5 block text-xs text-muted-foreground">
            {t(
              'Print-ready compliance package for a control officer — documents, logbooks, catches, safety & legal references',
            )}
          </span>
        </span>
        <ArrowRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
      </Link>

      {/* Physical-vs-electronic distinction and the non-official disclaimer,
          both required by the spec: the digital record does not replace the
          paper book or a government submission. */}
      <div className="rounded-xl border border-border bg-card p-5 text-sm text-muted-foreground">
        <p className="font-medium text-foreground">{t('AMM Compliance Record')}</p>
        <p className="mt-1">{t('Prepared for compliance and reporting purposes.')}</p>
        <p className="mt-3 leading-relaxed">
          {t(
            'This electronic record does not replace the official physical logbook on board, nor a submission to or validation by the competent Malagasy authority. Official acceptance is subject to the requirements of that authority.',
          )}
        </p>
      </div>
    </div>
  )
}
