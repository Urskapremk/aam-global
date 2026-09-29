'use client'

import { Loader2, Plus, Trash2 } from 'lucide-react'
import { useState } from 'react'
import useSWR from 'swr'

import { addHrLeave, deleteHrLeave, getHrLeave } from '@/app/actions/hr'
import { useT } from '@/lib/i18n/context'
import { LEAVE_LABELS, accruedLeave, leaveDays, type LeaveKind } from '@/lib/hr'

import {
  Panel,
  StaffSelect,
  fmtDate,
  inputClass,
  labelClass,
  primaryButtonClass,
  todayIso,
  useHrStaff,
} from './hr-shared'

const KIND_TONE: Record<string, string> = {
  annual: 'bg-accent/15 text-accent',
  sick: 'bg-[#1f6f96]/15 text-[#1f6f96] dark:text-[#7fb8d6]',
  unpaid: 'bg-muted text-muted-foreground',
  other: 'bg-[#c59b5b]/20 text-[#9a6b2f] dark:text-[#e0c68a]',
}

export function HrLeave() {
  const t = useT()
  const staff = useHrStaff()
  const leave = useSWR('hr-leave', () => getHrLeave())
  const today = todayIso()
  const year = Number(today.slice(0, 4))

  const [staffId, setStaffId] = useState('')
  const [start, setStart] = useState(today)
  const [end, setEnd] = useState(today)
  const [kind, setKind] = useState<LeaveKind>('annual')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const nameOf = (id: string) => staff.data?.find((s) => s.id === id)?.name ?? '—'
  const people = (staff.data ?? []).filter((s) => s.active)

  const usedThisYear = (id: string) =>
    (leave.data ?? [])
      .filter((l) => l.staffId === id && l.kind === 'annual' && l.startDate.startsWith(String(year)))
      .reduce((s, l) => s + leaveDays(l.startDate, l.endDate), 0)

  const onLeaveToday = (leave.data ?? []).filter((l) => l.startDate <= today && l.endDate >= today)

  return (
    <div className="space-y-4">
      {onLeaveToday.length > 0 && (
        <p className="rounded-2xl border border-accent/40 bg-accent/10 p-4 text-sm text-foreground">
          {t('Away today')}: <strong>{onLeaveToday.map((l) => nameOf(l.staffId)).join(', ')}</strong>
        </p>
      )}

      <Panel title={t('Record leave')}>
        <form
          onSubmit={async (e) => {
            e.preventDefault()
            setError('')
            if (!staffId) return setError(t('Choose a person.'))
            if (end < start) return setError(t('End date is before start date.'))
            setBusy(true)
            try {
              await addHrLeave({ staffId, startDate: start, endDate: end, kind, note })
              setNote('')
              leave.mutate()
            } catch (err) {
              setError(err instanceof Error ? err.message : String(err))
            } finally {
              setBusy(false)
            }
          }}
          className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-[1.5fr_1fr_1fr_1fr_1.5fr_auto] lg:items-end"
        >
          <label>
            <span className={labelClass}>{t('Person')}</span>
            <StaffSelect value={staffId} onChange={setStaffId} label={t('Person')} />
          </label>
          <label>
            <span className={labelClass}>{t('From')}</span>
            <input type="date" value={start} onChange={(e) => setStart(e.target.value)} className={inputClass} required />
          </label>
          <label>
            <span className={labelClass}>{t('To')}</span>
            <input type="date" value={end} onChange={(e) => setEnd(e.target.value)} className={inputClass} required />
          </label>
          <label>
            <span className={labelClass}>{t('Type')}</span>
            <select value={kind} onChange={(e) => setKind(e.target.value as LeaveKind)} className={inputClass}>
              {(Object.keys(LEAVE_LABELS) as LeaveKind[]).map((k) => (
                <option key={k} value={k}>
                  {t(LEAVE_LABELS[k])}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span className={labelClass}>{t('Note')}</span>
            <input value={note} onChange={(e) => setNote(e.target.value)} className={inputClass} />
          </label>
          <button type="submit" disabled={busy} className={primaryButtonClass}>
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : <Plus className="h-3.5 w-3.5" aria-hidden />}
            {t('Add')} · {leaveDays(start, end)} {t('days')}
          </button>
          {error && <p className="text-sm text-destructive sm:col-span-2 lg:col-span-6">{error}</p>}
        </form>
      </Panel>

      <Panel title={`${t('Leave balance')} ${year}`}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                <th className="px-4 py-2 font-medium">{t('Person')}</th>
                <th className="px-4 py-2 text-right font-medium">{t('Accrued')}</th>
                <th className="px-4 py-2 text-right font-medium">{t('Used')}</th>
                <th className="px-4 py-2 text-right font-medium">{t('Remaining')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {people.map((s) => {
                const acc = accruedLeave(s.hireDate || null, year, today)
                const used = usedThisYear(s.id)
                const rem = acc - used
                return (
                  <tr key={s.id}>
                    <td className="px-4 py-2 text-foreground">{s.name}</td>
                    <td className="px-4 py-2 text-right tabular-nums text-muted-foreground">{acc.toLocaleString()}</td>
                    <td className="px-4 py-2 text-right tabular-nums text-muted-foreground">{used}</td>
                    <td className={`px-4 py-2 text-right font-medium tabular-nums ${rem < 0 ? 'text-destructive' : 'text-foreground'}`}>
                      {rem.toLocaleString()}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        <p className="border-t border-border p-4 text-[11px] text-muted-foreground">
          {t('2.5 days of paid leave accrue per month worked (Madagascar labour code). Only annual leave counts against the balance.')}
        </p>
      </Panel>

      <Panel title={t('All leave')}>
        {leave.isLoading ? (
          <p className="p-5 text-sm text-muted-foreground">{t('Loading…')}</p>
        ) : (leave.data ?? []).length === 0 ? (
          <p className="p-5 text-sm text-muted-foreground">{t('No leave recorded yet.')}</p>
        ) : (
          <ul className="divide-y divide-border">
            {(leave.data ?? []).map((l) => (
              <li key={l.id} className="flex flex-wrap items-center gap-3 p-4">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-foreground">{nameOf(l.staffId)}</p>
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    {fmtDate(l.startDate)} – {fmtDate(l.endDate)} · {leaveDays(l.startDate, l.endDate)} {t('days')}
                    {l.note && ` · ${l.note}`}
                  </p>
                </div>
                <span className={`rounded-full px-3 py-1 text-[11px] font-medium ${KIND_TONE[l.kind] ?? KIND_TONE.other}`}>
                  {t(LEAVE_LABELS[l.kind as LeaveKind] ?? l.kind)}
                </span>
                <button
                  type="button"
                  aria-label={t('Delete')}
                  onClick={async () => {
                    if (!confirm(t('Delete this leave entry?'))) return
                    await deleteHrLeave(l.id)
                    leave.mutate()
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
    </div>
  )
}
