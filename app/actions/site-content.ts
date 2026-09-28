'use server'

import { db } from '@/lib/db'
import { siteContent } from '@/lib/db/schema'
import { isAdmin } from '@/lib/admin-auth'
import { revalidatePath } from 'next/cache'

export async function getAllContent() {
  const rows = await db.select().from(siteContent)
  const map: Record<string, string> = {}
  for (const row of rows) map[row.key] = row.value
  return map
}

export async function saveContent(entries: Record<string, string>) {
  if (!(await isAdmin())) throw new Error('Unauthorized')

  for (const [key, value] of Object.entries(entries)) {
    await db
      .insert(siteContent)
      .values({ key, value, updatedAt: new Date() })
      .onConflictDoUpdate({
        target: siteContent.key,
        set: { value, updatedAt: new Date() },
      })
  }

  revalidatePath('/')
  revalidatePath('/admin/content')
}
