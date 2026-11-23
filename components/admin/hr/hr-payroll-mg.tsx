'use client'

import { Anchor, ChevronDown, ChevronLeft, ChevronRight, Eye, Loader2, Printer, X } from 'lucide-react'
import { useState } from 'react'
import { createPortal } from 'react-dom'
import useSWR from 'swr'

import {
  getHrPayrollMonth,
  upsertHrPayrollEntry,
  type HrPayrollEntry,
  type HrStaff,
} from '@/app/actions/hr'
import { useLang, useT } from '@/lib/i18n/context'
import { ariary, calcPayslip, fullYearsBetween, type Payslip } from '@/lib/hr'

import { Panel, PrintStyles, inputClass, labelClass, todayIso, useHrStaff } from './hr-shared'

/** Official AAM letterhead — same tokens as Certificat de travail (hr-records). */
const AAM_BRAND = 'AAM'
const AAM_COMPANY = 'African Adventures Madagascar'
const AAM_LOCATION = 'Nosy Komba, Madagascar'
const AAM_SIGNATORY = 'Mike Schneider'
const AAM_NAVY = '#1e3a5f'

const frDate = (iso: string) =>
  iso
    ? new Date(`${iso}T00:00:00`).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
    : '…'

const frMonthLabel = (month: string) =>
  new Date(`${month}-01T00:00:00`).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })

function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split('-').map(Number)
  const d = new Date(Date.UTC(y, m - 1 + delta, 1))
  return d.toISOString().slice(0, 7)
}

// Payroll is done for the month just worked, so the default is last month.
function previousMonth(): string {
  return shiftMonth(new Date(Date.now() + 3 * 3600_000).toISOString().slice(0, 7), -1)
}

function emptyEntry(staffId: string, month: string): HrPayrollEntry {
  return {
    staffId,
    month,
    sundayHours: 0,
    holidayHours: 0,
    overtimeHours: 0,
    otherBonuses: 0,
    irsa: null,
    advances: 0,
    otherDeductions: 0,
  }
}

const ENTRY_FIELDS: { key: keyof HrPayrollEntry; label: string }[] = [
  { key: 'sundayHours', label: 'Sunday hours' },
  { key: 'holidayHours', label: 'Holiday hours' },
  { key: 'overtimeHours', label: 'Overtime hours' },
  { key: 'otherBonuses', label: 'Other bonuses (Ar)' },
  { key: 'irsa', label: 'IRSA (Ar, default 3 000)' },
  { key: 'advances', label: 'Advances (Ar)' },
  { key: 'otherDeductions', label: 'Other deductions (Ar)' },
]

function Line({ label, value, strong, muted }: { label: string; value: string; strong?: boolean; muted?: boolean }) {
  return (
    <div className={`flex justify-between gap-4 py-1 text-sm ${strong ? 'font-semibold text-foreground' : muted ? 'text-muted-foreground' : 'text-foreground'}`}>
      <span>{label}</span>
      <span className="tabular-nums">{value}</span>
    </div>
  )
}

