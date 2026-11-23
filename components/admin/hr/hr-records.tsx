'use client'

import { Anchor, Eye, Loader2, Plus, Printer, Trash2, X } from 'lucide-react'
import { useState } from 'react'
import { createPortal } from 'react-dom'
import useSWR from 'swr'

import { addHrRecord, deleteHrRecord, getHrRecords } from '@/app/actions/hr'
import { useT } from '@/lib/i18n/context'
import { RECORD_LABELS, type RecordKind } from '@/lib/hr'

import {
  Panel,
  PrintStyles,
  StaffSelect,
  fmtDate,
  inputClass,
  labelClass,
  primaryButtonClass,
  todayIso,
  useHrStaff,
} from './hr-shared'

/** Official AAM letterhead — same brand tokens as emails / transfer docs. */
const AAM_BRAND = 'AAM'
const AAM_COMPANY = 'African Adventures Madagascar'
const AAM_LOCATION = 'Nosy Komba, Madagascar'
const AAM_SIGNATORY = 'Mike Schneider'
const AAM_NAVY = '#1e3a5f'

const RECORD_TONE: Record<string, string> = {
  warning: 'bg-[#c59b5b]/20 text-[#9a6b2f] dark:text-[#e0c68a]',
  sanction: 'bg-destructive/15 text-destructive',
  commendation: 'bg-accent/15 text-accent',
}

const frDate = (iso: string) =>
  iso
    ? new Date(`${iso}T00:00:00`).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
    : '…'

type CertificatePerson = {
  name: string
  birthDate?: string | null
  birthPlace?: string | null
  cin?: string | null
  position?: string | null
  hireDate?: string | null
  contractStart?: string | null
}

function CertificateDocument({
  person,
  endDate,
  place,
}: {
  person: CertificatePerson
  endDate: string
  place: string
}) {
  return (
    <article className="hr-print-root mx-auto max-w-2xl bg-white p-10 font-serif text-[15px] leading-relaxed text-neutral-900">
      <header className="mb-10">
        <div className="flex items-center gap-2.5" style={{ color: AAM_NAVY }}>
          <Anchor className="h-5 w-5 shrink-0" strokeWidth={1.5} aria-hidden />
          <span className="text-2xl font-semibold leading-none tracking-[0.2em]">{AAM_BRAND}</span>
        </div>
        <p className="mt-3 text-base font-medium" style={{ color: AAM_NAVY }}>
          {AAM_COMPANY}
        </p>
        <p className="mt-0.5 text-sm text-neutral-600">{AAM_LOCATION}</p>
      </header>
      <h3 className="mb-8 text-center text-xl font-semibold uppercase tracking-[0.2em]">
        Certificat de travail
      </h3>
      <p>
        Je soussigné, représentant de la société <strong>{AAM_COMPANY}</strong>, certifie que{' '}
        <strong>{person.name}</strong>
        {person.birthDate && <>, né(e) le {frDate(person.birthDate)}</>}
        {person.birthPlace && <> à {person.birthPlace}</>}
        {person.cin && <>, titulaire de la CIN n° {person.cin}</>}, {endDate ? 'a été employé(e)' : 'est employé(e)'} au
        sein de notre entreprise en qualité de <strong>{person.position || '…'}</strong> depuis le{' '}
        {frDate(person.hireDate || person.contractStart || '')}
        {endDate ? <> jusqu’au {frDate(endDate)}</> : <> à ce jour</>}.
      </p>
      <p className="mt-4">
        {endDate
          ? 'Il/Elle nous quitte libre de tout engagement.'
          : 'Ce certificat est délivré à l’intéressé(e) pour servir et valoir ce que de droit.'}
      </p>
      {endDate && (
        <p className="mt-4">Ce certificat est délivré à l’intéressé(e) pour servir et valoir ce que de droit.</p>
      )}
      <p className="mt-10 text-right">
        Fait à {place}, le {frDate(todayIso())}
      </p>
      <div className="mt-16 text-right">
        <p>La Direction</p>
        <p className="mt-6 font-medium">{AAM_SIGNATORY}</p>
      </div>
    </article>
  )
}

function CertificatePreviewModal({
  person,
  endDate,
  place,
  onClose,
}: {
  person: CertificatePerson
  endDate: string
  place: string
  onClose: () => void
}) {
  const t = useT()

  if (typeof document === 'undefined') return null

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4 print:static print:bg-transparent print:p-0"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-card shadow-xl print:max-h-none print:w-full print:max-w-none print:rounded-none print:shadow-none"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={t('Certificate of employment')}
      >
        <div className="flex items-center justify-between gap-2 border-b border-border px-5 py-3 print:hidden">
          <h2 className="font-serif text-lg text-foreground">{t('Certificate of employment')}</h2>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex min-h-10 cursor-pointer items-center gap-1.5 rounded-full bg-primary px-4 text-xs font-medium uppercase tracking-[0.1em] text-primary-foreground transition hover:opacity-90"
            >
              <Printer className="h-3.5 w-3.5" aria-hidden />
              {t('Print')}
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label={t('Close')}
              className="inline-flex h-10 w-10 cursor-pointer items-center justify-center rounded-full border border-border text-muted-foreground transition hover:text-foreground"
            >
              <X className="h-4 w-4" aria-hidden />
            </button>
          </div>
        </div>
        <div className="overflow-y-auto bg-neutral-100 p-4 print:bg-white print:p-0">
          <div className="rounded-xl shadow-sm print:rounded-none print:shadow-none">
            <CertificateDocument person={person} endDate={endDate} place={place} />
          </div>
        </div>
      </div>
    </div>,
    document.body,
  )
}

