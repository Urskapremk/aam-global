import type { Metadata } from 'next'
import { DivisionPage } from '@/components/division-page'
import { getBusiness } from '@/lib/businesses'
import { getPublishedExcursions } from '@/app/actions/excursions'

const business = getBusiness('charters')!

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: { absolute: `${business.fullName} — ${business.eyebrow}` },
  description: business.description,
}

export default async function ChartersPage() {
  const rows = await getPublishedExcursions()
  const excursions = rows.map((r) => ({
    id: r.id,
    title: r.title,
    description: r.description,
    duration: r.duration,
    price: r.price,
    priceUnit: r.priceUnit,
    image: r.image,
  }))
  return <DivisionPage business={business} excursions={excursions} />
}
