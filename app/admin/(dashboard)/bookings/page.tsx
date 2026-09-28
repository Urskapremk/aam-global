import { getBookings } from '@/app/actions/boat-bookings'
import {
  getTransfers,
  getRoutes,
  getCompanySettings,
} from '@/app/actions/transfers'
import { BookingsShell } from '@/components/admin/bookings-shell'

export const dynamic = 'force-dynamic'

export default async function AdminBookingsPage() {
  const [bookings, transfers, routes, company] = await Promise.all([
    getBookings(),
    getTransfers(),
    getRoutes(),
    getCompanySettings(),
  ])
  return (
    <BookingsShell
      bookings={bookings}
      transfers={transfers}
      routes={routes}
      company={company}
    />
  )
}
