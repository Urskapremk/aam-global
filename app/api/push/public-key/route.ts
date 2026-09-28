import { NextResponse } from 'next/server'
import { getPublicKey } from '@/lib/push'

// The browser needs the VAPID public key to create a push subscription.
export async function GET() {
  const publicKey = await getPublicKey()
  return NextResponse.json({ publicKey })
}
