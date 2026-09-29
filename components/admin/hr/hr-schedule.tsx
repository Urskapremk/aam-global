'use client'

import { ChevronLeft, ChevronRight, ClipboardList, Plus, Printer, Settings2, Trash2, Wallet, Wand2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import { flushSync } from 'react-dom'
import useSWR from 'swr'

import { getHrLeave, type HrStaff } from '@/app/actions/hr'
import {
  deleteScheduleGroup,
  getScheduleGroups,
  getScheduleMonth,
  replaceScheduleMonth,
  saveScheduleGroup,
  sendScheduleHoursToPayroll,
  setScheduleCell,
} from '@/app/actions/hr-schedule'
import { LEAVE_LABELS, type LeaveKind } from '@/lib/hr'
import {
  DEFAULT_SHIFTS,
  OFF,
  SHIFT_CLASSES,
  SHIFT_COLORS,
  generateMonth,
  holidayName,
  monthDates,
  summarizeHours,
  weekday,
  type ScheduleCell,
  type ScheduleGroup,
  type ScheduleShift,
} from '@/lib/hr-schedule'
import { useLang } from '@/lib/i18n/context'

import { Panel, headerButtonClass, inputClass, labelClass, primaryButtonClass, todayIso, useHrStaff } from './hr-shared'

const DAY_NAMES: Record<'en' | 'sl', string[]> = {
  en: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
  sl: ['Ned', 'Pon', 'Tor', 'Sre', 'Čet', 'Pet', 'Sob'],
}

const OFF_CLASS = 'border-border bg-transparent text-muted-foreground/60'

function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split('-').map(Number)
  const d = new Date(y, m - 1 + delta, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

const EXCLUDED_POSITION = /captain|capitaine|kapitan|manager|menedž|menedz|upravitelj|direkt|gérant|gerant/i

function isSchedulable(s: HrStaff): boolean {
  return s.role !== 'captain' && !EXCLUDED_POSITION.test(s.position ?? '')
}

function fmtHours(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(1).replace('.', ',')
}

export function HrSchedule() {
  const { t, lang } = useLang()
  const { data: staff } = useHrStaff()
  const { data: groups, mutate: mutateGroups } = useSWR('hr-schedule-groups', () => getScheduleGroups())
  const { data: leave } = useSWR('hr-leave', () => getHrLeave())

  const [groupId, setGroupId] = useState<string | null>(null)
  const [month, setMonth] = useState(todayIso().slice(0, 7))
  const [editing, setEditing] = useState<ScheduleGroup | 'new' | null>(null)
  const [view, setView] = useState<'person' | 'shift'>('person')
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [printMode, setPrintMode] = useState<'schedule' | 'attendance'>('schedule')

  function printAs(mode: 'schedule' | 'attendance') {
    flushSync(() => setPrintMode(mode))
    window.print()
  }

  const group = groups?.find((g) => g.id === groupId) ?? groups?.[0] ?? null

  const { data: cells, mutate: mutateCells } = useSWR(
    group ? ['hr-schedule-month', group.id, month] : null,
    () => getScheduleMonth(group!.id, month),
  )

  const staffById = useMemo(() => new Map((staff ?? []).map((s) => [s.id, s])), [staff])
  const members = useMemo(
    () => (group?.memberIds ?? []).map((id) => staffById.get(id)).filter((s): s is HrStaff => !!s && isSchedulable(s)),
    [group, staffById],
  )

  const leaveOn = useMemo(() => {
    const list = leave ?? []
    return (staffId: string, iso: string) =>
      list.find((l) => l.staffId === staffId && l.startDate <= iso && l.endDate >= iso) ?? null
  }, [leave])

  const cellMap = useMemo(() => {
    const m = new Map<string, string>()
    for (const c of cells ?? []) m.set(`${c.staffId}|${c.date}`, c.shift)
    return m
  }, [cells])

  const dates = monthDates(month)
  const shiftByCode = new Map((group?.shifts ?? []).map((s) => [s.code, s]))
  const hours = group
    ? summarizeHours(
        members.map((m) => m.id),
        cells ?? [],
        group.shifts,
      )
    : []

  const [yy, mm] = month.split('-').map(Number)
  const monthLabel = new Date(yy, mm - 1, 1).toLocaleDateString(lang === 'sl' ? 'sl-SI' : 'en-GB', {
    month: 'long',
    year: 'numeric',
  })
  const today = todayIso()

  async function setCell(staffId: string, iso: string, next: string) {
    if (!group) return
    if ((cellMap.get(`${staffId}|${iso}`) ?? OFF) === next) return
    const optimistic: ScheduleCell[] = [
      ...(cells ?? []).filter((c) => !(c.staffId === staffId && c.date === iso)),
      { staffId, date: iso, shift: next },
    ]
    await mutateCells(
      async () => {
        await setScheduleCell(group.id, staffId, iso, next)
        return optimistic
      },
      { optimisticData: optimistic, rollbackOnError: true, revalidate: false },
    )
  }

  const [genOpen, setGenOpen] = useState(false)
  const [sundayOffIds, setSundayOffIds] = useState<string[]>([])

  function handleGenerate() {
    if (!group || members.length === 0) return
    const fixed = group.fixedShifts ?? {}
    setSundayOffIds(members.filter((m) => fixed[m.id]).map((m) => m.id))
    setEditing(null)
    setGenOpen(true)
  }

  async function runGenerate() {
    if (!group || members.length === 0) return
    const fixed = group.fixedShifts ?? {}
    const sundayOff = new Set(sundayOffIds)
    setGenOpen(false)
    setBusy(true)
    try {
      const generated = generateMonth(
        month,
        members.map((m) => m.id),
        group.shifts,
        (id, iso) => !!leaveOn(id, iso),
        fixed,
        sundayOff,
      )
      await replaceScheduleMonth(group.id, month, generated)
      await mutateCells(generated, { revalidate: false })
    } finally {
      setBusy(false)
    }
  }

  async function handleSendToPayroll() {
    if (hours.length === 0) return
    if (!confirm(t('Write Sunday and holiday hours of this month into Payroll MG?'))) return
    setBusy(true)
    try {
      const res = await sendScheduleHoursToPayroll(
        month,
        hours.map((h) => ({ staffId: h.staffId, sundayHours: h.sunday, holidayHours: h.holiday })),
      )
      setNotice(`${t('Hours sent to payroll')}: ${res.updated}`)
      setTimeout(() => setNotice(null), 4000)
    } finally {
      setBusy(false)
    }
  }

  function renderShiftChip(code: string, compact = false) {
    const s = shiftByCode.get(code)
    if (!s) return <span className="text-muted-foreground/50">—</span>
    return (
      <span
        className={`inline-flex items-center rounded-md border px-1.5 py-0.5 text-[11px] font-medium ${SHIFT_CLASSES[s.color]}`}
      >
        {compact ? s.label.split(' ')[0] : s.label}
      </span>
    )
  }

  if (!groups || !staff) {
    return <p className="text-sm text-muted-foreground">{t('Loading…')}</p>
  }

  return (
    <div className="space-y-6">
      <style>{`
        @media print {
          body * { visibility: hidden !important; }
          .hr-print-root, .hr-print-root * { visibility: visible !important; }
          .hr-print-root { position: absolute; inset: 0; background: #fff !important; color: #111 !important; padding: 0; }
          .hr-print-root * { color: #111 !important; border-color: #bbb !important; background: transparent !important; }
          .hr-print-root button { pointer-events: none; }
          .hr-att-page { break-after: page; page-break-after: always; }
          .hr-att-page:last-child { break-after: auto; page-break-after: auto; }
          @page { size: A4 ${printMode === 'attendance' ? 'portrait' : 'landscape'}; margin: ${printMode === 'attendance' ? '12mm' : '8mm'}; }
        }
      `}</style>

      {/* Schedule picker */}
      <div className="flex flex-wrap items-center gap-2 print:hidden">
        {groups.map((g) => {
          const active = g.id === group?.id
          return (
            <button
              key={g.id}
              type="button"
              aria-pressed={active}
              onClick={() => {
                setGroupId(g.id)
                setEditing(null)
              }}
              className={`min-h-10 cursor-pointer rounded-full border px-4 text-xs font-medium uppercase tracking-[0.1em] transition ${
                active
                  ? 'border-accent bg-accent/15 text-accent'
                  : 'border-border bg-card text-muted-foreground hover:text-foreground'
              }`}
            >
              {g.name}
              <span className="ml-1.5 opacity-60">· {g.memberIds.length}</span>
            </button>
          )
        })}
        <button
          type="button"
          onClick={() => setEditing('new')}
          className="flex min-h-10 cursor-pointer items-center gap-1.5 rounded-full border border-dashed border-border px-4 text-xs font-medium uppercase tracking-[0.1em] text-muted-foreground transition hover:border-accent hover:text-accent"
        >
          <Plus className="h-4 w-4" aria-hidden />
          {t('New schedule')}
        </button>
      </div>

      {editing && (
        <GroupEditor
          key={editing === 'new' ? 'new' : editing.id}
          initial={editing === 'new' ? null : editing}
          staff={staff}
          onClose={() => setEditing(null)}
          onSaved={async (id) => {
            await mutateGroups()
            setGroupId(id)
            setEditing(null)
            await mutateCells()
          }}
          onDeleted={async () => {
            await mutateGroups()
            setGroupId(null)
            setEditing(null)
          }}
        />
      )}

      {!group && !editing && (
        <div className="rounded-2xl border border-dashed border-border bg-card p-10 text-center">
          <p className="text-sm text-foreground">{t('No schedules yet.')}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {t('Create a schedule (e.g. Odyssey crew, office), choose its shifts and workers.')}
          </p>
          <button type="button" onClick={() => setEditing('new')} className={`${primaryButtonClass} mt-5`}>
            <Plus className="h-4 w-4" aria-hidden />
            {t('New schedule')}
          </button>
        </div>
      )}

      {group && (
        <>
          {genOpen && (
            <div
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 print:hidden"
              onClick={(e) => {
                if (e.target === e.currentTarget) setGenOpen(false)
              }}
            >
            <div
              role="dialog"
              aria-modal="true"
              aria-label={t('Generate month (6+1)')}
              className="w-full max-w-lg rounded-2xl border border-accent/40 bg-card p-6 shadow-2xl"
            >
              <p className="text-sm font-medium text-foreground">{t('Who is off every Sunday?')}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {t('Checked workers get every Sunday off. Others follow the normal 6+1 rotation.')}
              </p>
              <ul className="mt-4 flex flex-wrap gap-2">
                {members.map((m) => {
                  const checked = sundayOffIds.includes(m.id)
                  return (
                    <li key={m.id}>
                      <label
                        className={`flex min-h-10 cursor-pointer items-center gap-2 rounded-full border px-4 text-xs transition ${
                          checked ? 'border-accent bg-accent/15 text-accent' : 'border-border text-muted-foreground'
                        }`}
                      >
                        <input
                          type="checkbox"
                          className="accent-[var(--accent)]"
                          checked={checked}
                          onChange={(e) =>
                            setSundayOffIds((ids) =>
                              e.target.checked ? [...ids, m.id] : ids.filter((id) => id !== m.id),
                            )
                          }
                        />
                        {m.name}
                      </label>
                    </li>
                  )
                })}
              </ul>
              {(cells ?? []).length > 0 && (
                <p className="mt-4 text-xs text-amber-400">{t('Overwrite the whole month with a new rotation?')}</p>
              )}
              <div className="mt-4 flex flex-wrap gap-2">
                <button type="button" onClick={runGenerate} disabled={busy} className={primaryButtonClass}>
                  <Wand2 className="h-4 w-4" aria-hidden />
                  {t('Generate')}
                </button>
                <button
                  type="button"
                  onClick={() => setGenOpen(false)}
                  className="inline-flex min-h-10 cursor-pointer items-center rounded-full border border-border px-4 text-xs font-medium uppercase tracking-[0.1em] text-muted-foreground hover:text-foreground"
                >
                  {t('Cancel')}
                </button>
              </div>
            </div>
            </div>
          )}

          {/* Toolbar */}
          <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
            <div className="flex items-center gap-1">
              <button
                type="button"
                aria-label={t('Previous month')}
                onClick={() => setMonth((m) => shiftMonth(m, -1))}
                className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-full border border-border bg-card text-muted-foreground hover:text-foreground"
              >
                <ChevronLeft className="h-4 w-4" aria-hidden />
              </button>
              <p className="min-w-40 text-center text-sm font-medium capitalize text-foreground">{monthLabel}</p>
              <button
                type="button"
                aria-label={t('Next month')}
                onClick={() => setMonth((m) => shiftMonth(m, 1))}
                className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-full border border-border bg-card text-muted-foreground hover:text-foreground"
              >
                <ChevronRight className="h-4 w-4" aria-hidden />
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="flex rounded-full border border-border bg-card p-1" role="group" aria-label={t('View')}>
                {(['person', 'shift'] as const).map((v) => (
                  <button
                    key={v}
                    type="button"
                    aria-pressed={view === v}
                    onClick={() => setView(v)}
                    className={`min-h-8 cursor-pointer rounded-full px-3 text-[11px] font-medium uppercase tracking-[0.1em] transition ${
                      view === v ? 'bg-accent/15 text-accent' : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    {v === 'person' ? t('By person') : t('By shift')}
                  </button>
                ))}
              </div>
              <button
                type="button"
                onClick={handleGenerate}
                disabled={busy || members.length === 0}
                className={primaryButtonClass}
              >
                <Wand2 className="h-4 w-4" aria-hidden />
                {t('Generate month (6+1)')}
              </button>
              <button
                type="button"
                onClick={() => printAs('schedule')}
                className="inline-flex min-h-10 cursor-pointer items-center gap-1.5 rounded-full border border-border bg-card px-4 text-xs font-medium uppercase tracking-[0.1em] text-foreground transition hover:border-accent"
              >
                <Printer className="h-4 w-4" aria-hidden />
                {t('Print')}
              </button>
              <button
                type="button"
                onClick={() => printAs('attendance')}
                disabled={members.length === 0}
                className="inline-flex min-h-10 cursor-pointer items-center gap-1.5 rounded-full border border-border bg-card px-4 text-xs font-medium uppercase tracking-[0.1em] text-foreground transition hover:border-accent disabled:cursor-not-allowed disabled:opacity-50"
              >
                <ClipboardList className="h-4 w-4" aria-hidden />
                {t('Attendance sheet')}
              </button>
              <button
                type="button"
                onClick={() => setEditing(group)}
                className="inline-flex min-h-10 cursor-pointer items-center gap-1.5 rounded-full border border-border bg-card px-4 text-xs font-medium uppercase tracking-[0.1em] text-foreground transition hover:border-accent"
              >
                <Settings2 className="h-4 w-4" aria-hidden />
                {t('Edit schedule')}
              </button>
            </div>
          </div>

          {/* Legend */}
          <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground print:hidden">
            {group.shifts.map((s) => (
              <span key={s.code} className={`rounded-md border px-2 py-0.5 ${SHIFT_CLASSES[s.color]}`}>
                {s.label} · {fmtHours(s.hours)} h
              </span>
            ))}
            <span className={`rounded-md border px-2 py-0.5 ${OFF_CLASS}`}>{t('Off')}</span>
            <span className="rounded-md border border-dashed border-[#a08bc4]/50 px-2 py-0.5 text-[#a08bc4]">
              {t('Leave')}
            </span>
            <span className="ml-1">{t('Click a cell to change the shift.')}</span>
          </div>

          {members.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border bg-card p-8 text-center text-sm text-muted-foreground">
              {t('No workers in this schedule yet — add them under Edit schedule.')}
            </div>
          ) : (
            <div className={`hr-print-root ${printMode === 'attendance' ? 'print:hidden' : ''}`}>
              <h2 className="mb-2 hidden text-base font-semibold print:block">
                {group.name} — <span className="capitalize">{monthLabel}</span>
              </h2>
              <div className="overflow-x-auto rounded-2xl border border-border bg-card print:overflow-visible print:rounded-none">
                <table className="w-full border-collapse text-xs">
                  <thead>
                    <tr className="bg-panel-header text-panel-header-foreground">
                      <th scope="col" className="w-20 px-3 py-2 text-left font-medium">
                        {t('Day')}
                      </th>
                      {view === 'person'
                        ? members.map((m) => (
                            <th key={m.id} scope="col" className="px-2 py-2 text-left font-medium">
                              {m.name}
                            </th>
                          ))
                        : [...group.shifts.map((s) => ({ code: s.code, label: s.label })), { code: OFF, label: t('Off') }].map(
                            (s) => (
                              <th key={s.code} scope="col" className="px-2 py-2 text-left font-medium">
                                {s.label}
                              </th>
                            ),
                          )}
                    </tr>
                  </thead>
                  <tbody>
                    {dates.map((iso) => {
                      const wd = weekday(iso)
                      const holiday = holidayName(iso)
                      const special = wd === 0 || !!holiday
                      const isToday = iso === today
                      return (
                        <tr
                          key={iso}
                          className={`border-t border-border ${special ? 'bg-accent/[0.06]' : ''} ${
                            isToday ? 'outline outline-1 -outline-offset-1 outline-accent' : ''
                          }`}
                        >
                          <th scope="row" className="whitespace-nowrap px-3 py-1.5 text-left font-normal">
                            <span className={`tabular-nums ${special ? 'text-accent' : 'text-foreground'}`}>
                              {DAY_NAMES[lang][wd]} {Number(iso.slice(8, 10))}.
                            </span>
                            {holiday && (
                              <span className="block max-w-24 truncate text-[10px] text-accent/80" title={holiday}>
                                {holiday}
                              </span>
                            )}
                          </th>
                          {view === 'person'
                            ? members.map((m) => {
                                const lv = leaveOn(m.id, iso)
                                const code = cellMap.get(`${m.id}|${iso}`) ?? OFF
                                const s = shiftByCode.get(code)
                                return (
                                  <td key={m.id} className="px-1.5 py-1">
                                    {lv ? (
                                      <span className="flex min-h-7 items-center rounded-md border border-dashed border-[#a08bc4]/50 px-2 text-[11px] text-[#a08bc4]">
                                        {t(LEAVE_LABELS[lv.kind as LeaveKind] ?? 'Leave')}
                                      </span>
                                    ) : (
                                      <select
                                        value={s ? code : OFF}
                                        onChange={(e) => setCell(m.id, iso, e.target.value)}
                                        aria-label={`${m.name}, ${iso}`}
                                        className={`min-h-7 w-full cursor-pointer appearance-none rounded-md border px-2 text-[11px] font-medium transition hover:border-accent focus:outline-none focus:ring-1 focus:ring-accent ${
                                          s ? SHIFT_CLASSES[s.color] : OFF_CLASS
                                        }`}
                                      >
                                        {group.shifts
                                          .filter((sh) => {
                                            const fixed = group.fixedShifts?.[m.id]
                                            return !fixed || !shiftByCode.has(fixed) || sh.code === fixed || sh.code === code
                                          })
                                          .map((sh) => (
                                          <option key={sh.code} value={sh.code} className="bg-background text-foreground">
                                            {sh.label}
                                          </option>
                                        ))}
                                        <option value={OFF} className="bg-background text-foreground">
                                          {t('Off')}
                                        </option>
                                      </select>
                                    )}
                                  </td>
                                )
                              })
                            : [...group.shifts.map((s) => s.code), OFF].map((code) => {
                                const names = members.filter((m) => {
                                  const lv = leaveOn(m.id, iso)
                                  const c = cellMap.get(`${m.id}|${iso}`) ?? OFF
                                  return code === OFF ? !!lv || c === OFF : !lv && c === code
                                })
                                const shift = shiftByCode.get(code)
                                return (
                                  <td key={code} className="px-1.5 py-1">
                                    <div className="flex flex-wrap gap-1">
                                      {names.length === 0 && <span className="text-muted-foreground/40">—</span>}
                                      {names.map((m) => (
                                        <span
                                          key={m.id}
                                          className={`rounded-md border px-1.5 py-0.5 text-[11px] font-medium ${
                                            shift ? SHIFT_CLASSES[shift.color] : OFF_CLASS
                                          }`}
                                        >
                                          {m.name}
                                          {code === OFF && leaveOn(m.id, iso) ? ` (${t('leave')})` : ''}
                                        </span>
                                      ))}
                                    </div>
                                  </td>
                                )
                              })}
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {members.length > 0 && printMode === 'attendance' && (
            <div className="hr-print-root hidden print:block">
              {members.map((m) => {
                const summary = hours.find((h) => h.staffId === m.id)
                return (
                  <section key={m.id} className="hr-att-page text-[11px]">
                    <header className="mb-3 flex items-end justify-between border-b pb-2">
                      <div>
                        <p className="text-[10px] uppercase tracking-[0.15em]">{t('Attendance sheet')}</p>
                        <p className="text-base font-semibold">{m.name}</p>
                        <p>{m.position || '—'}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-medium">{group.name}</p>
                        <p className="capitalize">{monthLabel}</p>
                      </div>
                    </header>
                    <table className="w-full border-collapse">
                      <thead>
                        <tr>
                          <th className="border px-1.5 py-1 text-left font-medium">{t('Day')}</th>
                          <th className="border px-1.5 py-1 text-left font-medium">{t('Planned shift')}</th>
                          <th className="w-16 border px-1.5 py-1 text-left font-medium">{t('Arrival')}</th>
                          <th className="w-16 border px-1.5 py-1 text-left font-medium">{t('Departure')}</th>
                          <th className="w-12 border px-1.5 py-1 text-left font-medium">{t('Hours')}</th>
                          <th className="w-40 border px-1.5 py-1 text-left font-medium">{t('Signature')}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {dates.map((iso) => {
                          const wd = weekday(iso)
                          const holiday = holidayName(iso)
                          const lv = leaveOn(m.id, iso)
                          const code = cellMap.get(`${m.id}|${iso}`) ?? OFF
                          const s = shiftByCode.get(code)
                          const planned = lv
                            ? t(LEAVE_LABELS[lv.kind as LeaveKind] ?? 'Leave')
                            : s
                              ? `${s.label} · ${fmtHours(s.hours)} h`
                              : t('Off')
                          return (
                            <tr key={iso} className="h-[22px]">
                              <td className={`whitespace-nowrap border px-1.5 ${wd === 0 || holiday ? 'font-semibold' : ''}`}>
                                {DAY_NAMES[lang][wd]} {Number(iso.slice(8, 10))}.{holiday ? ` · ${holiday}` : ''}
                              </td>
                              <td className="border px-1.5">{planned}</td>
                              <td className="border" />
                              <td className="border" />
                              <td className="border" />
                              <td className="border" />
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                    <p className="mt-2">
                      {t('Planned')}: {summary?.shifts ?? 0} {t('Shifts').toLowerCase()} · {fmtHours(summary?.total ?? 0)} h
                    </p>
                    <div className="mt-10 flex justify-between gap-10">
                      <div className="flex-1 border-t pt-1 text-center">{t('Worker signature')}</div>
                      <div className="flex-1 border-t pt-1 text-center">{t('Manager signature')}</div>
                    </div>
                  </section>
                )
              })}
            </div>
          )}

          {/* Hours per person */}
          {members.length > 0 && (
            <div className="print:hidden">
              <Panel
                title={`${t('Hours this month')} · ${monthLabel}`}
                action={
                  <button type="button" onClick={handleSendToPayroll} disabled={busy} className={headerButtonClass}>
                    <Wallet className="h-4 w-4" aria-hidden />
                    {t('Send hours to payroll')}
                  </button>
                }
              >
                {notice && <p className="border-b border-border px-5 py-2 text-xs text-accent">{notice}</p>}
                <ul className="grid gap-px bg-border sm:grid-cols-2 lg:grid-cols-3">
                  {hours.map((h) => {
                    const person = staffById.get(h.staffId)
                    return (
                      <li key={h.staffId} className="bg-card p-4">
                        <p className="text-sm font-medium text-foreground">{person?.name}</p>
                        <p className="text-[11px] text-muted-foreground">{person?.position || '—'}</p>
                        <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                          <dt className="text-muted-foreground">{t('Shifts')}</dt>
                          <dd className="text-right tabular-nums text-foreground">{h.shifts}</dd>
                          <dt className="text-muted-foreground">{t('Total hours')}</dt>
                          <dd className="text-right font-medium tabular-nums text-foreground">{fmtHours(h.total)} h</dd>
                          <dt className="text-muted-foreground">{t('Sunday hours')}</dt>
                          <dd className="text-right tabular-nums text-accent">{fmtHours(h.sunday)} h</dd>
                          <dt className="text-muted-foreground">{t('Holiday hours')}</dt>
                          <dd className="text-right tabular-nums text-accent">{fmtHours(h.holiday)} h</dd>
                        </dl>
                      </li>
                    )
                  })}
                </ul>
              </Panel>
            </div>
          )}
        </>
      )}
    </div>
  )
}

function GroupEditor({
  initial,
  staff,
  onClose,
  onSaved,
  onDeleted,
}: {
  initial: ScheduleGroup | null
  staff: HrStaff[]
  onClose: () => void
  onSaved: (id: string) => void | Promise<void>
  onDeleted: () => void | Promise<void>
}) {
  const { t } = useLang()
  const [name, setName] = useState(initial?.name ?? '')
  const [shifts, setShifts] = useState<ScheduleShift[]>(
    initial?.shifts ?? DEFAULT_SHIFTS.map((s) => ({ ...s, label: t(s.label) })),
  )
  const [memberIds, setMemberIds] = useState<string[]>(
    initial?.memberIds ?? staff.filter((s) => s.active && isSchedulable(s)).map((s) => s.id),
  )
  const [fixedShifts, setFixedShifts] = useState<Record<string, string>>(initial?.fixedShifts ?? {})
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const activeStaff = staff.filter((s) => isSchedulable(s) && (s.active || memberIds.includes(s.id)))

  function updateShift(i: number, patch: Partial<ScheduleShift>) {
    setShifts((list) => list.map((s, idx) => (idx === i ? { ...s, ...patch } : s)))
  }

  function addShift() {
    setShifts((list) => {
      const used = new Set(list.map((s) => s.code))
      let n = list.length + 1
      while (used.has(`S${n}`)) n++
      return [...list, { code: `S${n}`, label: `${t('Shift')} ${n}`, hours: 8, color: SHIFT_COLORS[list.length % SHIFT_COLORS.length] }]
    })
  }

  async function handleSave() {
    setError(null)
    if (!name.trim()) return setError(t('Enter a schedule name.'))
    if (shifts.length === 0) return setError(t('Add at least one shift.'))
    setSaving(true)
    try {
      const res = await saveScheduleGroup({ id: initial?.id, name, shifts, memberIds, fixedShifts })
      await onSaved(res.id)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!initial) return
    if (!confirm(t('Delete this schedule and all its months?'))) return
    await deleteScheduleGroup(initial.id)
    await onDeleted()
  }

  return (
    <div className="print:hidden">
      <Panel title={initial ? t('Edit schedule') : t('New schedule')}>
        <div className="space-y-6 p-5">
          <div className="max-w-sm">
            <label htmlFor="sg-name" className={labelClass}>
              {t('Schedule name')}
            </label>
            <input
              id="sg-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t('e.g. Odyssey crew')}
              className={inputClass}
            />
          </div>

          <fieldset>
            <legend className={labelClass}>{t('Shifts')}</legend>
            <ul className="space-y-2">
              {shifts.map((s, i) => (
                <li key={s.code} className="flex flex-wrap items-center gap-2">
                  <input
                    aria-label={t('Shift name')}
                    value={s.label}
                    onChange={(e) => updateShift(i, { label: e.target.value })}
                    className={`${inputClass} max-w-60`}
                  />
                  <div className="flex items-center gap-1.5">
                    <input
                      aria-label={t('Hours')}
                      type="number"
                      min={0}
                      max={24}
                      step={0.5}
                      value={s.hours}
                      onChange={(e) => updateShift(i, { hours: Number(e.target.value) })}
                      className={`${inputClass} w-20`}
                    />
                    <span className="text-xs text-muted-foreground">h</span>
                  </div>
                  <div className="flex gap-1" role="radiogroup" aria-label={t('Color')}>
                    {SHIFT_COLORS.map((c) => (
                      <button
                        key={c}
                        type="button"
                        role="radio"
                        aria-checked={s.color === c}
                        aria-label={c}
                        onClick={() => updateShift(i, { color: c })}
                        className={`h-7 w-7 cursor-pointer rounded-full border-2 ${SHIFT_CLASSES[c]} ${
                          s.color === c ? 'ring-2 ring-accent ring-offset-1 ring-offset-card' : ''
                        }`}
                      />
                    ))}
                  </div>
                  <label className="flex min-h-9 cursor-pointer items-center gap-1.5 text-xs text-muted-foreground">
                    <input
                      type="checkbox"
                      checked={!!s.fixedOnly}
                      onChange={(e) => updateShift(i, { fixedOnly: e.target.checked })}
                      className="h-4 w-4 accent-[#c59b5b]"
                    />
                    {t('Only for fixed workers')}
                  </label>
                  <button
                    type="button"
                    aria-label={t('Delete')}
                    onClick={() => setShifts((list) => list.filter((_, idx) => idx !== i))}
                    disabled={shifts.length <= 1}
                    className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-full text-muted-foreground hover:text-destructive disabled:opacity-30"
                  >
                    <Trash2 className="h-4 w-4" aria-hidden />
                  </button>
                </li>
              ))}
            </ul>
            {shifts.length < 6 && (
              <button
                type="button"
                onClick={addShift}
                className="mt-2 flex min-h-9 cursor-pointer items-center gap-1.5 text-xs font-medium text-accent"
              >
                <Plus className="h-4 w-4" aria-hidden />
                {t('Add shift')}
              </button>
            )}
          </fieldset>

          <fieldset>
            <legend className={labelClass}>
              {t('Workers in this schedule')} · {memberIds.length}
            </legend>
            <div className="flex flex-wrap gap-2">
              {activeStaff.map((s) => {
                const on = memberIds.includes(s.id)
                return (
                  <button
                    key={s.id}
                    type="button"
                    aria-pressed={on}
                    onClick={() =>
                      setMemberIds((ids) => (on ? ids.filter((x) => x !== s.id) : [...ids, s.id]))
                    }
                    className={`min-h-9 cursor-pointer rounded-full border px-3 text-xs transition ${
                      on
                        ? 'border-accent bg-accent/15 text-accent'
                        : 'border-border text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    {s.name}
                    {s.position ? <span className="opacity-60"> · {s.position}</span> : null}
                  </button>
                )
              })}
              {activeStaff.length === 0 && (
                <p className="text-xs text-muted-foreground">{t('Add workers in the staff list first.')}</p>
              )}
            </div>
          </fieldset>

          {memberIds.length > 0 && shifts.length > 1 && (
            <fieldset>
              <legend className={labelClass}>{t('Shift pattern per worker')}</legend>
              <p className="mb-3 text-xs text-muted-foreground">
                {t('Rotating workers change shifts weekly. A fixed worker always gets the same shift (e.g. housekeeper — mornings only).')}
              </p>
              <ul className="grid gap-2 sm:grid-cols-2">
                {memberIds.map((id) => {
                  const person = staff.find((s) => s.id === id)
                  if (!person) return null
                  const value = shifts.some((s) => s.code === fixedShifts[id]) ? fixedShifts[id] : ''
                  return (
                    <li key={id} className="flex items-center justify-between gap-3 rounded-xl border border-border px-3 py-2">
                      <span className="min-w-0 truncate text-xs text-foreground">
                        {person.name}
                        {person.position ? <span className="text-muted-foreground"> · {person.position}</span> : null}
                      </span>
                      <select
                        aria-label={`${person.name} — ${t('Shift pattern per worker')}`}
                        value={value}
                        onChange={(e) =>
                          setFixedShifts((map) => {
                            const next = { ...map }
                            if (e.target.value) next[id] = e.target.value
                            else delete next[id]
                            return next
                          })
                        }
                        className={`${inputClass} w-auto min-w-40`}
                      >
                        <option value="">{t('Rotates')}</option>
                        {shifts.map((s) => (
                          <option key={s.code} value={s.code}>
                            {t('Only')}: {s.label}
                          </option>
                        ))}
                      </select>
                    </li>
                  )
                })}
              </ul>
            </fieldset>
          )}

          {error && <p className="text-xs text-destructive">{error}</p>}

          <div className="flex flex-wrap items-center gap-2">
            <button type="button" onClick={handleSave} disabled={saving} className={primaryButtonClass}>
              {t('Save')}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="min-h-10 cursor-pointer rounded-full border border-border px-5 text-xs font-medium uppercase tracking-[0.1em] text-foreground"
            >
              {t('Cancel')}
            </button>
            {initial && (
              <button
                type="button"
                onClick={handleDelete}
                className="ml-auto flex min-h-10 cursor-pointer items-center gap-1.5 rounded-full px-4 text-xs font-medium uppercase tracking-[0.1em] text-destructive hover:bg-destructive/10"
              >
                <Trash2 className="h-4 w-4" aria-hidden />
                {t('Delete schedule')}
              </button>
            )}
          </div>
        </div>
      </Panel>
    </div>
  )
}
