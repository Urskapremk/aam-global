'use server'

import { db } from '@/lib/db'
import { shopProducts, excursions } from '@/lib/db/schema'
import { isAdmin } from '@/lib/admin-auth'
import { PRODUCTS } from '@/lib/products'
import { count } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'

/** One-click import of the built-in product catalogue into the database. */
export async function seedProducts() {
  if (!(await isAdmin())) throw new Error('Unauthorized')

  const [{ value: existing }] = await db
    .select({ value: count() })
    .from(shopProducts)
  if (existing > 0) return { skipped: true, inserted: 0 }

  const rows = PRODUCTS.map((p, i) => ({
    name: p.name,
    category: p.category,
    price: p.price,
    image: p.image.startsWith('/placeholder') ? null : p.image,
    alt: p.alt,
    description: p.description,
    featured: p.featured ?? false,
    sortOrder: i,
    published: true,
    updatedAt: new Date(),
  }))

  await db.insert(shopProducts).values(rows)
  revalidatePath('/admin/products')
  revalidatePath('/shop')
  return { skipped: false, inserted: rows.length }
}

const STARTER_EXCURSIONS = [
  {
    title: 'Nosy Iranja — Day Trip',
    description:
      'A full day to the twin turtle islands of Nosy Iranja, linked by a white sandbank at low tide. Snorkelling, lunch on the beach, and time to swim.',
    duration: 'Full day',
    price: 90,
    priceUnit: 'per person',
  },
  {
    title: 'Nosy Tanikely — Marine Reserve',
    description:
      'Snorkel the protected reef at Nosy Tanikely, teeming with turtles and tropical fish, followed by lunch under the palms.',
    duration: 'Full day',
    price: 75,
    priceUnit: 'per person',
  },
  {
    title: 'Sunset Cruise',
    description:
      'An evening run along the coast of Nosy Komba with drinks on board as the sun drops over the Mozambique Channel.',
    duration: '2–3 hours',
    price: 45,
    priceUnit: 'per person',
  },
]

export async function seedExcursions() {
  if (!(await isAdmin())) throw new Error('Unauthorized')

  const [{ value: existing }] = await db
    .select({ value: count() })
    .from(excursions)
  if (existing > 0) return { skipped: true, inserted: 0 }

  const rows = STARTER_EXCURSIONS.map((e, i) => ({
    ...e,
    image: null,
    sortOrder: i,
    published: true,
    updatedAt: new Date(),
  }))

  await db.insert(excursions).values(rows)
  revalidatePath('/admin/excursions')
  revalidatePath('/charters')
  return { skipped: false, inserted: rows.length }
}
