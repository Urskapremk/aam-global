'use client'

import { Printer } from 'lucide-react'
import useSWR from 'swr'

import { getCompanySettings } from '@/app/actions/transfers'
import { useT } from '@/lib/i18n/context'
import { CONTRACT_LABELS, ariary, type ContractType } from '@/lib/hr'

import { Panel, PrintStyles, fmtDate, todayIso, useHrStaff } from './hr-shared'

// Registre employeur: the legal register of every person employed, in hiring
// order, including those who have left. Printed in French for the inspection.
export function HrRegister() {
  const t = useT()
  const { data, isLoading } = useHrStaff()
  const company = useSWR('company-settings', () => getCompanySettings())
  const rows = [...(data ?? [])].sort((a, b) =>
    (a.hireDate || '9999').localeCompare(b.hireDate || '9999'),
  )

  const cols = [
    'N°',
    'Nom et prénoms',
    'Date de naissance',
    'CIN',
    'N° CNAPS',
    'Emploi',
    'Contrat',
    'Date d’embauche',
    'Date de départ',
    'Salaire de base',
  ]

  return (
    <Panel
      title={t('Employer register')}
      action={
        <button
          type="button"
          onClick={() => window.print()}
          className="flex min-h-10 cursor-pointer items-center gap-1.5 rounded-full bg-panel-header-foreground/10 px-4 text-xs font-medium uppercase tracking-[0.1em] text-panel-header-foreground transition hover:bg-panel-header-foreground/20"
        >
          <Printer className="h-3.5 w-3.5" aria-hidden />
          {t('Print')}
        </button>
      }
    >
      <PrintStyles />
      {isLoading ? (
        <p className="p-5 text-sm text-muted-foreground">{t('Loading…')}</p>
      ) : (
        <div className="hr-print-root overflow-x-auto p-4">
          <div className="mb-3 hidden print:block">
            <h1 style={{ fontSize: 18, fontWeight: 600 }}>Registre employeur — {company.data?.name || 'AAM'}</h1>
            <p style={{ fontSize: 11 }}>
              {company.data?.taxId && <>NIF / STAT : {company.data.taxId} · </>}Édité le {fmtDate(todayIso(), 'fr-FR')}
            </p>
          </div>
          <table className="w-full min-w-[900px] border-collapse text-xs">
            <thead>
              <tr className="border-b border-border text-left text-[10px] uppercase tracking-[0.1em] text-muted-foreground print:text-neutral-700">
                {cols.map((c) => (
                  <th key={c} className="px-2 py-2 font-medium">
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.map((s, i) => {
                const left = !s.active ? s.contractEnd || '—' : s.contractType !== 'CDI' ? s.contractEnd : ''
                return (
                  <tr key={s.id} className={s.active ? 'text-foreground' : 'text-muted-foreground'}>
                    <td className="px-2 py-2 tabular-nums">{i + 1}</td>
                    <td className="px-2 py-2 font-medium">{s.name}</td>
                    <td className="px-2 py-2">{s.birthDate ? fmtDate(s.birthDate, 'fr-FR') : '—'}</td>
                    <td className="px-2 py-2">{s.cin || '—'}</td>
                    <td className="px-2 py-2">{s.cnaps || '—'}</td>
                    <td className="px-2 py-2">{s.position || '—'}</td>
                    <td className="px-2 py-2">{t(CONTRACT_LABELS[s.contractType as ContractType] ?? s.contractType)}</td>
                    <td className="px-2 py-2">{s.hireDate ? fmtDate(s.hireDate, 'fr-FR') : '—'}</td>
                    <td className="px-2 py-2">{left && left !== '—' ? fmtDate(left, 'fr-FR') : left || '—'}</td>
                    <td className="px-2 py-2 text-right tabular-nums">{s.baseSalaryAr > 0 ? ariary(s.baseSalaryAr) : '—'}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          <p className="mt-3 text-[11px] text-muted-foreground print:hidden">
            {t('Data comes from the staff list — fill in CIN, CNAPS and hire date there to complete the register.')}
          </p>
        </div>
      )}
    </Panel>
  )
}