function PayslipBreakdown({ slip }: { slip: Payslip }) {
  const { t } = useLang()
  return (
    <div className="space-y-0.5">
      <Line label={t('Base salary')} value={ariary(slip.baseSalary)} />
      {slip.sundayAmount > 0 && <Line label={t('Sunday bonus')} value={ariary(slip.sundayAmount)} />}
      {slip.holidayAmount > 0 && <Line label={t('Holiday bonus')} value={ariary(slip.holidayAmount)} />}
      {slip.overtimeAmount > 0 && <Line label={t('Overtime')} value={ariary(slip.overtimeAmount)} />}
      {slip.seniorityAmount > 0 && (
        <Line
          label={`${t('Seniority bonus')} (${Math.round(slip.seniorityRate * 100)} %)`}
          value={ariary(slip.seniorityAmount)}
        />
      )}
      {slip.otherBonuses > 0 && <Line label={t('Other bonuses')} value={ariary(slip.otherBonuses)} />}
      <Line
        label={t('Gross-up (contributions and IRSA)')}
        value={ariary(slip.totalEmployeeContributions + slip.irsa)}
        muted
      />
      <div className="my-1 border-t border-border" />
      <Line label={t('Gross pay')} value={ariary(slip.grossPay)} strong />
      {slip.contributions
        .filter((c) => c.employeeAmount > 0)
        .map((c) => (
          <Line
            key={c.id}
            label={`− ${c.name} ${Math.round(c.employeeRate * 100)} %`}
            value={ariary(c.employeeAmount)}
            muted
          />
        ))}
      <Line label="− IRSA" value={ariary(slip.irsa)} muted />
      {slip.advances > 0 && <Line label={`− ${t('Advances')}`} value={ariary(slip.advances)} muted />}
      {slip.otherDeductions > 0 && (
        <Line label={`− ${t('Other deductions')}`} value={ariary(slip.otherDeductions)} muted />
      )}
      <div className="my-1 border-t border-border" />
      <Line label={t('Net to pay')} value={ariary(slip.netToPay)} strong />
      <div className="mt-2 rounded-lg bg-muted/40 p-2">
        {slip.contributions.map((c) => (
          <Line
            key={c.id}
            label={`${t('Employer')} ${c.name} ${(c.employerRate * 100).toLocaleString()} %`}
            value={ariary(c.employerAmount)}
            muted
          />
        ))}
        <Line label={t('Total employer cost')} value={ariary(slip.totalEmployerCost)} strong />
      </div>
    </div>
  )
}

function PayrollRow({
  staff,
  entry,
  month,
  paidAr,
  onSaved,
}: {
  staff: HrStaff
  entry: HrPayrollEntry
  month: string
  paidAr: number
  onSaved: () => void
}) {
  const { t } = useLang()
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState(entry)
  const [saving, setSaving] = useState(false)
  const periodEnd = `${month}-28`
  const slip = calcPayslip({
    baseSalary: staff.baseSalaryAr,
    ...draft,
    seniorityYears: fullYearsBetween(staff.hireDate || null, periodEnd),
  })

  async function persist(next: HrPayrollEntry) {
    setSaving(true)
    try {
      await upsertHrPayrollEntry(next)
      onSaved()
    } finally {
      setSaving(false)
    }
  }

  return (
    <li>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full cursor-pointer flex-wrap items-center gap-x-6 gap-y-2 p-4 text-left transition hover:bg-muted/40"
      >
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-foreground">{staff.name}</p>
          <p className="mt-1 text-[11px] text-muted-foreground">
            {staff.position || '—'}
            {staff.baseSalaryAr <= 0 && ` · ${t('No base salary set in the staff list')}`}
          </p>
        </div>
        {[
          { label: 'Gross', value: slip.grossPay },
          { label: 'Net to pay', value: slip.netToPay },
          { label: 'Employer cost', value: slip.totalEmployerCost },
        ].map((c) => (
          <div key={c.label} className="text-right">
            <p className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">{t(c.label)}</p>
            <p className="text-sm font-medium tabular-nums text-foreground">{ariary(c.value)}</p>
          </div>
        ))}
        <div className="text-right">
          <p className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">{t('Paid (crew ledger)')}</p>
          <p className={`text-sm font-medium tabular-nums ${paidAr > 0 ? 'text-accent' : 'text-muted-foreground'}`}>
            {paidAr > 0 ? ariary(paidAr) : '—'}
          </p>
        </div>
        <ChevronDown className={`h-4 w-4 text-muted-foreground transition ${open ? 'rotate-180' : ''}`} aria-hidden />
      </button>
      {open && (
        <div className="grid gap-6 border-t border-border bg-muted/20 p-4 lg:grid-cols-2">
          <div>
            <p className={labelClass}>
              {t('Monthly entry')}
              {saving && <Loader2 className="ml-1 inline h-3 w-3 animate-spin" aria-hidden />}
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              {ENTRY_FIELDS.map((f) => (
                <label key={f.key}>
                  <span className={labelClass}>{t(f.label)}</span>
                  <input
                    type="number"
                    min={0}
                    value={draft[f.key] == null ? '' : String(draft[f.key])}
                    placeholder={f.key === 'irsa' ? '3000' : '0'}
                    onChange={(e) =>
                      setDraft((d) => ({
                        ...d,
                        [f.key]:
                          e.target.value === '' ? (f.key === 'irsa' ? null : 0) : Number(e.target.value),
                      }))
                    }
                    onBlur={() => persist(draft)}
                    className={inputClass}
                  />
                </label>
              ))}
            </div>
            <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground">
              {t('Base salary is the net the worker receives. CNAPS 1 %, OMINO 1 % and IRSA are grossed up on top and then deducted, so the payout is base + bonuses − advances.')}
            </p>
          </div>
          <PayslipBreakdown slip={slip} />
        </div>
      )}
    </li>
  )
}

