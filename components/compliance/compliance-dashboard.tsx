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
  docCategoryLabel,
  expiryPhrase,
  STATUS_LABEL,
  statusChip,
  type ComplianceStatus,
} from '@/lib/compliance'
import { cn } from '@/lib/utils'

function StatusPill({ status }: { status: ComplianceStatus }) {
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
      {STATUS_LABEL[status]}
    </span>
  )
}

function AlertRow({ alert }: { alert: ExpiryAlert }) {
  const critical = alert.status === 'expired'
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
        <span className="text-muted-foreground">·</span> {alert.docName}{' '}
        <span className="text-muted-foreground">
          ({docCategoryLabel(alert.category)}) {expiryPhrase(alert.expiryDate)}
        </span>
      </p>
    </div>
  )
}

function VesselCard({ vessel }: { vessel: VesselCompliance }) {
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
                {docCategoryLabel(category)}
              </p>
              {doc?.expiryDate && (
                <p className="text-[11px] text-muted-foreground">
                  Expires {doc.expiryDate} · {expiryPhrase(doc.expiryDate)}
                </p>
              )}
              {!doc && (
                <p className="text-[11px] text-[#8f1a2f]">
                  No document on file
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
        Document register
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
            No documents expiring in the next 30 days.
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
              Journal de bord
            </span>
            <span className="mt-0.5 block text-xs text-muted-foreground">
              Ship / voyage logbook — one entry per trip
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
              Journal de p&ecirc;che
            </span>
            <span className="mt-0.5 block text-xs text-muted-foreground">
              Fishing logbook — activity, catches &amp; declarations
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
              Safety &amp; departure
            </span>
            <span className="mt-0.5 block text-xs text-muted-foreground">
              Pre-departure check, safety equipment &amp; incidents
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
            Inspection view
          </span>
          <span className="mt-0.5 block text-xs text-muted-foreground">
            Print-ready compliance package for a control officer &mdash;
            documents, logbooks, catches, safety &amp; legal references
          </span>
        </span>
        <ArrowRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
      </Link>

      {/* Physical-vs-electronic distinction and the non-official disclaimer,
          both required by the spec: the digital record does not replace the
          paper book or a government submission. */}
      <div className="rounded-xl border border-border bg-card p-5 text-sm text-muted-foreground">
        <p className="font-medium text-foreground">AMM Compliance Record</p>
        <p className="mt-1">Prepared for compliance and reporting purposes.</p>
        <p className="mt-3 leading-relaxed">
          This electronic record does not replace the official physical logbook
          on board, nor a submission to or validation by the competent Malagasy
          authority. Official acceptance is subject to the requirements of that
          authority.
        </p>
      </div>
    </div>
  )
}
