import { redirect } from 'next/navigation'

import { isAdmin } from '@/lib/admin-auth'
import { BOATS } from '@/lib/boats'
import { getInspectionView } from '@/app/actions/inspection'
import { InspectionViewClient } from '@/components/compliance/inspection-view'

// The inspection view is the print-ready compliance package a control officer
// sees. The component owns the A4 layout and its own print stylesheet.
export default async function InspectionPage({
  searchParams,
}: {
  searchParams: Promise<{ boat?: string }>
}) {
  if (!(await isAdmin())) redirect('/admin/login')

  const { boat: boatParam } = await searchParams
  const boat =
    BOATS.find((b) => b.id === boatParam)?.id ?? BOATS[0]?.id ?? 'odyssey'

  const view = await getInspectionView(boat)

  return <InspectionViewClient boat={boat} view={view} />
}
