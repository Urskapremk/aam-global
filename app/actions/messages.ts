'use server'

import { db } from '@/lib/db'
import { messages, mailLabels, messageLabels } from '@/lib/db/schema'
import { and, desc, eq, isNull, inArray } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { isAdmin } from '@/lib/admin-auth'
import {
  sendEmail,
  emailShell,
  NOTIFY_EMAIL,
  type EmailAttachment,
} from '@/lib/email'
import { isKnownContact } from '@/app/actions/contacts'
import { folderForSender } from '@/lib/mail-rules'

export type LabelLite = { id: number; name: string; color: string }

/** Attach the labels applied to each message (many-to-many). */
async function attachLabels<T extends { id: number }>(
  rows: T[],
): Promise<(T & { labels: LabelLite[] })[]> {
  if (rows.length === 0) return []
  const ids = rows.map((r) => r.id)
  const links = await db
    .select({
      messageId: messageLabels.messageId,
      id: mailLabels.id,
      name: mailLabels.name,
      color: mailLabels.color,
    })
    .from(messageLabels)
    .innerJoin(mailLabels, eq(messageLabels.labelId, mailLabels.id))
    .where(inArray(messageLabels.messageId, ids))
  const byMsg = new Map<number, LabelLite[]>()
  for (const l of links) {
    const arr = byMsg.get(l.messageId) ?? []
    arr.push({ id: l.id, name: l.name, color: l.color })
    byMsg.set(l.messageId, arr)
  }
  return rows.map((r) => ({ ...r, labels: byMsg.get(r.id) ?? [] }))
}

async function requireAdmin() {
  if (!(await isAdmin())) throw new Error('Unauthorized')
}

// ---------- Public: save an inbound message from a website form ----------

type InboundArgs = {
  source: 'contact' | 'excursion' | 'order'
  name: string
  email: string
  phone?: string
  subject: string
  body: string
  meta?: Record<string, unknown>
}

/**
 * Save a website form submission into the inbox AND notify the business by
 * email. Safe to call from public forms (no auth). Email send is best-effort:
 * if Resend isn't configured yet, the message is still stored in the inbox.
 */
export async function saveInboundMessage(args: InboundArgs) {
  const name = args.name.trim()
  const email = args.email.trim()
  const body = args.body.trim()

  // Email is required for contact/excursion (so we can reply), but optional for
  // orders placed over WhatsApp (we may not have it yet).
  if (!body || (args.source !== 'order' && (!name || !email))) {
    return { ok: false, error: 'Please fill in your name, email, and message.' }
  }

  // Route into a custom folder if a rule matches this sender.
  const folderId = await folderForSender(email)

  const [row] = await db
    .insert(messages)
    .values({
      direction: 'inbound',
      source: args.source,
      name,
      email,
      phone: args.phone?.trim() || '',
      subject: args.subject.trim() || '(no subject)',
      body,
      meta: args.meta ? JSON.stringify(args.meta) : '',
      ...(folderId != null ? { folderId } : {}),
    })
    .returning({ id: messages.id })

  // Notify the business (best-effort).
  const label =
    args.source === 'order'
      ? 'New order enquiry'
      : args.source === 'excursion'
        ? 'New excursion enquiry'
        : 'New contact message'

  await sendEmail({
    to: NOTIFY_EMAIL,
    replyTo: email,
    subject: `${label}: ${args.subject.trim() || name}`,
    html: emailShell(
      label,
      `<p style="margin:0 0 12px"><strong>${escapeHtml(name)}</strong> &lt;${escapeHtml(email)}&gt;${
        args.phone ? ` &middot; ${escapeHtml(args.phone)}` : ''
      }</p>
       <p style="margin:0 0 16px;white-space:pre-wrap">${escapeHtml(body)}</p>
       <p style="margin:0;color:#5b6b7b;font-size:13px">Open the admin inbox to reply.</p>`,
    ),
  })

  revalidatePath('/admin/inbox')
  return { ok: true, id: row?.id ?? null }
}

// ---------- Admin: read / manage ----------

// Built-in folders: 'prejeto' (received), 'poslano' (sent), 'izbrisano' (trash).
// Custom folders are addressed by numeric id via the `folderId` option.
export type Folder = 'prejeto' | 'poslano' | 'izbrisano'

