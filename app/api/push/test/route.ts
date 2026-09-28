import { NextResponse } from 'next/server'
import { sendPushToAll } from '@/lib/push'

// Send a test push to every subscribed device, to confirm alerts work.
export async function POST() {
  await sendPushToAll({
    title: 'AAM — test alert',
    body: 'If you can see this, phone alerts are working.',
    url: '/admin',
    tag: 'aam-test',
  })
  return NextResponse.json({ ok: true })
}
