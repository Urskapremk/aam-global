'use server'

import { db } from '@/lib/db'
import { contacts } from '@/lib/db/schema'
import { desc, eq, sql } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { isAdmin } from '@/lib/admin-auth'

async function requireAdmin() {
  if (!(await isAdmin())) throw new Error('Unauthorized')
}

/** True if this email is already in the address book. */
export async function isKnownContact(email: string) {
  const e = email.trim().toLowerCase()
  if (!e) return false
  const [row] = await db
    .select({ id: contacts.id })
    .from(contacts)
    .where(eq(contacts.email, e))
    .limit(1)
  return Boolean(row)
}

/** Save (upsert) an email into the address book. */
export async function saveContact(args: {
  email: string
  name?: string
  note?: string
}) {
  await requireAdmin()
  const email = args.email.trim().toLowerCase()
  const rawName = (args.name ?? '').trim()
  // Never store the email address itself as the contact name — auto-collected
  // senders often have no real name, and doing so makes the name field look
  // like a duplicate email in the editor.
  const name = rawName.toLowerCase() === email ? '' : rawName
  const note = (args.note ?? '').trim()
  if (!email || !email.includes('@')) {
    return { ok: false, error: 'Enter a valid email address.' }
  }

  await db
    .insert(contacts)
    .values({ email, name, note })
    .onConflictDoUpdate({
      target: contacts.email,
      // Only fill empty fields on conflict; don't overwrite existing values.
      set: {
        name: sql`CASE WHEN ${contacts.name} = '' THEN ${name} ELSE ${contacts.name} END`,
        note: sql`CASE WHEN ${contacts.note} = '' THEN ${note} ELSE ${contacts.note} END`,
      },
    })
  revalidatePath('/admin/inbox')
  return { ok: true }
}

/** Edit an existing contact's name/company and note. */
export async function updateContact(args: {
  id: number
  name: string
  note: string
}) {
  await requireAdmin()
  await db
    .update(contacts)
    .set({ name: args.name.trim(), note: args.note.trim() })
    .where(eq(contacts.id, args.id))
  revalidatePath('/admin/inbox')
  return { ok: true }
}

/** Remove a contact from the address book. */
export async function deleteContact(id: number) {
  await requireAdmin()
  await db.delete(contacts).where(eq(contacts.id, id))
  revalidatePath('/admin/inbox')
  return { ok: true }
}

export type Contact = {
  id: number
  email: string
  name: string
  note: string
  createdAt: string
}

/** List all saved contacts (most recent first), createdAt serialized. */
export async function getContacts(): Promise<Contact[]> {
  await requireAdmin()
  const rows = await db.select().from(contacts).orderBy(desc(contacts.createdAt))
  return rows.map((r) => ({
    id: r.id,
    email: r.email,
    name: r.name,
    note: r.note,
    createdAt:
      r.createdAt instanceof Date ? r.createdAt.toISOString() : String(r.createdAt),
  }))
}
