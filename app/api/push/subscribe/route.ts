import { NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { pushSubscriptions } from '@/lib/db/schema'

// Save (or refresh) a device's push subscription so it receives alerts.
export async function POST(request: Request) {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const sub = body as {
    endpoint?: string
    keys?: { p256dh?: string; auth?: string }
    userAgent?: string
  }
  const endpoint = sub?.endpoint
  const p256dh = sub?.keys?.p256dh
  const auth = sub?.keys?.auth
  if (!endpoint || !p256dh || !auth) {
    return NextResponse.json({ error: 'Missing subscription fields' }, { status: 400 })
  }

  await db
    .insert(pushSubscriptions)
    .values({ endpoint, p256dh, auth, userAgent: sub.userAgent?.slice(0, 300) || '' })
    .onConflictDoUpdate({
      target: pushSubscriptions.endpoint,
      set: { p256dh, auth, userAgent: sub.userAgent?.slice(0, 300) || '' },
    })

  return NextResponse.json({ ok: true })
}

// Remove a subscription (when the admin turns phone alerts off).
export async function DELETE(request: Request) {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }
  const endpoint = (body as { endpoint?: string })?.endpoint
  if (endpoint) {
    await db.delete(pushSubscriptions).where(eq(pushSubscriptions.endpoint, endpoint))
  }
  return NextResponse.json({ ok: true })
}
