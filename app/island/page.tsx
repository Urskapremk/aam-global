import type { Metadata } from 'next'
import { DivisionPage } from '@/components/division-page'
import { getBusiness } from '@/lib/businesses'

const business = getBusiness('island')!

export const metadata: Metadata = {
  title: { absolute: `${business.fullName} — ${business.eyebrow}` },
  description: business.description,
}

export default function IslandPage() {
  return <DivisionPage business={business} />
}
