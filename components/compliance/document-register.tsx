'use client'

import { useState, useTransition } from 'react'
import { Plus, Pencil, Archive, X, FileText, RotateCcw, ExternalLink } from 'lucide-react'

import { ImageUpload } from '@/components/admin/image-upload'
import { ExpiryNotice } from '@/components/compliance/expiry-notice'
import { OfficialTitle } from '@/components/compliance/official-title'
import { Button } from '@/components/ui/button'
import { useT } from '@/lib/i18n/context'
import {
  DOC_CATEGORIES,
  docCategoryLabel,
  officialDocTitle,
  STATUS_LABEL,
  type ComplianceStatus,
} from '@/lib/compliance'
import type { ComplianceDoc, DocInput } from '@/app/actions/compliance'
import {
  saveComplianceDocument,
  archiveComplianceDocument,
} from '@/app/actions/compliance'

const STATUS_STYLES: Record<ComplianceStatus, string> = {
  valid: 'bg-[#4f7a54]/12 text-[#3f6a44] border-[#4f7a54]/25',
  expiring: 'bg-[#8f6d3a]/12 text-[#7d5f31] border-[#8f6d3a]/25',
  expired: 'bg-[#b0203a]/10 text-[#b0203a] border-[#b0203a]/25',
  missing: 'bg-[#b0203a]/10 text-[#b0203a] border-[#b0203a]/25',
  suspended: 'bg-[#b0203a]/10 text-[#b0203a] border-[#b0203a]/25',
  pending: 'bg-muted text-muted-foreground border-border',
}

