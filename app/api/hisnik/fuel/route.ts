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
  return e instanceof Error ? e.message : 'Napaka'
}

export async function GET() {
  if (!(await isCaretaker())) {
    return NextResponse.json({ error: 'Ni prijave' }, { status: 401 })
  }
  try {
    const state = await getHisnikState()
    return NextResponse.json(state)
  } catch (e) {
    return NextResponse.json({ error: errMessage(e) }, { status: 500 })
  }
}

type Body =
  | { action: 'issue-ii'; cans: 1 | 2 }
  | { action: 'weigh-return'; unit: HisnikUnit; qty: number }
  | {
      action: 'weigh-fill-issue'
      weighUnit: HisnikUnit
      weighQty: number
      fillUnit: HisnikUnit
      fillQty: number
    }

export async function POST(req: Request) {
  if (!(await isCaretaker())) {
    return NextResponse.json({ error: 'Ni prijave' }, { status: 401 })
  }
  let body: Body
  try {
    body = (await req.json()) as Body
  } catch {
    return NextResponse.json({ error: 'Neveljavno telo' }, { status: 400 })
  }

  try {
    if (body.action === 'issue-ii') {
      const cans = body.cans === 2 ? 2 : 1
      const state = await hisnikIssueOdysseyIi(cans)
      return NextResponse.json(state)
    }
    if (body.action === 'weigh-return') {
      const state = await hisnikWeighReturn({
        unit: body.unit === 'kg' ? 'kg' : 'litres',
        qty: Number(body.qty),
      })
      return NextResponse.json(state)
    }
    if (body.action === 'weigh-fill-issue') {
      const state = await hisnikWeighFillIssue({
        weighUnit: body.weighUnit === 'kg' ? 'kg' : 'litres',
        weighQty: Number(body.weighQty),
        fillUnit: body.fillUnit === 'kg' ? 'kg' : 'litres',
        fillQty: Number(body.fillQty),
      })
      return NextResponse.json(state)
    }
    return NextResponse.json({ error: 'Neznana akcija' }, { status: 400 })
  } catch (e) {
    return NextResponse.json({ error: errMessage(e) }, { status: 400 })
  }
}
