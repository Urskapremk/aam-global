import { NextResponse } from 'next/server'
import crypto from 'node:crypto'
import { db } from '@/lib/db'
import { messages } from '@/lib/db/schema'
import { folderForSender } from '@/lib/mail-rules'
import { sendPushToAll } from '@/lib/push'

/**
 * Inbound email webhook for Resend.
 *
 * Configure in Resend → Webhooks:
 *   Endpoint URL: https://aamglobalgroup.com/api/inbound-email
 *   Event:        email.received
 *
 * Resend signs each request with Svix. Copy the webhook "Signing Secret"
 * (starts with "whsec_") into the RESEND_WEBHOOK_SECRET env var to verify
 * requests. If that var is not set, requests are accepted without a signature
 * check (fine for first setup, but set it for production).
 *
 * Incoming emails are stored in the admin inbox (/admin/inbox).
 */
export async function POST(request: Request) {
  const raw = await request.text()

  const secret = process.env.RESEND_WEBHOOK_SECRET
  if (secret) {
    const ok = verifySvixSignature(request, raw, secret)
    if (!ok) {
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
    }
  }

  let payload: unknown
  try {
    payload = JSON.parse(raw)
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  // Resend wraps the email in { type, data }. Be flexible about the shape.
  const data = (payload as { data?: Record<string, unknown> })?.data ?? payload
  const d = data as Record<string, unknown>

  const from =
    pickAddress(d.from) || pickAddress((d as { sender?: unknown }).sender)
  const to = pickAddress(d.to)
  const subject = asString(d.subject) || '(no subject)'
  const text = asString(d.text)
  const html = asString(d.html)
  const body = text || stripHtml(html) || ''
  const name = pickName(d.from) || from || 'Unknown sender'

  // File into a custom folder if a rule matches this sender.
  const folderId = await folderForSender(from)

  await db.insert(messages).values({
    direction: 'inbound',
    source: 'contact',
    name,
    email: from,
    subject,
    body,
    meta: JSON.stringify({ via: 'inbound-email', to }),
    ...(folderId != null ? { folderId } : {}),
  })

  // Ring every subscribed device (works even when the app is closed).
  try {
    await sendPushToAll({
      title: `New email — ${name}`,
      body: subject,
      url: '/admin/inbox',
      tag: 'aam-email',
    })
  } catch {
    /* push is best-effort; the email is already saved */
  }

  return NextResponse.json({ ok: true })
}

/**
 * Verify a Svix-signed webhook (the scheme Resend uses).
 * Signed content is `${id}.${timestamp}.${body}` and the header holds one or
 * more space-separated `v1,<base64>` signatures.
 */
function verifySvixSignature(
  request: Request,
  body: string,
  signingSecret: string,
): boolean {
  const id = request.headers.get('svix-id')
  const timestamp = request.headers.get('svix-timestamp')
  const signature = request.headers.get('svix-signature')
  if (!id || !timestamp || !signature) return false

  // Secret looks like "whsec_<base64>"; the key is the base64 part.
  const key = signingSecret.startsWith('whsec_')
    ? signingSecret.slice(6)
    : signingSecret
  let keyBytes: Buffer
  try {
    keyBytes = Buffer.from(key, 'base64')
  } catch {
    return false
  }

  const signedContent = `${id}.${timestamp}.${body}`
  const expected = crypto
    .createHmac('sha256', keyBytes)
    .update(signedContent)
    .digest('base64')

  // Header: "v1,<sig> v1,<sig2> ..."
  const provided = signature
    .split(' ')
    .map((part) => part.split(',')[1])
    .filter(Boolean)

  return provided.some((sig) => timingSafeEqual(sig, expected))
}

function timingSafeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a)
  const bb = Buffer.from(b)
  if (ab.length !== bb.length) return false
  return crypto.timingSafeEqual(ab, bb)
}

function asString(v: unknown): string {
  return typeof v === 'string' ? v : ''
}

// `from` may be "Name <email>", or { name, email }, or an array of those.
function pickAddress(v: unknown): string {
  if (!v) return ''
  if (Array.isArray(v)) return pickAddress(v[0])
  if (typeof v === 'string') {
    const m = v.match(/<([^>]+)>/)
    return (m ? m[1] : v).trim()
  }
  if (typeof v === 'object') {
    const o = v as { email?: string; address?: string }
    return (o.email || o.address || '').trim()
  }
  return ''
}

function pickName(v: unknown): string {
  if (!v) return ''
  if (Array.isArray(v)) return pickName(v[0])
  if (typeof v === 'string') {
    const m = v.match(/^\s*"?([^"<]+?)"?\s*</)
    return m ? m[1].trim() : ''
  }
  if (typeof v === 'object') {
    const o = v as { name?: string }
    return (o.name || '').trim()
  }
  return ''
}

function stripHtml(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}