function Certificate() {
  const t = useT()
  const staff = useHrStaff()
  const [staffId, setStaffId] = useState('')
  const [endDate, setEndDate] = useState('')
  const [place, setPlace] = useState('Nosy Be')
  const [previewOpen, setPreviewOpen] = useState(false)
  const person = staff.data?.find((s) => s.id === staffId)

  return (
    <Panel
      title={t('Certificate of employment')}
      action={
        <button
          type="button"
          disabled={!person}
          onClick={() => setPreviewOpen(true)}
          className="flex min-h-10 cursor-pointer items-center gap-1.5 rounded-full bg-panel-header-foreground/10 px-4 text-xs font-medium uppercase tracking-[0.1em] text-panel-header-foreground transition hover:bg-panel-header-foreground/20 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Eye className="h-3.5 w-3.5" aria-hidden />
          {t('Preview')}
        </button>
      }
    >
      <PrintStyles />
      <div className="grid gap-3 border-b border-border p-4 sm:grid-cols-3">
        <label>
          <span className={labelClass}>{t('Person')}</span>
          <StaffSelect value={staffId} onChange={setStaffId} label={t('Person')} />
        </label>
        <label>
          <span className={labelClass}>{t('End of employment (empty = still employed)')}</span>
          <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className={inputClass} />
        </label>
        <label>
          <span className={labelClass}>{t('Place')}</span>
          <input value={place} onChange={(e) => setPlace(e.target.value)} className={inputClass} />
        </label>
      </div>
      {!person ? (
        <p className="p-5 text-sm text-muted-foreground">{t('Choose a person to preview the certificate.')}</p>
      ) : (
        <p className="p-5 text-sm text-muted-foreground">
          {t('Open the preview to review the certificate, then print from there.')}
        </p>
      )}
      {previewOpen && person && (
        <CertificatePreviewModal
          person={person}
          endDate={endDate}
          place={place}
          onClose={() => setPreviewOpen(false)}
        />
      )}
    </Panel>
  )
}

function Discipline() {
  const t = useT()
  const staff = useHrStaff()
  const records = useSWR('hr-records', () => getHrRecords())
  const [staffId, setStaffId] = useState('')
  const [date, setDate] = useState(todayIso())
  const [kind, setKind] = useState<RecordKind>('warning')
  const [description, setDescription] = useState('')
  const [busy, setBusy] = useState(false)
  const nameOf = (id: string) => staff.data?.find((s) => s.id === id)?.name ?? '—'

  return (
    <Panel title={t('Disciplinary & commendation records')}>
      <form
        onSubmit={async (e) => {
          e.preventDefault()
          if (!staffId || !description.trim()) return
          setBusy(true)
          try {
            await addHrRecord({ staffId, date, kind, description })
            setDescription('')
            records.mutate()
          } finally {
            setBusy(false)
          }
        }}
        className="grid gap-3 border-b border-border p-4 sm:grid-cols-3"
      >
        <label>
          <span className={labelClass}>{t('Person')}</span>
          <StaffSelect value={staffId} onChange={setStaffId} label={t('Person')} />
        </label>
        <label>
          <span className={labelClass}>{t('Date')}</span>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inputClass} required />
        </label>
        <label>
          <span className={labelClass}>{t('Type')}</span>
          <select value={kind} onChange={(e) => setKind(e.target.value as RecordKind)} className={inputClass}>
            {(Object.keys(RECORD_LABELS) as RecordKind[]).map((k) => (
              <option key={k} value={k}>
                {t(RECORD_LABELS[k])}
              </option>
            ))}
          </select>
        </label>
        <label className="sm:col-span-3">
          <span className={labelClass}>{t('Description')}</span>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            className={inputClass}
            required
          />
        </label>
        <div className="sm:col-span-3">
          <button type="submit" disabled={busy || !staffId || !description.trim()} className={primaryButtonClass}>
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : <Plus className="h-3.5 w-3.5" aria-hidden />}
            {t('Add record')}
          </button>
        </div>
      </form>
      {(records.data ?? []).length === 0 ? (
        <p className="p-5 text-sm text-muted-foreground">{t('No records yet.')}</p>
      ) : (
        <ul className="divide-y divide-border">
          {(records.data ?? []).map((r) => (
            <li key={r.id} className="flex flex-wrap items-start gap-3 p-4">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-medium text-foreground">{nameOf(r.staffId)}</p>
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.1em] ${RECORD_TONE[r.kind] ?? ''}`}>
                    {t(RECORD_LABELS[r.kind as RecordKind] ?? r.kind)}
                  </span>
                  <span className="text-[11px] text-muted-foreground">{fmtDate(r.date)}</span>
                </div>
                <p className="mt-1 whitespace-pre-line text-sm text-muted-foreground">{r.description}</p>
              </div>
              <button
                type="button"
                aria-label={t('Delete')}
                onClick={async () => {
                  if (!confirm(t('Delete this record?'))) return
                  await deleteHrRecord(r.id)
                  records.mutate()
                }}
                className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-full text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
              >
                <Trash2 className="h-4 w-4" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  )
}

export function HrRecords() {
  return (
    <div className="space-y-4">
      <Certificate />
      <Discipline />
    </div>
  )
}
