import { getExcursions } from '@/app/actions/excursions'
import { ExcursionsManager } from '@/components/admin/excursions-manager'
import { ImportExcursionsButton } from '@/components/admin/seed-buttons'

export const dynamic = 'force-dynamic'

export default async function AdminExcursionsPage() {
  const rows = await getExcursions()
  const initial = rows.map((r) => ({
    id: r.id,
    title: r.title,
    description: r.description,
    duration: r.duration,
    price: r.price,
    priceUnit: r.priceUnit,
    image: r.image,
    published: r.published,
    sortOrder: r.sortOrder,
  }))
  return (
    <ExcursionsManager
      initial={initial}
      emptyAction={<ImportExcursionsButton />}
    />
  )
}
