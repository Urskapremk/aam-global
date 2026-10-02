import { getProducts } from '@/app/actions/shop-products'
import { ProductsManager } from '@/components/admin/products-manager'
import { ImportProductsButton } from '@/components/admin/seed-buttons'

export const dynamic = 'force-dynamic'

export default async function AdminProductsPage() {
  const rows = await getProducts()
  const initial = rows.map((r) => ({
    id: r.id,
    name: r.name,
    category: r.category,
    price: r.price,
    image: r.image,
    alt: r.alt,
    description: r.description,
    featured: r.featured,
    published: r.published,
    sortOrder: r.sortOrder,
  }))
  return (
    <ProductsManager initial={initial} emptyAction={<ImportProductsButton />} />
  )
}
