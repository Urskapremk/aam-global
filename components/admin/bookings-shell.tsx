'use client'

import { useState } from 'react'
import { Ship, Route, MapPinned, Building2 } from 'lucide-react'
import { BookingsManager } from '@/components/admin/bookings-manager'
import { TransfersManager } from '@/components/admin/transfers-manager'
import { TransferRoutesManager } from '@/components/admin/transfer-routes-manager'
import { CompanySettingsForm } from '@/components/admin/company-settings-form'
import type { BoatBooking } from '@/app/actions/boat-bookings'
import type {
  Transfer,
  TransferRoute,
  CompanySettings,
} from '@/app/actions/transfers'
import { cn } from '@/lib/utils'

type Tab = 'bookings' | 'transfers' | 'routes' | 'company'

const TABS: { id: Tab; label: string; icon: typeof Ship }[] = [
  { id: 'bookings', label: 'Boat bookings', icon: Ship },
  { id: 'transfers', label: 'Transfers', icon: MapPinned },
  { id: 'routes', label: 'Routes & prices', icon: Route },
  { id: 'company', label: 'Company details', icon: Building2 },
]

export function BookingsShell({
  bookings,
  transfers,
  routes,
  company,
}: {
  bookings: BoatBooking[]
  transfers: Transfer[]
  routes: TransferRoute[]
  company: CompanySettings
}) {
  const [tab, setTab] = useState<Tab>('bookings')
  const pendingTransfers = transfers.filter((t) => t.status === 'pending').length

  return (
    <div className="mx-auto max-w-4xl">
      {/* Top-level section tabs */}
      <div className="mb-8 flex flex-wrap gap-1 rounded-xl border border-border bg-card p-1">
        {TABS.map(({ id, label, icon: Icon }) => {
          const active = tab === id
          const badge = id === 'transfers' && pendingTransfers > 0
          return (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              className={cn(
                'inline-flex flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                active
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              <Icon className="h-4 w-4" strokeWidth={1.5} />
              <span className="hidden sm:inline">{label}</span>
              {badge && (
                <span
                  className={cn(
                    'ml-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-semibold',
                    active
                      ? 'bg-primary-foreground/20 text-primary-foreground'
                      : 'bg-amber-100 text-amber-800',
                  )}
                >
                  {pendingTransfers}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {tab === 'bookings' && <BookingsManager initial={bookings} />}
      {tab === 'transfers' && (
        <TransfersManager initial={transfers} routes={routes} />
      )}
      {tab === 'routes' && <TransferRoutesManager initial={routes} />}
      {tab === 'company' && <CompanySettingsForm initial={company} />}
    </div>
  )
}
