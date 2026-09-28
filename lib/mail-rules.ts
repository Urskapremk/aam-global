import { db } from '@/lib/db'
import { mailRules } from '@/lib/db/schema'

/**
 * Given an inbound sender address, return the folder id it should be filed
 * into, or null if no rule matches. Case-insensitive exact match on the
 * sender's email. Used by inbound flows (webhook + website forms) — this lives
 * outside the "use server" actions file so it can be called server-side
 * without being exposed as a server action.
 */
export async function folderForSender(email: string): Promise<number | null> {
  const target = email.trim().toLowerCase()
  if (!target) return null
  try {
    const rows = await db.select().from(mailRules)
    const match = rows.find(
      (r) => r.fromEmail.trim().toLowerCase() === target,
    )
    return match ? match.folderId : null
  } catch {
    return null
  }
}
