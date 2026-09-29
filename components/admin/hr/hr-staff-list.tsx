'use client'

import { ChevronDown, Loader2, Plus, Search, Trash2, UserPlus } from 'lucide-react'
import { useState } from 'react'

import { addHrStaff, deleteHrStaff, updateHrStaff, type HrStaff } from '@/app/actions/hr'
import { useT } from '@/lib/i18n/context'
import { EMPLOYMENT_LABELS, ariary, type EmploymentType } from '@/lib/hr'

import {
  Panel,
  headerButtonClass,
  inputClass,
  labelClass,
  primaryButtonClass,
  useHrStaff,
} from './hr-shared'
import { HrStaffDocuments } from './hr-staff-documents'

function roleTone(role: HrStaff['role']) {
  if (role === 'captain') return { fg: '#1f6f96', bg: '#1f6f9622', label: 'Captain' }
  if (role === 'crew') return { fg: '#4f7a54', bg: '#4f7a5422', label: 'Crew' }
  return { fg: '#9a6b2f', bg: '#c59b5b22', label: 'Staff' }
}

const PERSONAL_FIELDS: { key: keyof HrStaff; label: string; type?: string; wide?: boolean }[] = [
  { key: 'name', label: 'Full name' },
  { key: 'nickname', label: 'Nickname' },
  { key: 'position', label: 'Position' },
  { key: 'phone', label: 'Phone' },
  { key: 'birthDate', label: 'Date of birth', type: 'date' },
  { key: 'birthPlace', label: 'Place of birth' },
  { key: 'cin', label: 'ID card (CIN)' },
  { key: 'cnaps', label: 'CNAPS number' },
  { key: 'address', label: 'Address', wide: true },
  { key: 'hireDate', label: 'Hire date', type: 'date' },
  { key: 'baseSalaryAr', label: 'Base salary, net (Ar)', type: 'number' },
  { key: 'paymentMethod', label: 'Payment method' },
  { key: 'bankAccount', label: 'Bank / Mobile Money account' },
  { key: 'notes', label: 'Notes', wide: true },
]

