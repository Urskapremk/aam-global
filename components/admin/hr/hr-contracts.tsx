'use client'

import { Loader2 } from 'lucide-react'
import { useState } from 'react'

import { updateHrStaff, type HrStaff } from '@/app/actions/hr'
import { useT } from '@/lib/i18n/context'
import { CONTRACT_LABELS, type ContractType } from '@/lib/hr'

import { Panel, fmtDate, inputClass, labelClass, todayIso, useHrStaff } from './hr-shared'

function daysUntil(iso: string): number | null {
  if (!iso) return null
  const d = Date.parse(`${iso}T00:00:00Z`)
  const now = Date.parse(`${todayIso()}T00:00:00Z`)
  if (isNaN(d)) return null
  return Math.round((d - now) / 86_400_000)
}

function ContractRow({ staff, onSaved }: { staff: HrStaff; onSaved: () => void }) {
  const t = useT()
  const [saving, setSaving] = useState(false)
  const left = staff.contractType === 'CDI' ? null : daysUntil(staff.contractEnd)

  async function save(patch: Partial<HrStaff>) {
    setSaving(true)
    try {
      await updateHrStaff(staff.id, patch)
      onSaved()
    } finally {
      setSaving(false)
    }
  }

  let status: { text: string; cls: string }
  if (left == null) status = { text: t('Open-ended'), cls: 'bg-accent/15 text-accent' }
  else if (left < 0) status = { text: t('Expired'), cls: 'bg-destructive/15 text-destructive' }
  else if (left <= 30) status = { text: `${t('Ends in')} ${left} ${t('days')}`, cls: 'bg-[#c59b5b]/20 text-[#9a6b2f] dark:text-[#e0c68a]' }
  else status = { text: `${t('Until')} ${fmtDate(staff.contractEnd)}`, cls: 'bg-muted text-muted-foreground' }

  return (
    <li className="grid gap-3 p-4 md:grid-cols-[1.4fr_1fr_1fr_1fr_auto] md:items-end">
      <div>
        <p className="text-sm font-medium text-foreground">{staff.name}</p>
        <p className="mt-1 text-[11px] text-muted-foreground">{staff.position || '—'}</p>
      </div>
      <label>
        <span className={labelClass}>{t('Contract type')}</span>
        <select
          value={staff.contractType}
          onChange={(e) => save({ contractType: e.target.value })}
          className={inputClass}
        >
          {(Object.keys(CONTRACT_LABELS) as ContractType[]).map((k) => (
            <option key={k} value={k}>
              {t(CONTRACT_LABELS[k])}
            </option>
          ))}
        </select>
      </label>
      <label>
        <span className={labelClass}>{t('Start')}</span>
        <input
          type="date"
          defaultValue={staff.contractStart || staff.hireDate}
          onBlur={(e) => e.target.value !== staff.contractStart && save({ contractStart: e.target.value })}
          className={inputClass}
        />
      </label>
      <label>
        <span className={labelClass}>{t('End')}</span>
        <input
          type="date"
          defaultValue={staff.contractEnd}
          disabled={staff.contractType === 'CDI'}
          onBlur={(e) => e.target.value !== staff.contractEnd && save({ contractEnd: e.target.value })}
          className={`${inputClass} disabled:opacity-40`}
        />
      </label>
      <div className="flex items-center gap-2">
        {saving && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" aria-hidden />}
        <span className={`whitespace-nowrap rounded-full px-3 py-1 text-[11px] font-medium ${status.cls}`}>
          {status.text}
        </span>
      </div>
    </li>
  )
}

export function HrContracts() {
  const t = useT()
  const { data, isLoading, mutate } = useHrStaff()
  const people = (data ?? []).filter((s) => s.active)
  const expiring = people.filter((s) => {
    const d = s.contractType === 'CDI' ? null : daysUntil(s.contractEnd)
    return d != null && d <= 30
  })

  return (
    <div className="space-y-4">
      {expiring.length > 0 && (
        <p className="rounded-2xl border border-[#c59b5b]/40 bg-[#c59b5b]/10 p-4 text-sm text-foreground">
          {t('Contracts ending within 30 days or expired')}: <strong>{expiring.map((s) => s.name).join(', ')}</strong>
        </p>
      )}
      <Panel title={t('Contracts')}>
        {isLoading ? (
          <p className="p-5 text-sm text-muted-foreground">{t('Loading…')}</p>
        ) : people.length === 0 ? (
          <p className="p-5 text-sm text-muted-foreground">{t('No active staff.')}</p>
        ) : (
          <ul className="divide-y divide-border">
            {people.map((s) => (
              <ContractRow key={s.id} staff={s} onSaved={() => mutate()} />
            ))}
          </ul>
        )}
      </Panel>
    </div>
  )
}
