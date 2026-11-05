import { NextResponse } from 'next/server'
import { isAdmin } from '@/lib/admin-auth'
import {
  TranslateError,
  translateEmailBody,
  type TranslateTarget,
} from '@/lib/translate-email'

/**
 * Admin-only: translate an inbox message body to English or Slovenian.
 *
 * POST { text: string, target: "en" | "sl" }
 * → { ok: true, text, provider } | { ok: false, error }
 *
 * Uses OPENAI_API_KEY when set; otherwise the free MyMemory API.
 * Set TRANSLATE_MOCK=1 for a labelled local stand-in (no network).
 */
export async function POST(request: Request) {
  if (!(await isAdmin())) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid JSON' }, { status: 400 })
  }

  const text = typeof (body as { text?: unknown })?.text === 'string'
    ? (body as { text: string }).text
    : ''
  const targetRaw = (body as { target?: unknown })?.target
  const target: TranslateTarget | null =
    targetRaw === 'en' || targetRaw === 'sl' ? targetRaw : null

  if (!target) {
    return NextResponse.json(
      { ok: false, error: 'target must be "en" or "sl"' },
      { status: 400 },
    )
  }

  try {
    const result = await translateEmailBody(text, target)
    return NextResponse.json({
      ok: true,
      text: result.text,
      provider: result.provider,
      target,
    })
  } catch (err) {
    if (err instanceof TranslateError) {
      return NextResponse.json(
        { ok: false, error: err.message },
        { status: err.status },
      )
    }
    const message = err instanceof Error ? err.message : 'Translation failed'
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
