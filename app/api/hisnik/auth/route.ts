import { NextResponse } from 'next/server'

import {
  caretakerLogin,
  caretakerLogout,
  caretakerSession,
} from '@/app/actions/hisnik-fuel'

export async function GET() {
  const session = await caretakerSession()
  return NextResponse.json(session)
}

export async function POST(req: Request) {
  let body: { pin?: string } = {}
  try {
    body = (await req.json()) as { pin?: string }
  } catch {
    return NextResponse.json({ ok: false, error: 'Wrong PIN' }, { status: 400 })
  }
  const result = await caretakerLogin(String(body.pin ?? ''))
  if (!result.ok) {
    return NextResponse.json(result, { status: 401 })
  }
  return NextResponse.json(result)
}

export async function DELETE() {
  await caretakerLogout()
  return NextResponse.json({ ok: true })
}
