import { NextResponse } from 'next/server'

import {
  getHisnikState,
  hisnikIssueOdysseyIi,
  hisnikWeighFillIssue,
  hisnikWeighReturn,
  type HisnikUnit,
} from '@/app/actions/hisnik-fuel'
import { isCaretaker } from '@/lib/caretaker-auth'

function errMessage(e: unknown): string {
  return e instanceof Error ? e.message : 'Error'
}

function unitOf(v: unknown): HisnikUnit {
  return v === 'kg' ? 'kg' : 'litres'
}

export async function GET() {
  if (!(await isCaretaker())) {
    return NextResponse.json({ error: 'Not signed in' }, { status: 401 })
  }
  try {
    const state = await getHisnikState()
    return NextResponse.json(state)
  } catch (e) {
    return NextResponse.json({ error: errMessage(e) }, { status: 500 })
  }
}

type Body =
  | {
      action: 'issue-ii'
      cans: 1 | 2
      skipperId?: string
      skipperName?: string
      weighUnit: HisnikUnit
      weighQty: number
    }
  | {
      action: 'weigh-return'
      unit: HisnikUnit
      qty: number
      skipperId?: string
      skipperName?: string
    }
  | {
      action: 'weigh-fill-issue'
      weighUnit: HisnikUnit
      weighQty: number
      fillUnit: HisnikUnit
      fillQty: number
      skipperId?: string
      skipperName?: string
    }

export async function POST(req: Request) {
  if (!(await isCaretaker())) {
    return NextResponse.json({ error: 'Not signed in' }, { status: 401 })
  }
  let body: Body
  try {
    body = (await req.json()) as Body
  } catch {
    return NextResponse.json({ error: 'Error' }, { status: 400 })
  }

  try {
    if (body.action === 'issue-ii') {
      const cans = body.cans === 2 ? 2 : 1
      const state = await hisnikIssueOdysseyIi({
        cans,
        skipperId: body.skipperId,
        skipperName: body.skipperName,
        weighUnit: unitOf(body.weighUnit),
        weighQty: Number(body.weighQty),
      })
      return NextResponse.json(state)
    }
    if (body.action === 'weigh-return') {
      const state = await hisnikWeighReturn({
        unit: unitOf(body.unit),
        qty: Number(body.qty),
        skipperId: body.skipperId,
        skipperName: body.skipperName,
      })
      return NextResponse.json(state)
    }
    if (body.action === 'weigh-fill-issue') {
      const state = await hisnikWeighFillIssue({
        weighUnit: unitOf(body.weighUnit),
        weighQty: Number(body.weighQty),
        fillUnit: unitOf(body.fillUnit),
        fillQty: Number(body.fillQty),
        skipperId: body.skipperId,
        skipperName: body.skipperName,
      })
      return NextResponse.json(state)
    }
    return NextResponse.json({ error: 'Error' }, { status: 400 })
  } catch (e) {
    return NextResponse.json({ error: errMessage(e) }, { status: 400 })
  }
}
