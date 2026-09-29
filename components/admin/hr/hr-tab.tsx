'use client'

import { BookOpen, CalendarClock, CalendarDays, FileSignature, FileText, Users, Wallet, type LucideIcon } from 'lucide-react'
import { useState } from 'react'

import { useT } from '@/lib/i18n/context'

import { HrContracts } from './hr-contracts'
import { HrLeave } from './hr-leave'
import { HrPayrollMg } from './hr-payroll-mg'
import { HrRecords } from './hr-records'
import { HrRegister } from './hr-register'
import { HrSchedule } from './hr-schedule'
import { HrStaffList } from './hr-staff-list'

type View = 'staff' | 'schedule' | 'payroll' | 'contracts' | 'leave' | 'records' | 'register'

const VIEWS: { id: View; label: string; icon: LucideIcon }[] = [
  { id: 'staff', label: 'Staff list', icon: Users },
  { id: 'schedule', label: 'Work schedules', icon: CalendarClock },
  { id: 'payroll', label: 'Payroll MG', icon: Wallet },
  { id: 'contracts', label: 'Contracts', icon: FileSignature },
  { id: 'leave', label: 'Leave', icon: CalendarDays },
  { id: 'records', label: 'Certificate / Discipline', icon: FileText },
  { id: 'register', label: 'Employer register', icon: BookOpen },
]

export function HrTab() {
  const t = useT()
  const [view, setView] = useState<View>('staff')

  return (
    <div className="space-y-6">
      <nav aria-label={t('HR sections')} className="flex flex-wrap gap-2 print:hidden">
        {VIEWS.map((v) => {
          const Icon = v.icon
          const active = view === v.id
          return (
            <button
              key={v.id}
              type="button"
              aria-pressed={active}
              onClick={() => setView(v.id)}
              className={`flex min-h-10 cursor-pointer items-center gap-2 rounded-full border px-4 text-xs font-medium uppercase tracking-[0.1em] transition ${
                active
                  ? 'border-accent bg-accent/15 text-accent'
                  : 'border-border bg-card text-muted-foreground hover:text-foreground'
              }`}
            >
              <Icon className="h-4 w-4" aria-hidden />
              {t(v.label)}
            </button>
          )
        })}
      </nav>

      {view === 'staff' && <HrStaffList />}
      {view === 'schedule' && <HrSchedule />}
      {view === 'payroll' && <HrPayrollMg />}
      {view === 'contracts' && <HrContracts />}
      {view === 'leave' && <HrLeave />}
      {view === 'records' && <HrRecords />}
      {view === 'register' && <HrRegister />}
    </div>
  )
}