function StatusBadge({ status }: { status: ComplianceStatus }) {
  const t = useT()
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[10px] font-medium uppercase tracking-[0.12em] ${STATUS_STYLES[status]}`}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden />
      {t(STATUS_LABEL[status])}
    </span>
  )
}

const emptyForm = (boat: string): DocInput => ({
  boat,
  category: 'permis-navigation',
  name: '',
  number: '',
  issuingAuthority: '',
  issueDate: '',
  expiryDate: '',
  status: 'valid',
  notes: '',
  fileUrl: '',
})

function isImageUrl(url: string): boolean {
  return /\.(png|jpe?g|webp|gif|avif)(\?|#|$)/i.test(url)
}

const field =
  'w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring'

export function DocumentRegister({
  boat,
  boatName,
  live,
  archived,
}: {
  boat: string
  boatName: string
  live: ComplianceDoc[]
  archived: ComplianceDoc[]
}) {
  const t = useT()
  const [form, setForm] = useState<DocInput | null>(null)
  const [showArchived, setShowArchived] = useState(false)
  const [pending, startTransition] = useTransition()

  const openNew = () => setForm(emptyForm(boat))
  const openEdit = (d: ComplianceDoc) =>
    setForm({
      id: d.id,
      boat: d.boat,
      category: d.category,
      name: d.name,
      number: d.number ?? '',
      issuingAuthority: d.issuingAuthority ?? '',
      issueDate: d.issueDate ?? '',
      expiryDate: d.expiryDate ?? '',
      fileUrl: d.fileUrl ?? '',
      status: d.status,
      notes: d.notes ?? '',
    })

  const save = () => {
    if (!form || !form.name.trim()) return
    startTransition(async () => {
      await saveComplianceDocument(form)
      setForm(null)
    })
  }

  const archive = (d: ComplianceDoc) => {
    const reason = window.prompt(
      `${t('Archive this document? It stays on file for history. Reason (optional):')}\n${d.name}`,
    )
    if (reason === null) return
    startTransition(async () => {
      await archiveComplianceDocument(d.id, reason || undefined)
    })
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
            {t('Document register')}
          </p>
          <h2 className="font-serif text-2xl text-foreground">{boatName}</h2>
        </div>
        {!form && (
          <Button onClick={openNew} className="gap-2">
            <Plus className="h-4 w-4" />
            {t('Add document')}
          </Button>
        )}
      </div>

      {form && (
        <div className="rounded-xl border border-border bg-card p-5">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="font-serif text-lg text-foreground">
              {form.id ? t('Amend document') : t('New document')}
            </h3>
            <button
              type="button"
              onClick={() => setForm(null)}
              className="rounded-md p-1 text-muted-foreground hover:bg-muted"
              aria-label={t('Close')}
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {form.id && (
            <p className="mb-4 rounded-lg border border-[#8f6d3a]/25 bg-[#8f6d3a]/8 px-3 py-2 text-xs text-[#7d5f31]">
              {t(
                'Amending an official document records every change (old and new value) in the audit trail.',
              )}
            </p>
          )}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <label className="space-y-1.5 text-sm">
              <span className="text-muted-foreground">{t('Category')}</span>
              <select
                className={field}
                value={form.category}
                onChange={(e) =>
                  setForm({ ...form, category: e.target.value })
                }
              >
                {DOC_CATEGORIES.map((c) => (
                  <option key={c.id} value={c.id}>
                    {t(c.label)}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-1.5 text-sm">
              <span className="text-muted-foreground">{t('Document name')}</span>
              <input
                className={field}
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder={t('e.g. Permis de navigation')}
              />
            </label>
            <label className="space-y-1.5 text-sm">
              <span className="text-muted-foreground">{t('Number / reference')}</span>
              <input
                className={field}
                value={form.number ?? ''}
                onChange={(e) => setForm({ ...form, number: e.target.value })}
              />
            </label>
            <label className="space-y-1.5 text-sm">
              <span className="text-muted-foreground">{t('Issuing authority')}</span>
              <input
                className={field}
                value={form.issuingAuthority ?? ''}
                onChange={(e) =>
                  setForm({ ...form, issuingAuthority: e.target.value })
                }
              />
            </label>
            <label className="space-y-1.5 text-sm">
              <span className="text-muted-foreground">{t('Issue date')}</span>
              <input
                type="date"
                className={field}
                value={form.issueDate ?? ''}
                onChange={(e) =>
                  setForm({ ...form, issueDate: e.target.value })
                }
              />
            </label>
            <label className="space-y-1.5 text-sm">
              <span className="text-muted-foreground">{t('Expiry date')}</span>
              <input
                type="date"
                className={field}
                value={form.expiryDate ?? ''}
                onChange={(e) =>
                  setForm({ ...form, expiryDate: e.target.value })
                }
              />
            </label>
            <div className="space-y-2 sm:col-span-2">
              <ImageUpload
                label="Scan or screenshot"
                listenPaste
                maxEdge={2400}
                quality={0.9}
                value={form.fileUrl?.trim() ? form.fileUrl : null}
                onChange={(url) => setForm({ ...form, fileUrl: url ?? '' })}
              />
              <p className="text-xs text-muted-foreground">
                {t(
                  'Attach a photo from your phone or paste a screenshot. It is saved with this vessel document.',
                )}
              </p>
            </div>
            <label className="space-y-1.5 text-sm sm:col-span-2">
              <span className="text-muted-foreground">
                {t('Document link (optional)')}
              </span>
              <input
                className={field}
                value={form.fileUrl ?? ''}
                onChange={(e) => setForm({ ...form, fileUrl: e.target.value })}
                placeholder="https://…"
              />
            </label>
            <label className="space-y-1.5 text-sm sm:col-span-2">
              <span className="text-muted-foreground">{t('Notes')}</span>
              <textarea
                className={field}
                rows={2}
                value={form.notes ?? ''}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
              />
            </label>
          </div>

          <div className="mt-5 flex items-center gap-3">
            <Button onClick={save} disabled={pending || !form.name.trim()}>
              {pending ? t('Saving…') : form.id ? t('Save changes') : t('Add document')}
            </Button>
            <Button variant="outline" onClick={() => setForm(null)}>
              {t('Cancel')}
            </Button>
          </div>
        </div>
      )}

      <div className="space-y-3">
        {live.length === 0 && !form && (
          <p className="rounded-xl border border-dashed border-border bg-card px-4 py-8 text-center text-sm text-muted-foreground">
            {t(
              'No documents on file yet. Add the vessel’s registration, permis de navigation, insurance and more.',
            )}
          </p>
        )}
        {live.map((d) => {
          const title = officialDocTitle(t, d.name)
          return (
          <div
            key={d.id}
            className="flex flex-wrap items-start justify-between gap-4 rounded-xl border border-border bg-card p-4"
          >
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <FileText className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium text-foreground">
                  <OfficialTitle name={d.name} />
                </span>
                <StatusBadge status={d.effective} />
                <ExpiryNotice
                  expiryDate={d.expiryDate}
                  days={d.daysUntilExpiry}
                />
              </div>
              <p className="mt-1 text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
                {t(docCategoryLabel(d.category))}
              </p>
              <div className="mt-2 space-y-0.5 text-sm text-muted-foreground">
                {d.number && (
                  <p>
                    {t('No.')} {d.number}
                  </p>
                )}
                {d.issuingAuthority && <p>{d.issuingAuthority}</p>}
                {d.notes && <p className="italic">{t(d.notes)}</p>}
              </div>
              {d.fileUrl && (
                <a
                  href={d.fileUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-3 inline-flex max-w-full flex-col gap-2 text-sm text-foreground underline-offset-2 hover:underline"
                >
                  {isImageUrl(d.fileUrl) && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={d.fileUrl}
                      alt={title.primary}
                      className="h-28 w-auto max-w-full rounded-md border border-border object-contain object-left"
                    />
                  )}
                  <span className="inline-flex items-center gap-1.5">
                    <ExternalLink className="h-3.5 w-3.5" aria-hidden />
                    {t('Open scan')}
                  </span>
                </a>
              )}
            </div>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => openEdit(d)}
                className="rounded-md p-2 text-muted-foreground hover:bg-muted hover:text-foreground"
                aria-label={`${t('Amend')} ${title.primary}`}
              >
                <Pencil className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => archive(d)}
                className="rounded-md p-2 text-muted-foreground hover:bg-muted hover:text-foreground"
                aria-label={`${t('Archive document')} ${title.primary}`}
              >
                <Archive className="h-4 w-4" />
              </button>
            </div>
          </div>
          )
        })}
      </div>

      {archived.length > 0 && (
        <div className="border-t border-border pt-4">
          <button
            type="button"
            onClick={() => setShowArchived((s) => !s)}
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
          >
            <RotateCcw className="h-4 w-4" />
            {t('Archived documents')} · {archived.length}
          </button>
          {showArchived && (
            <div className="mt-3 space-y-2">
              {archived.map((d) => (
                <div
                  key={d.id}
                  className="flex items-center justify-between gap-4 rounded-lg border border-border bg-muted/40 px-4 py-2.5 text-sm"
                >
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="text-muted-foreground line-through">
                      <OfficialTitle name={d.name} />
                    </span>
                    <ExpiryNotice
                      expiryDate={d.expiryDate}
                      days={d.daysUntilExpiry}
                    />
                  </span>
                  <span className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                    {t(docCategoryLabel(d.category))}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
