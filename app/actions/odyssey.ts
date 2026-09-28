'use server'

import { asc, eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { odysseyTiers, odysseyActivities } from '@/lib/db/schema'
import { isAdmin } from '@/lib/admin-auth'
import { revalidatePath } from 'next/cache'

async function requireAdmin() {
  if (!(await isAdmin())) throw new Error('Unauthorized')
}

export type OdysseyTier = {
  id: number
  minPax: number
  maxPax: number
  priceEur: number | null
  note: string
  sortOrder: number
}

export type OdysseyActivity = {
  id: number
  label: string
  category: string // 'fishing' | 'excursion'
  note: string
  priceEur: number | null
  priceUnit: string // 'per_person' | 'per_trip'
  published: boolean
  sortOrder: number
}

// ---------- Reads ----------

export async function getOdysseyTiers(): Promise<OdysseyTier[]> {
  const rows = await db
    .select()
    .from(odysseyTiers)
    .orderBy(asc(odysseyTiers.sortOrder), asc(odysseyTiers.id))
  return rows.map((r) => ({
    id: r.id,
    minPax: r.minPax,
    maxPax: r.maxPax,
    priceEur: r.priceEur ?? null,
    note: r.note,
    sortOrder: r.sortOrder,
  }))
}

export async function getOdysseyActivities(): Promise<OdysseyActivity[]> {
  const rows = await db
    .select()
    .from(odysseyActivities)
    .orderBy(asc(odysseyActivities.sortOrder), asc(odysseyActivities.id))
  return rows.map((r) => ({
    id: r.id,
    label: r.label,
    category: r.category,
    note: r.note,
    priceEur: r.priceEur ?? null,
    priceUnit: r.priceUnit,
    published: r.published,
    sortOrder: r.sortOrder,
  }))
}

// ---------- Tiers ----------

export async function createOdysseyTier(args: {
  minPax: number
  maxPax: number
  priceEur: number | null
  note?: string
}): Promise<{ ok: boolean; tier?: OdysseyTier; error?: string }> {
  await requireAdmin()
  const minPax = Math.max(1, Math.round(args.minPax || 1))
  const maxPax = Math.max(minPax, Math.round(args.maxPax || minPax))
  const priceEur =
    args.priceEur == null || Number.isNaN(args.priceEur)
      ? null
      : Math.max(0, Math.round(args.priceEur))
  const [row] = await db
    .insert(odysseyTiers)
    .values({ minPax, maxPax, priceEur, note: (args.note ?? '').trim(), sortOrder: maxPax })
    .returning()
  revalidatePath('/admin/odyssey')
  return {
    ok: true,
    tier: {
      id: row.id,
      minPax: row.minPax,
      maxPax: row.maxPax,
      priceEur: row.priceEur ?? null,
      note: row.note,
      sortOrder: row.sortOrder,
    },
  }
}

export async function updateOdysseyTier(
  id: number,
  data: { minPax: number; maxPax: number; priceEur: number | null; note: string },
): Promise<{ ok: boolean }> {
  await requireAdmin()
  const minPax = Math.max(1, Math.round(data.minPax || 1))
  const maxPax = Math.max(minPax, Math.round(data.maxPax || minPax))
  const priceEur =
    data.priceEur == null || Number.isNaN(data.priceEur)
      ? null
      : Math.max(0, Math.round(data.priceEur))
  await db
    .update(odysseyTiers)
    .set({ minPax, maxPax, priceEur, note: (data.note ?? '').trim(), sortOrder: maxPax })
    .where(eq(odysseyTiers.id, id))
  revalidatePath('/admin/odyssey')
  return { ok: true }
}

export async function deleteOdysseyTier(id: number): Promise<{ ok: boolean }> {
  await requireAdmin()
  await db.delete(odysseyTiers).where(eq(odysseyTiers.id, id))
  revalidatePath('/admin/odyssey')
  return { ok: true }
}

// ---------- Activities ----------

export async function createOdysseyActivity(args: {
  label: string
  category: string
  note?: string
  priceEur: number | null
  priceUnit: string
}): Promise<{ ok: boolean; activity?: OdysseyActivity; error?: string }> {
  await requireAdmin()
  if (!args.label.trim()) return { ok: false, error: 'Enter an activity name.' }
  const priceEur =
    args.priceEur == null || Number.isNaN(args.priceEur)
      ? null
      : Math.max(0, Math.round(args.priceEur))
  const [row] = await db
    .insert(odysseyActivities)
    .values({
      label: args.label.trim(),
      category: args.category === 'fishing' ? 'fishing' : 'excursion',
      note: (args.note ?? '').trim(),
      priceEur,
      priceUnit: args.priceUnit === 'per_trip' ? 'per_trip' : 'per_person',
    })
    .returning()
  revalidatePath('/admin/odyssey')
  return {
    ok: true,
    activity: {
      id: row.id,
      label: row.label,
      category: row.category,
      note: row.note,
      priceEur: row.priceEur ?? null,
      priceUnit: row.priceUnit,
      published: row.published,
      sortOrder: row.sortOrder,
    },
  }
}

export async function updateOdysseyActivity(
  id: number,
  data: {
    label: string
    category: string
    note: string
    priceEur: number | null
    priceUnit: string
    published: boolean
  },
): Promise<{ ok: boolean }> {
  await requireAdmin()
  const priceEur =
    data.priceEur == null || Number.isNaN(data.priceEur)
      ? null
      : Math.max(0, Math.round(data.priceEur))
  await db
    .update(odysseyActivities)
    .set({
      label: data.label.trim(),
      category: data.category === 'fishing' ? 'fishing' : 'excursion',
      note: (data.note ?? '').trim(),
      priceEur,
      priceUnit: data.priceUnit === 'per_trip' ? 'per_trip' : 'per_person',
      published: data.published,
    })
    .where(eq(odysseyActivities.id, id))
  revalidatePath('/admin/odyssey')
  return { ok: true }
}

export async function deleteOdysseyActivity(id: number): Promise<{ ok: boolean }> {
  await requireAdmin()
  await db.delete(odysseyActivities).where(eq(odysseyActivities.id, id))
  revalidatePath('/admin/odyssey')
  return { ok: true }
}