function StaffCard({ staff, onSaved }: { staff: HrStaff; onSaved: () => void }) {
  const t = useT()
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState<string | null>(null)
  const tone = roleTone(staff.role)

  async function save(key: keyof HrStaff, value: string | number | boolean) {
    if (staff[key] === value) return
    if (key === 'name' && !value) return
    setSaving(key)
    try {
      await updateHrStaff(staff.id, { [key]: value } as Partial<HrStaff>)
      onSaved()
    } catch (e) {
      alert(t(e instanceof Error ? e.message : 'Save failed'))
    } finally {
      setSaving(null)
    }
  }

  const complete = !!(staff.cin && staff.hireDate && staff.baseSalaryAr > 0)

  return (
    <li className={staff.active ? '' : 'opacity-60'}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full cursor-pointer flex-wrap items-center gap-x-4 gap-y-2 p-4 text-left transition hover:bg-muted/40"
      >
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="truncate text-sm font-medium text-foreground">{staff.name}</span>
            {staff.nickname && (
              <span className="text-sm text-accent">„{staff.nickname}“</span>
            )}
            <span
              className="rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.1em]"
              style={{ color: tone.fg, backgroundColor: tone.bg }}
            >
              {t(tone.label)}
            </span>
            {complete && (
              <span className="rounded-full bg-accent/15 px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.1em] text-accent">
                {t('Complete')}
              </span>
            )}
            {!staff.active && (
              <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.1em] text-muted-foreground">
                {t('Inactive')}
              </span>
            )}
          </div>
          <p className="mt-1 text-[11px] text-muted-foreground">
            {staff.position || t('No position set')} ·{' '}
            {t(EMPLOYMENT_LABELS[staff.employmentType as EmploymentType] ?? staff.employmentType)}
          </p>
        </div>
        <div className="text-right">
          <p className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
            {t('Base salary')}
          </p>
          <p className="text-sm font-medium tabular-nums text-foreground">
            {staff.baseSalaryAr > 0 ? ariary(staff.baseSalaryAr) : '—'}
          </p>
        </div>
        <ChevronDown
          className={`h-4 w-4 text-muted-foreground transition ${open ? 'rotate-180' : ''}`}
          aria-hidden
        />
      </button>

      {open && (
        <div className="border-t border-border bg-muted/20 p-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <div className="sm:col-span-2 lg:col-span-3">
              <span className={labelClass}>{t('Employment type')}</span>
              <div className="flex flex-wrap gap-2">
                {(Object.keys(EMPLOYMENT_LABELS) as EmploymentType[]).map((k) => (
                  <button
                    key={k}
                    type="button"
                    aria-pressed={staff.employmentType === k}
                    onClick={() => save('employmentType', k)}
                    className={`min-h-9 cursor-pointer rounded-full border px-4 text-xs font-medium transition ${
                      staff.employmentType === k
                        ? 'border-accent bg-accent/15 text-accent'
                        : 'border-border text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    {t(EMPLOYMENT_LABELS[k])}
                  </button>
                ))}
              </div>
            </div>
            {PERSONAL_FIELDS.map((f) => (
              <label
                key={f.key}
                className={f.wide ? 'sm:col-span-2 lg:col-span-3' : ''}
              >
                <span className={labelClass}>
                  {t(f.label)}
                  {saving === f.key && (
                    <Loader2 className="ml-1 inline h-3 w-3 animate-spin" aria-hidden />
                  )}
                </span>
                <input
                  type={f.type ?? 'text'}
                  defaultValue={String(staff[f.key] ?? '')}
                  min={f.type === 'number' ? 0 : undefined}
                  onBlur={(e) =>
                    save(
                      f.key,
                      f.type === 'number' ? Number(e.target.value) || 0 : e.target.value.trim(),
                    )
                  }
                  className={`${inputClass} ${f.type === 'date' ? '[color-scheme:light] dark:[color-scheme:dark]' : ''}`}
                />
              </label>
            ))}
          </div>
          <HrStaffDocuments staffId={staff.id} />
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <p className="text-[11px] text-muted-foreground">
              {staff.source === 'crew'
                ? t('Linked to Crew payroll — name comes from the trips.')
                : t('Added manually in HR.')}
            </p>
            <div className="flex gap-2">
              {!staff.active ? (
                <button
                  type="button"
                  onClick={() => save('active', true)}
                  className="min-h-9 cursor-pointer rounded-full border border-border px-4 text-xs font-medium text-foreground hover:bg-muted"
                >
                  {t('Reactivate')}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={async () => {
                    if (!confirm(t('Remove from the list? The card stays in the inactive archive.'))) return
                    await deleteHrStaff(staff.id)
                    onSaved()
                  }}
                  className="flex min-h-9 cursor-pointer items-center gap-1.5 rounded-full border border-destructive/40 px-4 text-xs font-medium text-destructive hover:bg-destructive/10"
                >
                  <Trash2 className="h-3.5 w-3.5" aria-hidden />
                  {t('Remove from list')}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </li>
  )
}

export function HrStaffList() {
  const t = useT()
  const { data, isLoading, mutate } = useHrStaff()
  const [query, setQuery] = useState('')
  const [adding, setAdding] = useState(false)
  const [name, setName] = useState('')
  const [position, setPosition] = useState('')
  const [busy, setBusy] = useState(false)
  const [showInactive, setShowInactive] = useState(false)

  const q = query.trim().toLowerCase()
  const list = (data ?? []).filter(
    (s) =>
      s.active !== showInactive &&
      (!q || s.name.toLowerCase().includes(q) || s.nickname.toLowerCase().includes(q) || s.position.toLowerCase().includes(q)),
  )
  const active = (data ?? []).filter((s) => s.active)
  const inactiveCount = (data ?? []).length - active.length
  const payroll = active.reduce((s, x) => s + x.baseSalaryAr, 0)

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        {[
          { label: 'Active staff', value: String(active.length) },
          { label: 'Linked to crew', value: String(active.filter((s) => s.source === 'crew').length) },
          { label: 'Monthly base payroll', value: ariary(payroll) },
        ].map((s) => (
          <div key={s.label} className="rounded-2xl border border-border bg-card p-4">
            <p className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">{t(s.label)}</p>
            <p className="mt-1 font-serif text-2xl text-foreground tabular-nums">{s.value}</p>
          </div>
        ))}
      </div>

      <Panel
        title={t('Staff list')}
        action={
          <button type="button" onClick={() => setAdding((v) => !v)} className={headerButtonClass}>
            <UserPlus className="h-3.5 w-3.5" aria-hidden />
            {t('Add person')}
          </button>
        }
      >
        {adding && (
          <form
            onSubmit={async (e) => {
              e.preventDefault()
              if (!name.trim()) return
              setBusy(true)
              try {
                await addHrStaff(name, position)
                setName('')
                setPosition('')
                setAdding(false)
                mutate()
              } finally {
                setBusy(false)
              }
            }}
            className="flex flex-wrap items-end gap-3 border-b border-border bg-muted/20 p-4"
          >
            <label className="min-w-48 flex-1">
              <span className={labelClass}>{t('Full name')}</span>
              <input value={name} onChange={(e) => setName(e.target.value)} className={inputClass} required />
            </label>
            <label className="min-w-48 flex-1">
              <span className={labelClass}>{t('Position')}</span>
              <input value={position} onChange={(e) => setPosition(e.target.value)} className={inputClass} />
            </label>
            <button type="submit" disabled={busy || !name.trim()} className={primaryButtonClass}>
              {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : <Plus className="h-3.5 w-3.5" aria-hidden />}
              {t('Add')}
            </button>
          </form>
        )}
        <div className="flex flex-wrap items-center gap-3 border-b border-border p-4">
          <div className="flex gap-1 rounded-full border border-border p-1" role="group" aria-label={t('Status')}>
            {[
              { v: false, label: `${t('Active')} · ${active.length}` },
              { v: true, label: `${t('Inactive')} · ${inactiveCount}` },
            ].map((o) => (
              <button
                key={String(o.v)}
                type="button"
                aria-pressed={showInactive === o.v}
                onClick={() => setShowInactive(o.v)}
                className={`min-h-8 cursor-pointer rounded-full px-4 text-xs font-medium transition ${
                  showInactive === o.v
                    ? 'bg-accent/15 text-accent'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {o.label}
              </button>
            ))}
          </div>
          <div className="relative w-full max-w-xs">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t('Search by name or position')}
              aria-label={t('Search by name or position')}
              className={`${inputClass} pl-9`}
            />
          </div>
        </div>
        {isLoading ? (
          <p className="flex items-center gap-2 p-5 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            {t('Loading…')}
          </p>
        ) : list.length === 0 ? (
          <p className="p-5 text-sm text-muted-foreground">{t('No staff found.')}</p>
        ) : (
          <ul className="divide-y divide-border">
            {list.map((s) => (
              <StaffCard key={`${s.id}-${s.active}`} staff={s} onSaved={() => mutate()} />
            ))}
          </ul>
        )}
      </Panel>
    </div>
  )
}