type FolderOpts = { folder?: Folder; folderId?: number }

/**
 * Build the WHERE clause for a folder view.
 * - A numeric `folderId` selects a custom folder (inbound, not trashed).
 * - 'prejeto' is inbound mail that has NOT been filed into a custom folder.
 * - 'poslano' is outbound; 'izbrisano' is the trash (archived flag).
 */
function folderWhere({ folder = 'prejeto', folderId }: FolderOpts) {
  if (typeof folderId === 'number') {
    return and(
      eq(messages.archived, false),
      eq(messages.direction, 'inbound'),
      eq(messages.folderId, folderId),
    )
  }
  if (folder === 'izbrisano') return eq(messages.archived, true)
  if (folder === 'poslano') {
    return and(eq(messages.archived, false), eq(messages.direction, 'outbound'))
  }
  return and(
    eq(messages.archived, false),
    eq(messages.direction, 'inbound'),
    isNull(messages.folderId),
  )
}

export async function getMessages(opts?: FolderOpts) {
  await requireAdmin()
  const rows = await db
    .select()
    .from(messages)
    .where(folderWhere(opts ?? {}))
    .orderBy(desc(messages.createdAt))
  return attachLabels(rows)
}

/**
 * Re-fetch messages for the client "Send & receive" button. Returns rows with
 * createdAt serialized to an ISO string so they cross the server boundary.
 */
export async function refreshInbox(opts?: FolderOpts) {
  await requireAdmin()
  const rows = await db
    .select()
    .from(messages)
    .where(folderWhere(opts ?? {}))
    .orderBy(desc(messages.createdAt))
  const withLabels = await attachLabels(rows)
  return withLabels.map((r) => ({
    ...r,
    createdAt:
      r.createdAt instanceof Date ? r.createdAt.toISOString() : String(r.createdAt),
  }))
}

/** Move an inbound message into a custom folder, or back to the inbox (null). */
export async function moveToFolder(id: number, folderId: number | null) {
  await requireAdmin()
  await db.update(messages).set({ folderId }).where(eq(messages.id, id))
  revalidatePath('/admin/inbox')
  return { ok: true }
}

export async function getUnreadCount() {
  await requireAdmin()
  const rows = await db
    .select({ id: messages.id })
    .from(messages)
    .where(
      and(
        eq(messages.read, false),
        eq(messages.archived, false),
        eq(messages.direction, 'inbound'),
      ),
    )
  return rows.length
}

export async function markRead(id: number, read = true) {
  await requireAdmin()
  await db.update(messages).set({ read }).where(eq(messages.id, id))
  revalidatePath('/admin/inbox')
}

/**
 * Mark a shop/WhatsApp order as completed (or reopen it). Stored in message
 * meta so the "New order" stamp stays until the admin explicitly closes it —
 * opening/reading the message alone must not clear the stamp.
 */
export async function setOrderCompleted(id: number, completed: boolean) {
  await requireAdmin()
  const [row] = await db
    .select({ meta: messages.meta, source: messages.source })
    .from(messages)
    .where(eq(messages.id, id))
    .limit(1)
  if (!row || row.source !== 'order') {
    return { ok: false as const, error: 'Not an order message.' }
  }
  let meta: Record<string, unknown> = {}
  if (row.meta) {
    try {
      const parsed = JSON.parse(row.meta)
      if (parsed && typeof parsed === 'object') meta = parsed
    } catch {
      meta = {}
    }
  }
  if (completed) {
    meta.completed = true
    meta.completedAt = new Date().toISOString()
  } else {
    delete meta.completed
    delete meta.completedAt
  }
  await db
    .update(messages)
    .set({ meta: JSON.stringify(meta) })
    .where(eq(messages.id, id))
  revalidatePath('/admin/inbox')
  return { ok: true as const, meta: JSON.stringify(meta) }
}

export async function setArchived(id: number, archived = true) {
  await requireAdmin()
  await db.update(messages).set({ archived }).where(eq(messages.id, id))
  revalidatePath('/admin/inbox')
}

export async function deleteMessage(id: number) {
  await requireAdmin()
  await db.delete(messages).where(eq(messages.id, id))
  revalidatePath('/admin/inbox')
}

// ---------- Admin: send / reply ----------

