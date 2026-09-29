'use client'

import useSWR from 'swr'

import { getHrStaff } from '@/app/actions/hr'

export const inputClass =
  'w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent'

export const labelClass =
  'mb-1 block text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground'

export function useHrStaff() {
  return useSWR('hr-staff', () => getHrStaff())
}

export function todayIso(): string {
  return new Date(Date.now() + 3 * 3600_000).toISOString().slice(0, 10)
}

export function fmtDate(iso: string, locale = 'en-GB'): string {
  if (!iso) return '—'
  const d = new Date(`${iso}T00:00:00`)
  if (isNaN(d.getTime())) return iso
  return d.toLocaleDateString(locale, { day: 'numeric', month: 'short', year: 'numeric' })
}

export function Panel({
  title,
  action,
  children,
}: {
  title: string
  action?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <section className="overflow-hidden rounded-2xl border border-border bg-card">
      <header className="flex flex-wrap items-center justify-between gap-2 bg-panel-header px-5 py-3">
        <h2 className="text-sm font-medium text-panel-header-foreground">{title}</h2>
        {action}
      </header>
      {children}
    </section>
  )
}

export const headerButtonClass =
  'flex min-h-10 cursor-pointer items-center gap-1.5 rounded-full bg-panel-header-foreground/10 px-4 text-xs font-medium uppercase tracking-[0.1em] text-panel-header-foreground transition hover:bg-panel-header-foreground/20 disabled:opacity-50'

export const primaryButtonClass =
  'inline-flex min-h-10 cursor-pointer items-center justify-center gap-1.5 rounded-full bg-primary px-5 text-xs font-medium uppercase tracking-[0.1em] text-primary-foreground transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50'

export function StaffSelect({
  value,
  onChange,
  label,
}: {
  value: string
  onChange: (id: string) => void
  label: string
}) {
  const { data } = useHrStaff()
  return (
    <select
      aria-label={label}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={inputClass}
    >
      <option value="">—</option>
      {(data ?? [])
        .filter((s) => s.active)
        .map((s) => (
          <option key={s.id} value={s.id}>
            {s.name}
            {s.position ? ` · ${s.position}` : ''}
          </option>
        ))}
    </select>
  )
}

// Hides everything but `.hr-print-root` when printing, so a certificate or the
// employer register prints alone instead of the whole admin screen.
export function PrintStyles() {
  return (
    <style>{`
      @media print {
        body * { visibility: hidden !important; }
        .hr-print-root, .hr-print-root * { visibility: visible !important; }
        .hr-print-root { position: absolute; inset: 0; background: #fff; color: #111; padding: 24px; }
        @page { margin: 14mm; }
      }
    `}</style>
  )
}
