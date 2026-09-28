'use server'

import { db } from '@/lib/db'
import { excursions } from '@/lib/db/schema'
import { isAdmin } from '@/lib/admin-auth'
import { asc, eq } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'

async function assertAdmin() {
  if (!(await isAdmin())) throw new Error('Unauthorized')
}

export async function getExcursions() {
  return db.select().from(excursions).orderBy(asc(excursions.sortOrder), asc(excursions.id))
}

export async function getPublishedExcursions() {
  const rows = await db
    .select()
    .from(excursions)
    .where(eq(excursions.published, true))
    .orderBy(asc(excursions.sortOrder), asc(excursions.id))
  return rows
}

type ExcursionInput = {
  title: string
  description: string
  duration: string
  price: number
  priceUnit: string
  image: string | null
  published: boolean
  sortOrder: number
}

export async function createExcursion(data: ExcursionInput) {
  await assertAdmin()
  await db.insert(excursions).values({ ...data, updatedAt: new Date() })
  revalidatePath('/admin/excursions')
  revalidatePath('/charters')
}

export async function updateExcursion(id: number, data: ExcursionInput) {
  await assertAdmin()
  await db
    .update(excursions)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(excursions.id, id))
  revalidatePath('/admin/excursions')
  revalidatePath('/charters')
}

export async function deleteExcursion(id: number) {
  await assertAdmin()
  await db.delete(excursions).where(eq(excursions.id, id))
  revalidatePath('/admin/excursions')
  revalidatePath('/charters')
}
