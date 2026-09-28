'use server'

import { db } from '@/lib/db'
import {
  mailFolders,
  mailRules,
  mailLabels,
  messageLabels,
  messages,
} from '@/lib/db/schema'
import { and, asc, eq } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { isAdmin } from '@/lib/admin-auth'

async function requireAdmin() {
  if (!(await isAdmin())) throw new Error('Unauthorized')
}

// ------------------------------- Folders -----------------------------------

export async function getFolders() {
  await requireAdmin()
  return db.select().from(mailFolders).orderBy(asc(mailFolders.name))
}

export async function createFolder(name: string) {
  await requireAdmin()
  const clean = name.trim()
  if (!clean) return { ok: false, error: 'Enter a folder name.' }
  const [row] = await db
    .insert(mailFolders)
    .values({ name: clean })
    .returning({ id: mailFolders.id })
  revalidatePath('/admin/inbox')
  return { ok: true, id: row?.id ?? null }
}

export async function renameFolder(id: number, name: string) {
  await requireAdmin()
  const clean = name.trim()
  if (!clean) return { ok: false, error: 'Enter a folder name.' }
  await db.update(mailFolders).set({ name: clean }).where(eq(mailFolders.id, id))
  revalidatePath('/admin/inbox')
  return { ok: true }
}

/**
 * Delete a folder: move its messages back to the inbox (folderId → NULL),
 * drop any rules pointing at it, then remove the folder itself.
 */
export async function deleteFolder(id: number) {
  await requireAdmin()
  await db
    .update(messages)
    .set({ folderId: null })
    .where(eq(messages.folderId, id))
  await db.delete(mailRules).where(eq(mailRules.folderId, id))
  await db.delete(mailFolders).where(eq(mailFolders.id, id))
  revalidatePath('/admin/inbox')
  return { ok: true }
}

// -------------------------------- Rules ------------------------------------

/** Rules joined with their folder name, for display. */
export async function getRules() {
  await requireAdmin()
  return db
    .select({
      id: mailRules.id,
      fromEmail: mailRules.fromEmail,
      folderId: mailRules.folderId,
      folderName: mailFolders.name,
    })
    .from(mailRules)
    .leftJoin(mailFolders, eq(mailRules.folderId, mailFolders.id))
    .orderBy(asc(mailRules.fromEmail))
}

export async function createRule(fromEmail: string, folderId: number) {
  await requireAdmin()
  const clean = fromEmail.trim().toLowerCase()
  if (!clean) return { ok: false, error: 'Enter an email address.' }
  if (!folderId) return { ok: false, error: 'Choose a folder.' }
  await db.insert(mailRules).values({ fromEmail: clean, folderId })
  revalidatePath('/admin/inbox')
  return { ok: true }
}

export async function deleteRule(id: number) {
  await requireAdmin()
  await db.delete(mailRules).where(eq(mailRules.id, id))
  revalidatePath('/admin/inbox')
  return { ok: true }
}

// -------------------------------- Labels -----------------------------------

export async function getLabels() {
  await requireAdmin()
  return db.select().from(mailLabels).orderBy(asc(mailLabels.name))
}

export async function createLabel(name: string, color: string) {
  await requireAdmin()
  const clean = name.trim()
  if (!clean) return { ok: false, error: 'Enter a label name.' }
  const [row] = await db
    .insert(mailLabels)
    .values({ name: clean, color: color || '#ef4444' })
    .returning({ id: mailLabels.id })
  revalidatePath('/admin/inbox')
  return { ok: true, id: row?.id ?? null }
}

export async function updateLabel(id: number, name: string, color: string) {
  await requireAdmin()
  const clean = name.trim()
  if (!clean) return { ok: false, error: 'Enter a label name.' }
  await db
    .update(mailLabels)
    .set({ name: clean, color: color || '#ef4444' })
    .where(eq(mailLabels.id, id))
  revalidatePath('/admin/inbox')
  return { ok: true }
}

export async function deleteLabel(id: number) {
  await requireAdmin()
  await db.delete(messageLabels).where(eq(messageLabels.labelId, id))
  await db.delete(mailLabels).where(eq(mailLabels.id, id))
  revalidatePath('/admin/inbox')
  return { ok: true }
}

/** Apply or remove a label on a message. */
export async function setMessageLabel(
  messageId: number,
  labelId: number,
  on: boolean,
) {
  await requireAdmin()
  if (on) {
    await db
      .insert(messageLabels)
      .values({ messageId, labelId })
      .onConflictDoNothing()
  } else {
    await db
      .delete(messageLabels)
      .where(
        and(
          eq(messageLabels.messageId, messageId),
          eq(messageLabels.labelId, labelId),
        ),
      )
  }
  revalidatePath('/admin/inbox')
  return { ok: true }
}
