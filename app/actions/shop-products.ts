'use server'

import { db } from '@/lib/db'
import { shopProducts } from '@/lib/db/schema'
import { isAdmin } from '@/lib/admin-auth'
import { asc, eq } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'

async function assertAdmin() {
  if (!(await isAdmin())) throw new Error('Unauthorized')
}

export async function getProducts() {
  return db
    .select()
    .from(shopProducts)
    .orderBy(asc(shopProducts.sortOrder), asc(shopProducts.id))
}

export async function getPublishedProducts() {
  return db
    .select()
    .from(shopProducts)
    .where(eq(shopProducts.published, true))
    .orderBy(asc(shopProducts.sortOrder), asc(shopProducts.id))
}

type ProductInput = {
  name: string
  category: string
  price: number
  image: string | null
  alt: string
  description: string
  featured: boolean
  published: boolean
  sortOrder: number
}

export async function createProduct(data: ProductInput) {
  await assertAdmin()
  await db.insert(shopProducts).values({ ...data, updatedAt: new Date() })
  revalidatePath('/admin/products')
  revalidatePath('/shop')
}

export async function updateProduct(id: number, data: ProductInput) {
  await assertAdmin()
  await db
    .update(shopProducts)
    .set({ ...data, updatedAt: new Date() })
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
