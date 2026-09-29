'use client'

import { Loader2, Plus, Printer, Trash2 } from 'lucide-react'
import { useState } from 'react'
import useSWR from 'swr'

import { addHrRecord, deleteHrRecord, getHrRecords } from '@/app/actions/hr'
import { getCompanySettings } from '@/app/actions/transfers'
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

const RECORD_TONE: Record<string, string> = {
  warning: 'bg-[#c59b5b]/20 text-[#9a6b2f] dark:text-[#e0c68a]',
  sanction: 'bg-destructive/15 text-destructive',
  commendation: 'bg-accent/15 text-accent',
}

const frDate = (iso: string) =>
  iso
    ? new Date(`${iso}T00:00:00`).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
    : '…'

function Certificate() {
  const t = useT()
  const staff = useHrStaff()
  const company = useSWR('company-settings', () => getCompanySettings())
  const [staffId, setStaffId] = useState('')
  const [endDate, setEndDate] = useState('')
  const [place, setPlace] = useState('Nosy Be')
  const person = staff.data?.find((s) => s.id === staffId)
  const c = company.data
  const companyName = c?.name || 'AAM'

  return (
    <Panel
      title={t('Certificate of employment')}
      action={
        <button
          type="button"
          disabled={!person}
          onClick={() => window.print()}
          className="flex min-h-10 cursor-pointer items-center gap-1.5 rounded-full bg-panel-header-foreground/10 px-4 text-xs font-medium uppercase tracking-[0.1em] text-panel-header-foreground transition hover:bg-panel-header-foreground/20 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Printer className="h-3.5 w-3.5" aria-hidden />
          {t('Print')}
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
        <div className="p-4">
          <article className="hr-print-root mx-auto max-w-2xl rounded-xl bg-white p-10 font-serif text-[15px] leading-relaxed text-neutral-900 shadow-sm">
            <header className="mb-10 text-sm leading-snug">
              <p className="font-semibold">{companyName}</p>
              {c?.addressLine1 && <p>{c.addressLine1}</p>}
              {(c?.city || c?.country) && <p>{[c?.city, c?.country].filter(Boolean).join(', ')}</p>}
              {c?.taxId && <p>NIF / STAT : {c.taxId}</p>}
            </header>
            <h3 className="mb-8 text-center text-xl font-semibold uppercase tracking-[0.2em]">Certificat de travail</h3>
            <p>
              Je soussigné, représentant de la société <strong>{companyName}</strong>, certifie que{' '}
              <strong>{person.name}</strong>
              {person.birthDate && <>, né(e) le {frDate(person.birthDate)}</>}
              {person.birthPlace && <> à {person.birthPlace}</>}
              {person.cin && <>, titulaire de la CIN n° {person.cin}</>}, {endDate ? 'a été employé(e)' : 'est employé(e)'} au sein de
              notre entreprise en qualité de <strong>{person.position || '…'}</strong> depuis le{' '}
              {frDate(person.hireDate || person.contractStart)}
              {endDate ? <> jusqu’au {frDate(endDate)}</> : <> à ce jour</>}.
            </p>
            <p className="mt-4">
              {endDate
                ? 'Il/Elle nous quitte libre de tout engagement.'
                : 'Ce certificat est délivré à l’intéressé(e) pour servir et valoir ce que de droit.'}
            </p>
            {endDate && <p className="mt-4">Ce certificat est délivré à l’intéressé(e) pour servir et valoir ce que de droit.</p>}
            <p className="mt-10 text-right">
              Fait à {place}, le {frDate(todayIso())}
            </p>
            <p className="mt-16 text-right">La Direction</p>
          </article>
        </div>
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
