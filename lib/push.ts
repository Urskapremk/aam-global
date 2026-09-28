import 'server-only'
import webpush from 'web-push'
import { eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { pushConfig, pushSubscriptions } from '@/lib/db/schema'

// Contact for the push service (any mailto works).
const VAPID_SUBJECT = 'mailto:admin@aamglobalgroup.com'

let cachedKeys: { publicKey: string; privateKey: string } | null = null

/**
 * Return the VAPID keypair, generating and storing it in the DB on first use.
 * This keeps setup zero-config — no environment variables to paste.
 */
export async function getVapidKeys(): Promise<{ publicKey: string; privateKey: string }> {
  if (cachedKeys) return cachedKeys

  const [existing] = await db.select().from(pushConfig).where(eq(pushConfig.id, 1)).limit(1)
  if (existing) {
    cachedKeys = { publicKey: existing.publicKey, privateKey: existing.privateKey }
    return cachedKeys
  }

  const keys = webpush.generateVAPIDKeys()
  // Ignore a race where another request inserted first.
  await db
    .insert(pushConfig)
    .values({ id: 1, publicKey: keys.publicKey, privateKey: keys.privateKey })
    .onConflictDoNothing()
  const [row] = await db.select().from(pushConfig).where(eq(pushConfig.id, 1)).limit(1)
  cachedKeys = row
    ? { publicKey: row.publicKey, privateKey: row.privateKey }
    : { publicKey: keys.publicKey, privateKey: keys.privateKey }
  return cachedKeys
}

/** Public key the browser needs to create a push subscription. */
export async function getPublicKey(): Promise<string> {
  return (await getVapidKeys()).publicKey
}

export type PushPayload = {
  title: string
  body: string
  /** Where to go when the notification is tapped. Defaults to /admin. */
  url?: string
  /** Groups notifications so a burst collapses instead of stacking. */
  tag?: string
}

/**
 * Send a push to every subscribed device. Best-effort: expired/invalid
 * subscriptions (HTTP 404/410) are pruned so the list stays clean.
 */
export async function sendPushToAll(payload: PushPayload): Promise<void> {
  const subs = await db.select().from(pushSubscriptions)
  if (subs.length === 0) return

  const keys = await getVapidKeys()
  webpush.setVapidDetails(VAPID_SUBJECT, keys.publicKey, keys.privateKey)

  const data = JSON.stringify({
    title: payload.title,
    body: payload.body,
    url: payload.url ?? '/admin',
    tag: payload.tag ?? 'aam-alert',
  })

  await Promise.all(
    subs.map(async (s) => {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          data,
          { urgency: 'high', TTL: 3600 },
        )
      } catch (err) {
        const status = (err as { statusCode?: number })?.statusCode
        if (status === 404 || status === 410) {
          await db.delete(pushSubscriptions).where(eq(pushSubscriptions.endpoint, s.endpoint))
        }
      }
    }),
  )
}