type ComposeArgs = {
  to: string
  subject: string
  body: string // plain text (stored + used as the email text part)
  html?: string // optional rich-text HTML for the email body
  inReplyTo?: number // message id being replied to
  attachments?: EmailAttachment[] // files / photos to attach
}

// Guard against oversized payloads. Resend caps a message at ~40MB total.
// This limit only applies to any legacy inline base64 content; normal sends
// now pass hosted Blob URLs, which are tiny.
const MAX_ATTACHMENTS_BYTES = 40 * 1024 * 1024

/** Build the exact HTML that will be emailed, for an in-app preview. */
function composeHtml(subject: string, body: string, html?: string) {
  const innerHtml =
    html && html.trim()
      ? html
      : `<p style="white-space:pre-wrap;margin:0">${escapeHtml(body)}</p>`
  return emailShell(subject || 'Preview', innerHtml)
}

export async function previewEmail(args: {
  subject: string
  body: string
  html?: string
}) {
  await requireAdmin()
  return composeHtml(args.subject.trim(), args.body, args.html)
}

export async function sendMessage(args: ComposeArgs) {
  await requireAdmin()
  const subject = args.subject.trim()
  const body = args.body.trim()

  // Accept one or many recipients separated by comma, semicolon, space or
  // newline. De-duplicate while preserving order.
  const recipients = Array.from(
    new Set(
      args.to
        .split(/[\s,;]+/)
        .map((e) => e.trim())
        .filter(Boolean),
    ),
  )
  const to = recipients.join(', ')

  if (!recipients.length || !subject || !body) {
    return { ok: false, error: 'Recipient, subject, and message are required.' }
  }

  // Validate every address so one typo doesn't silently drop the whole send.
  const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  const invalid = recipients.filter((e) => !emailRe.test(e))
  if (invalid.length) {
    return {
      ok: false,
      error: `These addresses look invalid: ${invalid.join(', ')}`,
    }
  }

  const attachments = args.attachments ?? []
  // Attachments now arrive as hosted Blob URLs (uploaded straight from the
  // browser), so the payload here is tiny. Guard on count + any inline base64
  // that legacy callers might still send.
  if (attachments.length > 20) {
    return { ok: false, error: 'Too many attachments. Add at most 20 files.' }
  }
  const inlineBytes = attachments.reduce(
    (n, a) => n + (a.content ? Math.ceil((a.content.length * 3) / 4) : 0),
    0,
  )
  if (inlineBytes > MAX_ATTACHMENTS_BYTES) {
    return {
      ok: false,
      error: 'Attachments are too large. Keep the total under about 40 MB.',
    }
  }

  // Prefer the admin-authored rich HTML; fall back to escaped plain text.
  const innerHtml =
    args.html && args.html.trim()
      ? args.html
      : `<p style="white-space:pre-wrap;margin:0">${escapeHtml(body)}</p>`

  const result = await sendEmail({
    to: recipients,
    subject,
    html: emailShell(subject, innerHtml),
    text: body,
    ...(attachments.length ? { attachments } : {}),
  })

  // Record the outbound message regardless (so you have a sent history),
  // but flag failures in the subject meta.
  await db.insert(messages).values({
    direction: 'outbound',
    source: 'email',
    name: '',
    email: to,
    subject,
    body,
    read: true,
    meta: JSON.stringify({
      sent: result.ok,
      error: result.ok ? undefined : result.error,
      ...(attachments.length
        ? { attachments: attachments.map((a) => a.filename) }
        : {}),
    }),
  })

  // Mark the original as read when replying.
  if (args.inReplyTo) {
    await db.update(messages).set({ read: true }).where(eq(messages.id, args.inReplyTo))
  }

  revalidatePath('/admin/inbox')

  if (!result.ok) {
    return {
      ok: false,
      error:
        'skipped' in result && result.skipped
          ? 'Saved to sent, but not emailed yet — add RESEND_API_KEY to enable sending.'
          : `Email failed: ${result.error}`,
    }
  }

  // Only offer to save a contact when there's a single recipient — with
  // several, "save this contact" would be ambiguous.
  if (recipients.length === 1) {
    const contactKnown = await isKnownContact(recipients[0])
    return { ok: true, recipient: recipients[0], contactKnown }
  }
  return { ok: true, recipient: to, contactKnown: true }
}

function escapeHtml(s: string) {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}
