'use client'

import { ChevronDown, ChevronLeft, ChevronRight, Loader2, Printer } from 'lucide-react'
import { useState } from 'react'
import useSWR from 'swr'

import {
  getHrPayrollMonth,
  upsertHrPayrollEntry,
  type HrPayrollEntry,
  type HrStaff,
} from '@/app/actions/hr'
import { useLang } from '@/lib/i18n/context'
import { ariary, calcPayslip, fullYearsBetween, type Payslip } from '@/lib/hr'

import { Panel, PrintStyles, inputClass, labelClass, useHrStaff } from './hr-shared'

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

export function HrPayrollMg() {
  const { t, lang } = useLang()
  const [month, setMonth] = useState(previousMonth)
  const staff = useHrStaff()
  const payroll = useSWR(['hr-payroll', month], () => getHrPayrollMonth(month))

  const people = (staff.data ?? []).filter((s) => s.active && s.employmentType !== 'intern')
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

  const monthLabel = new Date(`${month}-01T00:00:00`).toLocaleDateString(lang === 'sl' ? 'sl-SI' : 'en-GB', {
    month: 'long',
    year: 'numeric',
  })

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
          className="flex min-h-10 cursor-pointer items-center gap-2 rounded-full border border-border px-4 text-xs font-medium uppercase tracking-[0.1em] text-foreground hover:bg-muted"
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

      {/* Printable summary, hidden on screen. */}
      <div className="hr-print-root hidden print:block">
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
      </div>
    </div>
  )
}