function InternSalaryReceiptDocument({
  person,
  month,
  amountAr,
  place,
}: {
  person: Pick<HrStaff, 'name' | 'birthDate' | 'birthPlace' | 'cin' | 'position'>
  month: string
  amountAr: number
  place: string
}) {
  const period = frMonthLabel(month)
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
        Reçu de rémunération
      </h3>
      <p>
        Je soussigné, représentant de la société <strong>{AAM_COMPANY}</strong>, certifie avoir versé à{' '}
        <strong>{person.name}</strong>
        {person.birthDate && <>, né(e) le {frDate(person.birthDate)}</>}
        {person.birthPlace && <> à {person.birthPlace}</>}
        {person.cin && <>, titulaire de la CIN n° {person.cin}</>}, stagiaire
        {person.position ? (
          <>
            {' '}
            en qualité de <strong>{person.position}</strong>
          </>
        ) : null}
        , la somme de <strong>{ariary(amountAr)}</strong> au titre de la rémunération du mois de{' '}
        <strong className="capitalize">{period}</strong>.
      </p>
      <p className="mt-4">
        Ce document tient lieu de reçu de rémunération pour le mois concerné uniquement. Il ne constitue pas un
        bulletin de paie.
      </p>
      <p className="mt-4">Ce reçu est délivré à l’intéressé(e) pour servir et valoir ce que de droit.</p>
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

function InternReceiptPreviewModal({
  person,
  month,
  place,
  onClose,
}: {
  person: HrStaff
  month: string
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
        aria-label={t('Salary receipt (intern)')}
      >
        <div className="flex items-center justify-between gap-2 border-b border-border px-5 py-3 print:hidden">
          <h2 className="font-serif text-lg text-foreground">{t('Salary receipt (intern)')}</h2>
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
            <InternSalaryReceiptDocument
              person={person}
              month={month}
              amountAr={person.baseSalaryAr}
              place={place}
            />
          </div>
        </div>
      </div>
    </div>,
    document.body,
  )
}

function InternPayrollSection({
  interns,
  month,
  receiptStaffId,
  onPreview,
}: {
  interns: HrStaff[]
  month: string
  receiptStaffId: string | null
  onPreview: (id: string) => void
}) {
  const { t } = useLang()
  const receiptPerson = interns.find((s) => s.id === receiptStaffId) ?? null

  return (
    <>
      <Panel title={t('Interns — salary receipts')}>
        <p className="border-b border-border px-5 py-3 text-sm text-muted-foreground">
          {t('Interns are not on the full Madagascar payroll. Print a salary receipt for the selected month only.')}
        </p>
        {interns.length === 0 ? (
          <p className="p-5 text-sm text-muted-foreground">{t('No active interns.')}</p>
        ) : (
          <ul className="divide-y divide-border">
            {interns.map((s) => (
              <li key={s.id} className="flex flex-wrap items-center gap-x-6 gap-y-2 p-4">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-foreground">{s.name}</p>
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    {s.position || '—'}
                    {s.baseSalaryAr <= 0 && ` · ${t('No base salary set in the staff list')}`}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">{t('Amount')}</p>
                  <p className="text-sm font-medium tabular-nums text-foreground">{ariary(s.baseSalaryAr)}</p>
                </div>
                <button
                  type="button"
                  onClick={() => onPreview(s.id)}
                  className="flex min-h-10 cursor-pointer items-center gap-1.5 rounded-full border border-border px-4 text-xs font-medium uppercase tracking-[0.1em] text-foreground hover:bg-muted"
                >
                  <Eye className="h-3.5 w-3.5" aria-hidden />
                  {t('Preview receipt')}
                </button>
              </li>
            ))}
          </ul>
        )}
      </Panel>
      {receiptPerson && (
        <InternReceiptPreviewModal
          person={receiptPerson}
          month={month}
          place="Nosy Be"
          onClose={() => onPreview('')}
        />
      )}
    </>
  )
}

export function HrPayrollMg() {
  const { t, lang } = useLang()
  const [month, setMonth] = useState(previousMonth)
  const [receiptStaffId, setReceiptStaffId] = useState<string | null>(null)
  const staff = useHrStaff()
  const payroll = useSWR(['hr-payroll', month], () => getHrPayrollMonth(month))

  const active = staff.data ?? []
  const people = active.filter((s) => s.active && s.employmentType !== 'intern')
  const interns = active.filter((s) => s.active && s.employmentType === 'intern')
  const entryFor = (id: string) =>
    payroll.data?.entries.find((e) => e.staffId === id) ?? emptyEntry(id, month)

  const slips = people.map((s) =>
    calcPayslip({
      baseSalary: s.baseSalaryAr,
      ...entryFor(s.id),
      seniorityYears: fullYearsBetween(s.hireDate || null, `${month}-28`),
    }),
  )
  const total = (k: keyof Payslip) => slips.reduce((sum, s) => sum + (s[k] as number), 0)
  const internTotal = interns.reduce((sum, s) => sum + s.baseSalaryAr, 0)

  const monthLabel = new Date(`${month}-01T00:00:00`).toLocaleDateString(
    lang === 'sl' ? 'sl-SI' : lang === 'fr' ? 'fr-FR' : 'en-GB',
    {
      month: 'long',
      year: 'numeric',
    },
  )

  // When an intern receipt preview is open, it owns `.hr-print-root` — hide the
  // month summary print root so both documents do not print together.
  const summaryPrintClass = receiptStaffId
    ? 'hidden'
    : 'hr-print-root hidden print:block'

  return (
    <div className="space-y-4">
      <PrintStyles />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setMonth((m) => shiftMonth(m, -1))}
            aria-label={t('Previous month')}
            className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-full border border-border text-foreground hover:bg-muted"
          >
            <ChevronLeft className="h-4 w-4" aria-hidden />
          </button>
          <p className="min-w-40 text-center font-serif text-xl capitalize text-foreground">{monthLabel}</p>
          <button
            type="button"
            onClick={() => setMonth((m) => shiftMonth(m, 1))}
            aria-label={t('Next month')}
            className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-full border border-border text-foreground hover:bg-muted"
          >
            <ChevronRight className="h-4 w-4" aria-hidden />
          </button>
        </div>
        <button
          type="button"
          onClick={() => window.print()}
          disabled={!!receiptStaffId}
          className="flex min-h-10 cursor-pointer items-center gap-2 rounded-full border border-border px-4 text-xs font-medium uppercase tracking-[0.1em] text-foreground hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Printer className="h-4 w-4" aria-hidden />
          {t('Print payroll summary')}
        </button>
      </div>

      <div className="grid gap-3 sm:grid-cols-4">
        {[
          { label: 'Gross pay', value: total('grossPay') },
          { label: 'Net to pay', value: total('netToPay') },
          { label: 'Employer contributions', value: total('employerContributions') },
          { label: 'Total employer cost', value: total('totalEmployerCost') },
        ].map((c) => (
          <div key={c.label} className="rounded-2xl border border-border bg-card p-4">
            <p className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">{t(c.label)}</p>
            <p className="mt-1 font-serif text-xl tabular-nums text-foreground">{ariary(c.value)}</p>
          </div>
        ))}
      </div>

      <Panel title={t('Payroll (Madagascar)')}>
        {staff.isLoading || payroll.isLoading ? (
          <p className="flex items-center gap-2 p-5 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            {t('Loading…')}
          </p>
        ) : people.length === 0 ? (
          <p className="p-5 text-sm text-muted-foreground">{t('No active staff.')}</p>
        ) : (
          <ul className="divide-y divide-border">
            {people.map((s) => (
              <PayrollRow
                key={`${s.id}-${month}-${payroll.data ? 'loaded' : 'empty'}`}
                staff={s}
                month={month}
                entry={entryFor(s.id)}
                paidAr={payroll.data?.paidByName[s.crewName || s.name] ?? 0}
                onSaved={() => payroll.mutate()}
              />
            ))}
          </ul>
        )}
      </Panel>

      <InternPayrollSection
        interns={interns}
        month={month}
        receiptStaffId={receiptStaffId}
        onPreview={(id) => setReceiptStaffId(id || null)}
      />

      {/* Printable summary, hidden on screen. */}
      <div className={summaryPrintClass}>
        <h1 style={{ fontSize: 18, fontWeight: 600 }}>
          {t('Payroll (Madagascar)')} — <span className="capitalize">{monthLabel}</span>
        </h1>
        <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 12, fontSize: 11 }}>
          <thead>
            <tr>
              {['Name', 'Position', 'Base salary', 'Gross pay', 'CNAPS', 'OMINO', 'IRSA', 'Net to pay', 'Total employer cost'].map((h) => (
                <th key={h} style={{ textAlign: 'left', borderBottom: '1px solid #999', padding: '4px 6px' }}>
                  {t(h)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {people.map((s, i) => {
              const sl = slips[i]
              return (
                <tr key={s.id}>
                  <td style={{ padding: '4px 6px', borderBottom: '1px solid #ddd' }}>{s.name}</td>
                  <td style={{ padding: '4px 6px', borderBottom: '1px solid #ddd' }}>{s.position}</td>
                  <td style={{ padding: '4px 6px', borderBottom: '1px solid #ddd' }}>{ariary(sl.baseSalary)}</td>
                  <td style={{ padding: '4px 6px', borderBottom: '1px solid #ddd' }}>{ariary(sl.grossPay)}</td>
                  <td style={{ padding: '4px 6px', borderBottom: '1px solid #ddd' }}>{ariary(sl.contributions[0].employeeAmount)}</td>
                  <td style={{ padding: '4px 6px', borderBottom: '1px solid #ddd' }}>{ariary(sl.contributions[1].employeeAmount)}</td>
                  <td style={{ padding: '4px 6px', borderBottom: '1px solid #ddd' }}>{ariary(sl.irsa)}</td>
                  <td style={{ padding: '4px 6px', borderBottom: '1px solid #ddd' }}>{ariary(sl.netToPay)}</td>
                  <td style={{ padding: '4px 6px', borderBottom: '1px solid #ddd' }}>{ariary(sl.totalEmployerCost)}</td>
                </tr>
              )
            })}
          </tbody>
        </table>

        {interns.length > 0 && (
          <>
            <h2 style={{ fontSize: 14, fontWeight: 600, marginTop: 28 }}>
              {t('Interns — salary receipts')} — <span className="capitalize">{monthLabel}</span>
            </h2>
            <p style={{ fontSize: 11, color: '#555', marginTop: 4 }}>
              {t('Amount only — no CNAPS / OMINO / IRSA (not a full payslip).')}
            </p>
            <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 8, fontSize: 11 }}>
              <thead>
                <tr>
                  {['Name', 'Position', 'Amount'].map((h) => (
                    <th key={h} style={{ textAlign: 'left', borderBottom: '1px solid #999', padding: '4px 6px' }}>
                      {t(h)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {interns.map((s) => (
                  <tr key={s.id}>
                    <td style={{ padding: '4px 6px', borderBottom: '1px solid #ddd' }}>{s.name}</td>
                    <td style={{ padding: '4px 6px', borderBottom: '1px solid #ddd' }}>{s.position || '—'}</td>
                    <td style={{ padding: '4px 6px', borderBottom: '1px solid #ddd' }}>{ariary(s.baseSalaryAr)}</td>
                  </tr>
                ))}
                <tr>
                  <td colSpan={2} style={{ padding: '6px 6px', fontWeight: 600 }}>
                    {t('Total')}
                  </td>
                  <td style={{ padding: '6px 6px', fontWeight: 600 }}>{ariary(internTotal)}</td>
                </tr>
              </tbody>
            </table>
          </>
        )}
      </div>
    </div>
  )
}
