'use server'

import { getUnreadCount } from '@/app/actions/messages'
import { getPendingBookingsCount } from '@/app/actions/boat-bookings'
import { getPendingTransfersCount } from '@/app/actions/transfers'

export type AdminNotificationCounts = {
  unread: number
  pendingBookings: number
  pendingTransfers: number
  total: number
}

/**
 * Single lightweight poll used by the admin notifier to detect new activity
 * (incoming emails, boat-booking requests, transfer requests). Each underlying
 * action enforces admin auth; on any failure we fall back to 0 so the poller
 * never throws in the client.
 */
export async function getAdminNotificationCounts(): Promise<AdminNotificationCounts> {
  const [unread, pendingBookings, pendingTransfers] = await Promise.all([
    getUnreadCount().catch(() => 0),
    getPendingBookingsCount().catch(() => 0),
    getPendingTransfersCount().catch(() => 0),
  ])
  return {
    unread,
    pendingBookings,
    pendingTransfers,
    total: unread + pendingBookings + pendingTransfers,
  }
}
