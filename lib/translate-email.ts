/**
 * Translate inbound email bodies for the admin inbox.
 *
 * Providers (first match wins):
 * 1. OpenAI — when OPENAI_API_KEY is set (best quality, auto language detect)
 * 2. MyMemory — free public API, no key required (chunked; fine for typical emails)
 * 3. Mock — when TRANSLATE_MOCK=1, returns a clearly labelled stand-in so the UI
 *    can be exercised without network access
 *
 * No new npm dependencies. Prefer OPENAI_API_KEY in production for longer or
 * idiomatic mail; MyMemory works out of the box for short enquiries.
 */

export type TranslateTarget = 'en' | 'sl'

export type TranslateResult = {
  text: string
  provider: 'openai' | 'mymemory' | 'mock'
}

const OPENAI_MODEL = process.env.OPENAI_TRANSLATE_MODEL || 'gpt-4o-mini'
const MYMEMORY_CHUNK = 450

const TARGET_LABEL: Record<TranslateTarget, string> = {
  en: 'English',
  sl: 'Slovenian',
}

export async function translateEmailBody(
  text: string,
  target: TranslateTarget,
): Promise<TranslateResult> {
  const trimmed = text.trim()
  if (!trimmed) {
    throw new TranslateError('Nothing to translate.', 400)
  }
  // Cap to keep free/simple providers and latency sane.
  if (trimmed.length > 20_000) {
    throw new TranslateError(
      'Message is too long to translate (max 20,000 characters).',
      400,
    )
  }

  if (process.env.OPENAI_API_KEY) {
    return translateWithOpenAI(trimmed, target)
  }

  if (process.env.TRANSLATE_MOCK === '1') {
    return {
      provider: 'mock',
      text: `[Mock ${TARGET_LABEL[target]} translation — set OPENAI_API_KEY for real translation]\n\n${trimmed}`,
    }
  }

  try {
    return await translateWithMyMemory(trimmed, target)
  } catch (err) {
    // If the free provider fails and no OpenAI key is configured, surface a
    // clear next step rather than a raw network error.
    if (err instanceof TranslateError) throw err
    const detail = err instanceof Error ? err.message : 'Unknown error'
    throw new TranslateError(
      `Translation failed (${detail}). Set OPENAI_API_KEY for a more reliable provider, or TRANSLATE_MOCK=1 for a local stand-in.`,
      502,
    )
  }
}

export class TranslateError extends Error {
  status: number
  constructor(message: string, status = 500) {
    super(message)
    this.name = 'TranslateError'
    this.status = status
  }
}

async function translateWithOpenAI(
  text: string,
  target: TranslateTarget,
): Promise<TranslateResult> {
  const key = process.env.OPENAI_API_KEY!
  const lang = TARGET_LABEL[target]
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      temperature: 0.2,
      messages: [
        {
          role: 'system',
          content:
            `You translate inbound customer emails for a boat/charter company admin. ` +
            `Detect the source language automatically. Translate into ${lang}. ` +
            `Keep names, emails, phone numbers, prices, and boat names unchanged. ` +
            `Preserve paragraph breaks. Return ONLY the translation — no preamble.`,
        },
        { role: 'user', content: text },
      ],
    }),
  })

  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new TranslateError(
      `OpenAI translation failed (${res.status}). ${body.slice(0, 200)}`,
      502,
    )
  }

  const data = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>
  }
  const out = data.choices?.[0]?.message?.content?.trim()
  if (!out) {
    throw new TranslateError('OpenAI returned an empty translation.', 502)
  }
  return { text: out, provider: 'openai' }
}

async function translateWithMyMemory(
  text: string,
  target: TranslateTarget,
): Promise<TranslateResult> {
  const chunks = chunkText(text, MYMEMORY_CHUNK)
  const parts: string[] = []
  for (const chunk of chunks) {
    parts.push(await myMemoryOne(chunk, target))
  }
  return { text: parts.join(''), provider: 'mymemory' }
}

async function myMemoryOne(
  text: string,
  target: TranslateTarget,
): Promise<string> {
  const url = new URL('https://api.mymemory.translated.net/get')
  url.searchParams.set('q', text)
  // Autodetect source → en or sl. Free anonymous quota is enough for admin use.
  url.searchParams.set('langpair', `Autodetect|${target}`)

  const res = await fetch(url.toString(), {
    headers: { Accept: 'application/json' },
    // Avoid hanging the admin UI if the free endpoint is slow.
    signal: AbortSignal.timeout(20_000),
  })
  if (!res.ok) {
    throw new Error(`MyMemory HTTP ${res.status}`)
  }
  const data = (await res.json()) as {
    responseStatus?: number
    responseData?: { translatedText?: string }
    responseDetails?: string
  }
  if (data.responseStatus !== 200 || !data.responseData?.translatedText) {
    throw new Error(
      data.responseDetails || `MyMemory status ${data.responseStatus}`,
    )
  }
  const translated = data.responseData.translatedText
  // MyMemory sometimes echoes QUOTA EXCEEDED into the text field.
  if (/QUERY LENGTH LIMIT EXCEEDED|MYMEMORY WARNING/i.test(translated)) {
    throw new Error(translated.slice(0, 160))
  }
  return translated
}

/** Split on paragraph / sentence boundaries so free APIs stay under char limits. */
function chunkText(text: string, max: number): string[] {
  if (text.length <= max) return [text]
  const chunks: string[] = []
  let rest = text
  while (rest.length > max) {
    let cut = rest.lastIndexOf('\n\n', max)
    if (cut < max * 0.4) cut = rest.lastIndexOf('\n', max)
    if (cut < max * 0.4) cut = rest.lastIndexOf('. ', max)
    if (cut < max * 0.4) cut = rest.lastIndexOf(' ', max)
    if (cut < max * 0.4) cut = max
    // Include the delimiter we split on.
    if (rest[cut] === ' ' || rest[cut] === '.') cut += 1
    chunks.push(rest.slice(0, cut))
    rest = rest.slice(cut)
  }
  if (rest) chunks.push(rest)
  return chunks
}
