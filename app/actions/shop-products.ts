'use server'

import { db, pool } from '@/lib/db'
import { shopProducts } from '@/lib/db/schema'
import { isAdmin } from '@/lib/admin-auth'
import { getFxRates } from './fuel'
import { asc, eq } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'

async function assertAdmin() {
  if (!(await isAdmin())) throw new Error('Unauthorized')
}

let columnReady: Promise<unknown> | null = null
function ensurePriceArColumn() {
  columnReady ??= pool.query(
    'ALTER TABLE shop_products ADD COLUMN IF NOT EXISTS "priceAr" integer NOT NULL DEFAULT 0',
  )
  return columnReady
}

export async function getProducts() {
  await ensurePriceArColumn()
  return db
    .select()
    .from(shopProducts)
    .orderBy(asc(shopProducts.sortOrder), asc(shopProducts.id))
}

export async function getPublishedProducts() {
  await ensurePriceArColumn()
  return db
    .select()
    .from(shopProducts)
    .where(eq(shopProducts.published, true))
    .orderBy(asc(shopProducts.sortOrder), asc(shopProducts.id))
}

type ProductInput = {
  name: string
  category: string
  priceAr: number
  image: string | null
  alt: string
  description: string
  featured: boolean
  published: boolean
  sortOrder: number
}

async function withEurPrice(data: ProductInput) {
  await ensurePriceArColumn()
  const priceAr = Math.max(0, Math.round(Number(data.priceAr) || 0))
  const { arPerEur } = await getFxRates()
  const price = arPerEur > 0 ? Math.round(priceAr / arPerEur) : 0
  return { ...data, priceAr, price }
}

export async function createProduct(data: ProductInput) {
  await assertAdmin()
  const values = await withEurPrice(data)
  await db.insert(shopProducts).values({ ...values, updatedAt: new Date() })
  revalidatePath('/admin/products')
  revalidatePath('/shop')
}

export async function updateProduct(id: number, data: ProductInput) {
  await assertAdmin()
  const values = await withEurPrice(data)
  await db
    .update(shopProducts)
    .set({ ...values, updatedAt: new Date() })
    .where(eq(shopProducts.id, id))
  revalidatePath('/admin/products')
  revalidatePath('/shop')
}

export async function deleteProduct(id: number) {
  await assertAdmin()
  await db.delete(shopProducts).where(eq(shopProducts.id, id))
  revalidatePath('/admin/products')
  revalidatePath('/shop')
}
