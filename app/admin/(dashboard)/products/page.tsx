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
    priceAr: r.priceAr ?? 0,
    costAr: r.costAr ?? 0,
    transportAr: r.transportAr ?? 0,
    customsAr: r.customsAr ?? 0,
    marginPct: r.marginPct ?? 0,
    stock: r.stock ?? null,
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
