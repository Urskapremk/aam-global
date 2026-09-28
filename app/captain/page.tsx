import type { Metadata, Viewport } from 'next'

import { CaptainMode } from '@/components/captain-mode'

export const metadata: Metadata = {
  title: 'Captain Mode',
  // Keep it out of search results: the page is a working tool, not marketing.
  robots: { index: false, follow: false },
}

export const viewport: Viewport = {
  // Overrides the root layout's light scheme: this screen is dark because it is
  // read on the water, in sun and after dark.
  colorScheme: 'dark',
  themeColor: '#0d2233',
}

/**
 * The captain's screen, opened from a link the office sends:
 *   /captain?t=<boat token>
 *
 * The token is in the URL rather than behind a login because the person
 * holding this phone is on a boat, not at a desk. It is scoped to one boat and
 * can only start/end that boat's trips and report its position — see the
 * comment on `fleetDevices` in lib/db/schema.ts.
 */
export default async function CaptainPage({
  searchParams,
}: {
  searchParams: Promise<{ t?: string }>
}) {
  const { t } = await searchParams
  return <CaptainMode initialToken={(t ?? '').trim()} />
}
